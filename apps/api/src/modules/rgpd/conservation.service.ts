import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CodeRole, StatutCompte } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { contexteRequete } from '../../common/context/contexte-requete';
import { PrismaService } from '../../prisma/prisma.service';
import { STOCKAGE, type Stockage } from '../documents/stockage/stockage';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import { CleParametre } from '../parametres/catalogue-parametres';
import { ParametresService } from '../parametres/parametres.service';
import { AnonymisationService } from '../utilisateurs/anonymisation.service';
import type { RapportConservationDto } from './dto/rgpd.dto';
import { echeance, JOURNAL_MOIS_MINIMUM } from './rgpd.regles';

/** Un fichier récent peut appartenir à une génération en cours : il n'est jamais purgé. */
const DELAI_ORPHELIN_MS = 24 * 3_600_000;

/**
 * RG-RGPD-04 — Politique de conservation (durées paramétrables, hypothèses à valider) appliquée
 * par une purge mensuelle, également déclenchable par l'administrateur :
 * - comptes inactifs (hors administrateurs) : anonymisés ou supprimés selon l'historique
 *   (RG-CPT-02) ;
 * - réponses de satisfaction : commentaire libre effacé, note conservée pour les agrégats ;
 * - journal d'audit : entrées échues purgées (jamais moins de 6 mois, garanti aussi en base) ;
 * - stockage : fichiers PDF qui ne sont plus référencés (remplacés lors d'une anonymisation).
 * Chaque exécution est journalisée.
 */
@Injectable()
export class ConservationService {
  private readonly logger = new Logger(ConservationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
    private readonly parametres: ParametresService,
    private readonly anonymisation: AnonymisationService,
    @Inject(STOCKAGE) private readonly stockage: Stockage,
  ) {}

  /** Le 1er de chaque mois à 3 h (heure de Paris). */
  @Cron('0 3 1 * *', { name: 'purge-conservation', timeZone: 'Europe/Paris' })
  async tacheMensuelle(): Promise<void> {
    await contexteRequete.executer({ idRequete: randomUUID() }, async () => {
      try {
        const rapport = await this.purger();
        this.logger.log(`Purge de conservation : ${JSON.stringify(rapport)}`);
      } catch (erreur) {
        this.logger.error(`Échec de la purge de conservation : ${String(erreur)}`);
      }
    });
  }

  async purger(maintenant = new Date()): Promise<RapportConservationDto> {
    const [moisComptes, moisJournal, moisSatisfaction] = await Promise.all([
      this.parametres.entier(CleParametre.RGPD_CONSERVATION_COMPTES_INACTIFS_MOIS),
      this.parametres.entier(CleParametre.RGPD_CONSERVATION_JOURNAL_MOIS),
      this.parametres.entier(CleParametre.RGPD_CONSERVATION_SATISFACTION_MOIS),
    ]);

    // 1. Comptes inactifs depuis la durée paramétrée (jamais connectés : date de création).
    const limiteComptes = echeance(maintenant, moisComptes);
    const inactifs = await this.prisma.utilisateur.findMany({
      where: {
        statutCompte: { not: StatutCompte.ANONYMISE },
        role: { code: { not: CodeRole.ADMIN } },
        OR: [
          { dateDerniereConnexion: { lt: limiteComptes } },
          { dateDerniereConnexion: null, dateCreation: { lt: limiteComptes } },
        ],
      },
      select: { id: true },
    });
    for (const { id } of inactifs) {
      await this.prisma.$transaction((tx) =>
        this.anonymisation.effacer(
          id,
          tx,
          `Inactivité de plus de ${moisComptes} mois (RG-RGPD-04)`,
        ),
      );
    }

    // 2. Réponses de satisfaction : commentaire libre effacé, note conservée (agrégats).
    const satisfaction = await this.prisma.reponseSatisfaction.updateMany({
      where: {
        dateReponse: { lt: echeance(maintenant, moisSatisfaction) },
        commentaire: { not: null },
      },
      data: { commentaire: null },
    });

    // 3. Journal d'audit échu.
    const journal = await this.prisma.journalAction.deleteMany({
      where: {
        dateAction: { lt: echeance(maintenant, Math.max(moisJournal, JOURNAL_MOIS_MINIMUM)) },
      },
    });

    // 4. Fichiers orphelins du stockage.
    const references = new Set(
      (await this.prisma.document.findMany({ select: { fichier: true } })).map((d) => d.fichier),
    );
    const orphelins = (await this.stockage.lister('documents/')).filter(
      (o) =>
        !references.has(o.cle) && o.modifieLe.getTime() < maintenant.getTime() - DELAI_ORPHELIN_MS,
    );
    for (const o of orphelins) await this.stockage.supprimer(o.cle);

    const rapport: RapportConservationDto = {
      comptesAnonymises: inactifs.length,
      entreesJournalPurgees: journal.count,
      reponsesSatisfactionAnonymisees: satisfaction.count,
      fichiersOrphelinsSupprimes: orphelins.length,
    };
    await this.journal.enregistrer({
      action: ActionJournal.PURGE_CONSERVATION,
      typeObjet: 'conservation',
      details:
        `comptes ${rapport.comptesAnonymises}, journal ${rapport.entreesJournalPurgees}, ` +
        `satisfaction ${rapport.reponsesSatisfactionAnonymisees}, fichiers ${rapport.fichiersOrphelinsSupprimes}`,
    });
    return rapport;
  }
}
