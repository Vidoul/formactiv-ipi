import { Injectable } from '@nestjs/common';
import { Prisma, StatutCompte } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import { doitEtreAnonymise, emailAnonyme, type CompteursHistorique } from './comptes.regles';

/** Traitement complémentaire enregistré par un autre module (ex. purge des PDF nominatifs). */
export type NettoyeurDonnees = (
  utilisateurId: string,
  tx: Prisma.TransactionClient,
) => Promise<void>;

/**
 * RG-CPT-02 / REQ-RGPD-005 : effacement des données personnelles d'un compte.
 *
 * - Sans historique : suppression physique.
 * - Avec historique : anonymisation — identité, email, secrets et sessions effacés ; les
 *   inscriptions, évaluations et documents restent rattachés à un compte anonyme pour conserver
 *   les statistiques agrégées sans donnée personnelle.
 */
@Injectable()
export class AnonymisationService {
  private readonly nettoyeurs: NettoyeurDonnees[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  enregistrerNettoyeur(nettoyeur: NettoyeurDonnees): void {
    this.nettoyeurs.push(nettoyeur);
  }

  async compteurs(
    utilisateurId: string,
    tx: Prisma.TransactionClient,
  ): Promise<CompteursHistorique> {
    const [inscriptions, animations, evaluationsSaisies, documentsEmis, actions, demandes] =
      await Promise.all([
        tx.inscription.count({ where: { apprenantId: utilisateurId } }),
        tx.animation.count({ where: { formateurId: utilisateurId } }),
        tx.evaluation.count({ where: { formateurId: utilisateurId } }),
        tx.document.count({ where: { emetteurId: utilisateurId } }),
        tx.journalAction.count({ where: { utilisateurId } }),
        tx.demandeRgpd.count({
          where: { OR: [{ utilisateurId }, { traitantId: utilisateurId }] },
        }),
      ]);
    return {
      inscriptions,
      animations,
      evaluationsSaisies,
      documentsEmis,
      actionsJournalisees: actions,
      demandesRgpd: demandes,
    };
  }

  /** Efface ou anonymise le compte ; à appeler dans une transaction. */
  async effacer(
    utilisateurId: string,
    tx: Prisma.TransactionClient,
    motif: string,
  ): Promise<'SUPPRIME' | 'ANONYMISE'> {
    const historique = await this.compteurs(utilisateurId, tx);
    if (!doitEtreAnonymise(historique)) {
      await tx.utilisateur.delete({ where: { id: utilisateurId } });
      await this.journal.enregistrer(
        {
          action: ActionJournal.SUPPRESSION_COMPTE,
          typeObjet: 'utilisateur',
          idObjet: utilisateurId,
          details: motif,
        },
        tx,
      );
      return 'SUPPRIME';
    }

    for (const nettoyeur of this.nettoyeurs) await nettoyeur(utilisateurId, tx);
    await tx.jetonRefresh.deleteMany({ where: { utilisateurId } });
    await tx.jetonUsageUnique.deleteMany({ where: { utilisateurId } });
    await tx.reponseSatisfaction.updateMany({
      where: { inscription: { apprenantId: utilisateurId } },
      data: { commentaire: null },
    });
    await tx.utilisateur.update({
      where: { id: utilisateurId },
      data: {
        nom: 'Anonyme',
        prenom: 'Compte',
        email: emailAnonyme(utilisateurId),
        motDePasseHash: null,
        mfaActive: false,
        mfaSecretChiffre: null,
        mfaDernierPas: null,
        statutCompte: StatutCompte.ANONYMISE,
        tentativesEchouees: 0,
        verrouilleJusquA: null,
        dateDerniereConnexion: null,
      },
    });
    await this.journal.enregistrer(
      {
        action: ActionJournal.ANONYMISATION_COMPTE,
        typeObjet: 'utilisateur',
        idObjet: utilisateurId,
        details: motif,
      },
      tx,
    );
    return 'ANONYMISE';
  }
}
