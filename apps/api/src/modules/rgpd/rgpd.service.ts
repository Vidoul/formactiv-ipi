import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
  FinaliteConsentement,
  Prisma,
  StatutCompte,
  StatutDemandeRgpd,
  TypeDemandeRgpd,
} from '@prisma/client';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { clausePagination, construirePage, type Page } from '../../common/dto/pagination.dto';
import { RegleMetierException } from '../../common/exceptions/regle-metier.exception';
import { aujourdhui, versIso } from '../../common/utils/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import { ParametresService } from '../parametres/parametres.service';
import { AnonymisationService } from '../utilisateurs/anonymisation.service';
import type {
  CreationDemandeDto,
  DemandeAdministrationDto,
  DemandeDto,
  ListeDemandesQueryDto,
  MesDonneesDto,
  RectificationDto,
  TraitementDemandeDto,
} from './dto/rgpd.dto';
import {
  controlerTraitement,
  estCloturee,
  finaliteRevocable,
  numeroDemande,
  STATUTS_OUVERTS,
} from './rgpd.regles';

const SELECTION_DEMANDE = {
  id: true,
  numero: true,
  type: true,
  statut: true,
  message: true,
  reponse: true,
  dateDemande: true,
  dateTraitement: true,
} satisfies Prisma.DemandeRgpdSelect;

type LigneDemande = Prisma.DemandeRgpdGetPayload<{ select: typeof SELECTION_DEMANDE }>;

function versDemande(d: LigneDemande): DemandeDto {
  return { ...d, numero: numeroDemande(d.numero) };
}

/**
 * UC-13 — Exercer ses droits (US-28..30) et UC-14 — Traiter les demandes (US-31).
 * RG-RGPD-02 : consultation, rectification et demande de suppression depuis l'espace personnel ;
 * les suppressions sont exécutées par l'administrateur (RG-CPT-02). Chaque étape est tracée.
 */
@Injectable()
export class RgpdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
    private readonly parametres: ParametresService,
    private readonly anonymisation: AnonymisationService,
  ) {}

  // ---------------------------------------------------------------- Droit d'accès et portabilité

  async mesDonnees(acteur: UtilisateurAuthentifie): Promise<MesDonneesDto> {
    const u = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: acteur.id },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        statutCompte: true,
        mfaActive: true,
        dateCreation: true,
        dateDerniereConnexion: true,
        role: { select: { code: true } },
        entreprise: { select: { raisonSociale: true } },
        consentements: {
          select: {
            id: true,
            finalite: true,
            versionMentions: true,
            dateConsentement: true,
            dateRetrait: true,
          },
          orderBy: { dateConsentement: 'desc' },
        },
        inscriptions: {
          select: {
            statut: true,
            dateInscription: true,
            session: {
              select: { dateDebut: true, dateFin: true, formation: { select: { intitule: true } } },
            },
            evaluations: {
              select: {
                note: true,
                acquise: true,
                dateSaisie: true,
                competence: { select: { libelle: true } },
              },
            },
            documents: { select: { type: true, referenceUnique: true, dateGeneration: true } },
            reponseSatisfaction: { select: { score: true, commentaire: true, dateReponse: true } },
          },
          orderBy: { dateInscription: 'desc' },
        },
        demandesRgpd: { select: SELECTION_DEMANDE, orderBy: { dateDemande: 'desc' } },
      },
    });
    const intitule = (i: (typeof u.inscriptions)[number]) => i.session.formation.intitule;
    return {
      compte: {
        id: u.id,
        nom: u.nom,
        prenom: u.prenom,
        email: u.email,
        role: u.role.code,
        statutCompte: u.statutCompte,
        entreprise: u.entreprise,
        mfaActive: u.mfaActive,
        dateCreation: u.dateCreation,
        dateDerniereConnexion: u.dateDerniereConnexion,
      },
      consentements: u.consentements,
      inscriptions: u.inscriptions.map((i) => ({
        formation: intitule(i),
        dateDebut: versIso(i.session.dateDebut),
        dateFin: versIso(i.session.dateFin),
        statut: i.statut,
        dateInscription: i.dateInscription,
      })),
      evaluations: u.inscriptions.flatMap((i) =>
        i.evaluations.map((e) => ({
          formation: intitule(i),
          competence: e.competence.libelle,
          note: e.note.toNumber(),
          acquise: e.acquise,
          dateSaisie: e.dateSaisie,
        })),
      ),
      documents: u.inscriptions.flatMap((i) =>
        i.documents.map((d) => ({
          type: d.type,
          reference: d.referenceUnique,
          dateGeneration: d.dateGeneration,
        })),
      ),
      satisfaction: u.inscriptions.flatMap((i) =>
        i.reponseSatisfaction ? [{ formation: intitule(i), ...i.reponseSatisfaction }] : [],
      ),
      demandes: u.demandesRgpd.map(versDemande),
    };
  }

  /** Portabilité : export JSON lisible par machine des données personnelles (journalisé). */
  async exporter(acteur: UtilisateurAuthentifie): Promise<{ contenu: Buffer; nomFichier: string }> {
    const donnees = await this.mesDonnees(acteur);
    await this.journal.enregistrer({
      action: ActionJournal.EXPORT_DONNEES_PERSONNELLES,
      typeObjet: 'utilisateur',
      idObjet: acteur.id,
    });
    const document = {
      editeur: 'FORMACTIV',
      genereLe: new Date().toISOString(),
      finalites: 'Gestion du compte et du parcours de formation ; questionnaires de satisfaction',
      ...donnees,
    };
    return {
      contenu: Buffer.from(JSON.stringify(document, null, 2), 'utf8'),
      nomFichier: `formactiv-mes-donnees-${aujourdhui()}.json`,
    };
  }

  // ---------------------------------------------------------------- Rectification

  async rectifier(acteur: UtilisateurAuthentifie, dto: RectificationDto): Promise<MesDonneesDto> {
    const actuel = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: acteur.id },
      select: { nom: true, prenom: true },
    });
    const modifies = (['nom', 'prenom'] as const).filter(
      (champ) => dto[champ] !== undefined && dto[champ] !== actuel[champ],
    );
    if (modifies.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.utilisateur.update({
          where: { id: acteur.id },
          data: { nom: dto.nom, prenom: dto.prenom },
        });
        // Les valeurs ne sont pas journalisées : seuls les champs modifiés le sont.
        await this.journal.enregistrer(
          {
            action: ActionJournal.RECTIFICATION_DONNEES,
            typeObjet: 'utilisateur',
            idObjet: acteur.id,
            details: `champs : ${modifies.join(', ')}`,
          },
          tx,
        );
      });
    }
    return this.mesDonnees(acteur);
  }

  // ---------------------------------------------------------------- Consentements (RG-RGPD-01)

  private async consentementActif(utilisateurId: string, finalite: FinaliteConsentement) {
    return this.prisma.consentement.findFirst({
      where: { utilisateurId, finalite, dateRetrait: null },
      orderBy: { dateConsentement: 'desc' },
      select: { id: true },
    });
  }

  private verifierRevocable(finalite: FinaliteConsentement): void {
    if (!finaliteRevocable(finalite)) {
      throw new RegleMetierException(
        'FINALITE_NON_REVOCABLE',
        'Le consentement à la gestion du compte conditionne son existence : demandez la suppression de votre compte.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  async donnerConsentement(
    acteur: UtilisateurAuthentifie,
    finalite: FinaliteConsentement,
  ): Promise<MesDonneesDto> {
    this.verifierRevocable(finalite);
    if (!(await this.consentementActif(acteur.id, finalite))) {
      const version = await this.parametres.versionMentions();
      await this.prisma.$transaction(async (tx) => {
        await tx.consentement.create({
          data: { utilisateurId: acteur.id, finalite, versionMentions: version },
        });
        await this.journal.enregistrer(
          {
            action: ActionJournal.CONSENTEMENT_DONNE,
            typeObjet: 'consentement',
            details: `${finalite} (mentions ${version})`,
          },
          tx,
        );
      });
    }
    return this.mesDonnees(acteur);
  }

  /** Retrait : la preuve est conservée, horodatée du retrait (jamais supprimée). */
  async retirerConsentement(
    acteur: UtilisateurAuthentifie,
    finalite: FinaliteConsentement,
  ): Promise<MesDonneesDto> {
    this.verifierRevocable(finalite);
    const actif = await this.consentementActif(acteur.id, finalite);
    if (actif) {
      await this.prisma.$transaction(async (tx) => {
        await tx.consentement.update({
          where: { id: actif.id },
          data: { dateRetrait: new Date() },
        });
        await this.journal.enregistrer(
          {
            action: ActionJournal.CONSENTEMENT_RETIRE,
            typeObjet: 'consentement',
            details: finalite,
          },
          tx,
        );
      });
    }
    return this.mesDonnees(acteur);
  }

  // ---------------------------------------------------------------- Demandes (UC-13)

  async creerDemande(acteur: UtilisateurAuthentifie, dto: CreationDemandeDto): Promise<DemandeDto> {
    const ouverte = await this.prisma.demandeRgpd.findFirst({
      where: { utilisateurId: acteur.id, type: dto.type, statut: { in: STATUTS_OUVERTS } },
      select: { numero: true },
    });
    if (ouverte) {
      throw new RegleMetierException(
        'DEMANDE_EN_COURS',
        `Une demande de ce type est déjà en cours de traitement (${numeroDemande(ouverte.numero)}).`,
      );
    }
    const demande = await this.prisma.$transaction(async (tx) => {
      const d = await tx.demandeRgpd.create({
        data: { utilisateurId: acteur.id, type: dto.type, message: dto.message || null },
        select: SELECTION_DEMANDE,
      });
      await this.journal.enregistrer(
        {
          action: ActionJournal.DEMANDE_RGPD,
          typeObjet: 'demande_rgpd',
          idObjet: d.id,
          details: `${numeroDemande(d.numero)} — ${d.type}`,
        },
        tx,
      );
      return d;
    });
    return versDemande(demande);
  }

  // ---------------------------------------------------------------- Traitement (UC-14)

  private readonly selectionAdministration = {
    ...SELECTION_DEMANDE,
    utilisateur: {
      select: { id: true, nom: true, prenom: true, email: true, statutCompte: true },
    },
    traitant: { select: { nom: true, prenom: true } },
  } satisfies Prisma.DemandeRgpdSelect;

  private versAdministration(
    d: Prisma.DemandeRgpdGetPayload<{ select: RgpdService['selectionAdministration'] }>,
  ): DemandeAdministrationDto {
    const { utilisateur, traitant, ...reste } = d;
    return { ...versDemande(reste), demandeur: utilisateur, traitant };
  }

  async listerDemandes(q: ListeDemandesQueryDto): Promise<Page<DemandeAdministrationDto>> {
    const where: Prisma.DemandeRgpdWhereInput = {
      type: q.type,
      statut: q.statut === 'OUVERTES' ? { in: STATUTS_OUVERTS } : q.statut,
    };
    const [lignes, total] = await Promise.all([
      this.prisma.demandeRgpd.findMany({
        where,
        select: this.selectionAdministration,
        orderBy: [{ dateDemande: 'desc' }],
        ...clausePagination(q),
      }),
      this.prisma.demandeRgpd.count({ where }),
    ]);
    return construirePage(
      lignes.map((d) => this.versAdministration(d)),
      total,
      q,
    );
  }

  /**
   * Traitement d'une demande. Une suppression « traitée » exécute l'effacement du compte
   * (anonymisation si historique, RG-CPT-02) dans la même transaction que la clôture.
   */
  async traiterDemande(
    acteur: UtilisateurAuthentifie,
    id: string,
    dto: TraitementDemandeDto,
  ): Promise<DemandeAdministrationDto> {
    const demande = await this.prisma.demandeRgpd.findUnique({
      where: { id },
      select: { id: true, numero: true, type: true, statut: true, utilisateurId: true },
    });
    if (!demande) {
      throw new NotFoundException({ code: 'DEMANDE_INTROUVABLE', message: 'Demande introuvable.' });
    }
    const refus = controlerTraitement(demande.statut, dto.statut, dto.reponse);
    if (refus) {
      throw new RegleMetierException('TRAITEMENT_IMPOSSIBLE', refus);
    }
    const effacement =
      demande.type === TypeDemandeRgpd.SUPPRESSION && dto.statut === StatutDemandeRgpd.TRAITEE;
    if (effacement && demande.utilisateurId === acteur.id) {
      throw new RegleMetierException(
        'AUTO_SUPPRESSION_INTERDITE',
        'Votre propre demande de suppression doit être traitée par un autre administrateur.',
      );
    }
    const numero = numeroDemande(demande.numero);
    const maj = await this.prisma.$transaction(async (tx) => {
      if (effacement) {
        const compte = await tx.utilisateur.findUniqueOrThrow({
          where: { id: demande.utilisateurId },
          select: { statutCompte: true },
        });
        if (compte.statutCompte !== StatutCompte.ANONYMISE) {
          await this.anonymisation.effacer(demande.utilisateurId, tx, `Demande RGPD ${numero}`);
        }
      }
      const d = await tx.demandeRgpd.update({
        where: { id },
        data: {
          statut: dto.statut,
          reponse: dto.reponse || undefined,
          traitantId: acteur.id,
          dateTraitement: estCloturee(dto.statut) ? new Date() : null,
        },
        select: this.selectionAdministration,
      });
      await this.journal.enregistrer(
        {
          action: ActionJournal.TRAITEMENT_DEMANDE_RGPD,
          typeObjet: 'demande_rgpd',
          idObjet: id,
          details: `${numero} — ${demande.type} : ${demande.statut} → ${dto.statut}`,
        },
        tx,
      );
      return d;
    });
    return this.versAdministration(maj);
  }
}
