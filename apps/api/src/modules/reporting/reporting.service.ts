import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
  CodeRole,
  FinaliteConsentement,
  Prisma,
  StatutCompte,
  StatutDemandeRgpd,
  StatutInscription,
  TypeDemandeRgpd,
  TypeDocument,
} from '@prisma/client';
import { porteeInscriptions } from '../../common/auth/portees';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { clausePagination } from '../../common/dto/pagination.dto';
import { RegleMetierException } from '../../common/exceptions/regle-metier.exception';
import { ajouterJours, aujourdhui, depuisIso, versIso } from '../../common/utils/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { STATUTS_EVALUABLES } from '../inscriptions/inscriptions.regles';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import { ParametresService } from '../parametres/parametres.service';
import type {
  EtatSalarie,
  IndicateursDto,
  IndicateursQueryDto,
  PageSalariesDto,
  ReponseSatisfactionDto,
  SalariesQueryDto,
  SatisfactionEnregistreeDto,
  TableauAdministrationDto,
  TableauApprenantDto,
  TableauFormateurDto,
} from './dto/reporting.dto';
import {
  agreger,
  anneeCivile,
  ecartPoints,
  moisDeLaPeriode,
  periodePrecedente,
  ratio,
  variation,
  type LigneIndicateur,
  type Periode,
} from './reporting.regles';

/** Durée maximale d'une période analysée (sobriété des requêtes). */
const JOURS_MAX_PERIODE = 3 * 366;

/** Actions exclues de l'extrait « dernières actions sensibles » (écran 05). */
const ACTIONS_COURANTES = [
  ActionJournal.CONNEXION_REUSSIE,
  ActionJournal.DECONNEXION,
  ActionJournal.TELECHARGEMENT_DOCUMENT,
];

const SELECTION_LIGNE = {
  apprenantId: true,
  statut: true,
  reponseSatisfaction: { select: { score: true } },
  evaluations: { where: { acquise: true }, select: { competenceId: true } },
  session: {
    select: {
      dateDebut: true,
      formation: {
        select: { id: true, intitule: true, competences: { select: { competenceId: true } } },
      },
    },
  },
} satisfies Prisma.InscriptionSelect;

type InscriptionIndicateur = Prisma.InscriptionGetPayload<{ select: typeof SELECTION_LIGNE }>;

function versLigne(i: InscriptionIndicateur): LigneIndicateur {
  const visees = new Set(i.session.formation.competences.map((c) => c.competenceId));
  return {
    apprenantId: i.apprenantId,
    statut: i.statut,
    formationId: i.session.formation.id,
    intitule: i.session.formation.intitule,
    dateDebut: versIso(i.session.dateDebut),
    competencesVisees: visees.size,
    competencesAcquises: i.evaluations.filter((e) => visees.has(e.competenceId)).length,
    score: i.reponseSatisfaction?.score ?? null,
  };
}

/** Avancement temporel d'une session par rapport au jour. */
function etatSession(debut: string, fin: string, jour: string): EtatSalarie {
  if (jour < debut) return 'A_VENIR';
  return jour > fin ? 'TERMINEE' : 'EN_COURS';
}

/**
 * UC-12 — Tableaux de bord et reporting (US-23..27, RG-DASH-01..04). Chaque indicateur est
 * calculé sur la portée du rôle (RG-DASH-02) : global pour l'administration, ses sessions pour
 * le formateur, son parcours pour l'apprenant, ses salariés pour le client entreprise.
 */
@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
    private readonly parametres: ParametresService,
  ) {}

  // ---------------------------------------------------------------- Indicateurs (écrans 09, 21a)

  private periode(q: IndicateursQueryDto): Periode {
    const defaut = anneeCivile(aujourdhui());
    const periode = { du: q.du ?? defaut.du, au: q.au ?? defaut.au };
    const jours = (depuisIso(periode.au).getTime() - depuisIso(periode.du).getTime()) / 86_400_000;
    if (jours < 0 || jours > JOURS_MAX_PERIODE) {
      throw new RegleMetierException(
        'PERIODE_INVALIDE',
        'La période doit être ordonnée et ne pas dépasser trois ans.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return periode;
  }

  private verifierFiltreEntreprise(acteur: UtilisateurAuthentifie, entrepriseId?: string): void {
    const administration =
      acteur.role === CodeRole.ADMIN || acteur.role === CodeRole.RESP_FORMATION;
    if (entrepriseId && !administration) {
      throw new ForbiddenException({
        code: 'FILTRE_NON_AUTORISE',
        message: 'Le filtre entreprise est réservé à l’administration (RG-DASH-03).',
      });
    }
  }

  private async lignes(
    acteur: UtilisateurAuthentifie,
    periode: Periode,
    q: IndicateursQueryDto,
  ): Promise<LigneIndicateur[]> {
    const inscriptions = await this.prisma.inscription.findMany({
      where: {
        AND: [
          porteeInscriptions(acteur),
          {
            session: {
              dateDebut: { gte: depuisIso(periode.du), lte: depuisIso(periode.au) },
              formationId: q.formationId,
            },
          },
          q.entrepriseId ? { apprenant: { entrepriseId: q.entrepriseId } } : {},
        ],
      },
      select: SELECTION_LIGNE,
    });
    return inscriptions.map(versLigne);
  }

  async indicateurs(
    acteur: UtilisateurAuthentifie,
    q: IndicateursQueryDto,
  ): Promise<IndicateursDto> {
    this.verifierFiltreEntreprise(acteur, q.entrepriseId);
    const periode = this.periode(q);
    const precedente = periodePrecedente(periode);
    const [courantes, anterieures] = await Promise.all([
      this.lignes(acteur, periode, q),
      this.lignes(acteur, precedente, q),
    ]);
    const indicateurs = agreger(courantes);
    const avant = agreger(anterieures);

    const formations = new Map<string, LigneIndicateur[]>();
    for (const l of courantes)
      formations.set(l.formationId, [...(formations.get(l.formationId) ?? []), l]);

    return {
      periode,
      indicateurs,
      comparaison: {
        periode: precedente,
        tauxReussitePoints: ecartPoints(indicateurs.tauxReussite, avant.tauxReussite),
        tauxCompletionPoints: ecartPoints(indicateurs.tauxCompletion, avant.tauxCompletion),
        inscriptionsPourcent: variation(indicateurs.inscriptions, avant.inscriptions),
      },
      parMois: moisDeLaPeriode(periode).map((mois) => {
        const duMois = courantes.filter(
          (l) =>
            l.dateDebut.startsWith(mois) &&
            (l.statut === StatutInscription.VALIDEE || l.statut === StatutInscription.TERMINEE),
        );
        return {
          mois,
          inscriptions: duMois.length,
          apprenants: new Set(duMois.map((l) => l.apprenantId)).size,
        };
      }),
      parFormation: [...formations.values()]
        .map((groupe) => {
          const agregat = agreger(groupe);
          return {
            formation: { id: groupe[0].formationId, intitule: groupe[0].intitule },
            ...agregat,
            part: ratio(agregat.inscriptions, indicateurs.inscriptions),
          };
        })
        .sort(
          (a, b) =>
            b.inscriptions - a.inscriptions ||
            a.formation.intitule.localeCompare(b.formation.intitule, 'fr'),
        ),
    };
  }

  // ---------------------------------------------------------------- Administration (écran 05)

  async administration(maintenant = new Date()): Promise<TableauAdministrationDto> {
    const jour = aujourdhui(maintenant);
    const debut7j = ajouterJours(jour, -6);
    const debut14j = ajouterJours(jour, -13);
    // Bornes en heure de Paris : une marge d'un jour est prise puis affinée par jour calendaire.
    const connexions = await this.prisma.journalAction.findMany({
      where: {
        action: ActionJournal.CONNEXION_REUSSIE,
        dateAction: { gte: depuisIso(ajouterJours(debut14j, -1)) },
      },
      select: { dateAction: true },
    });
    const parJourCalendaire = new Map<string, number>();
    for (const c of connexions) {
      const j = aujourdhui(c.dateAction);
      parJourCalendaire.set(j, (parJourCalendaire.get(j) ?? 0) + 1);
    }
    const jours = (du: string, n: number) =>
      Array.from({ length: n }, (_, i) => ajouterJours(du, i));
    const parJour = jours(debut7j, 7).map((j) => ({
      jour: j,
      connexions: parJourCalendaire.get(j) ?? 0,
    }));
    const total = parJour.reduce((s, j) => s + j.connexions, 0);
    const precedent = jours(debut14j, 7).reduce((s, j) => s + (parJourCalendaire.get(j) ?? 0), 0);

    const enAttente = [StatutDemandeRgpd.RECUE, StatutDemandeRgpd.EN_COURS];
    const [comptesActifs, demandes, suppressions, verrouilles, actions] = await Promise.all([
      this.prisma.utilisateur.count({ where: { statutCompte: StatutCompte.ACTIF } }),
      this.prisma.demandeRgpd.count({ where: { statut: { in: enAttente } } }),
      this.prisma.demandeRgpd.count({
        where: { statut: { in: enAttente }, type: TypeDemandeRgpd.SUPPRESSION },
      }),
      this.prisma.utilisateur.count({
        where: { statutCompte: StatutCompte.VERROUILLE, verrouilleJusquA: { gt: maintenant } },
      }),
      this.prisma.journalAction.findMany({
        where: { action: { notIn: ACTIONS_COURANTES } },
        orderBy: { dateAction: 'desc' },
        take: 6,
        select: {
          id: true,
          dateAction: true,
          action: true,
          typeObjet: true,
          details: true,
          utilisateur: { select: { prenom: true, nom: true } },
        },
      }),
    ]);

    return {
      comptesActifs,
      connexions: { total, variation: variation(total, precedent), parJour },
      demandesRgpd: { enAttente: demandes, suppressions },
      comptesVerrouilles: verrouilles,
      dernieresActions: actions.map((a) => ({
        id: a.id,
        date: a.dateAction,
        auteur: a.utilisateur,
        action: a.action,
        typeObjet: a.typeObjet,
        details: a.details,
      })),
    };
  }

  // ---------------------------------------------------------------- Formateur (écran 17)

  async formateur(acteur: UtilisateurAuthentifie): Promise<TableauFormateurDto> {
    const jour = aujourdhui();
    const sessions = await this.prisma.session.findMany({
      where: { animations: { some: { formateurId: acteur.id } } },
      select: {
        id: true,
        dateDebut: true,
        dateFin: true,
        formation: { select: { intitule: true, competences: { select: { competenceId: true } } } },
        inscriptions: {
          where: { statut: { not: StatutInscription.ANNULEE } },
          select: {
            apprenantId: true,
            statut: true,
            evaluations: { where: { acquise: true }, select: { competenceId: true } },
          },
        },
      },
      orderBy: { dateDebut: 'desc' },
    });

    let acquisesTerminees = 0;
    let attenduesTerminees = 0;
    const parSession = sessions.map((s) => {
      const visees = new Set(s.formation.competences.map((c) => c.competenceId));
      const evaluables = s.inscriptions.filter((i) => STATUTS_EVALUABLES.includes(i.statut));
      const acquises = evaluables.reduce(
        (n, i) => n + i.evaluations.filter((e) => visees.has(e.competenceId)).length,
        0,
      );
      const attendues = evaluables.length * visees.size;
      const fin = versIso(s.dateFin);
      if (fin < jour) {
        acquisesTerminees += acquises;
        attenduesTerminees += attendues;
      }
      return {
        sessionId: s.id,
        intitule: s.formation.intitule,
        dateDebut: versIso(s.dateDebut),
        dateFin: fin,
        apprenants: evaluables.length,
        partValidee: ratio(acquises, attendues),
      };
    });

    return {
      sessionsAVenir: sessions.filter((s) => versIso(s.dateDebut) > jour).length,
      apprenantsSuivis: new Set(sessions.flatMap((s) => s.inscriptions.map((i) => i.apprenantId)))
        .size,
      acquisitionMoyenne: ratio(acquisesTerminees, attenduesTerminees),
      parSession: parSession.slice(0, 8),
    };
  }

  // ---------------------------------------------------------------- Apprenant (écran 18)

  private async consentementActif(utilisateurId: string): Promise<boolean> {
    const dernier = await this.prisma.consentement.findFirst({
      where: { utilisateurId, finalite: FinaliteConsentement.QUESTIONNAIRES_SATISFACTION },
      orderBy: { dateConsentement: 'desc' },
      select: { dateRetrait: true },
    });
    return dernier !== null && dernier.dateRetrait === null;
  }

  async apprenant(acteur: UtilisateurAuthentifie): Promise<TableauApprenantDto> {
    const jour = aujourdhui();
    const inscriptions = await this.prisma.inscription.findMany({
      where: { apprenantId: acteur.id, statut: { not: StatutInscription.ANNULEE } },
      select: {
        id: true,
        statut: true,
        reponseSatisfaction: { select: { id: true } },
        evaluations: { where: { acquise: true }, select: { competenceId: true } },
        documents: { select: { type: true } },
        session: {
          select: {
            dateDebut: true,
            dateFin: true,
            lieu: true,
            formation: {
              select: {
                intitule: true,
                modalite: true,
                competences: { select: { competenceId: true } },
              },
            },
          },
        },
      },
      orderBy: { session: { dateDebut: 'desc' } },
    });

    const suivies = inscriptions.filter((i) => STATUTS_EVALUABLES.includes(i.statut));
    const progression = inscriptions.map((i) => {
      const visees = new Set(i.session.formation.competences.map((c) => c.competenceId));
      const types = i.documents.map((d) => d.type);
      return {
        inscriptionId: i.id,
        formation: i.session.formation.intitule,
        statut: i.statut,
        etat: etatSession(versIso(i.session.dateDebut), versIso(i.session.dateFin), jour),
        competencesAcquises: i.evaluations.filter((e) => visees.has(e.competenceId)).length,
        competencesVisees: visees.size,
        document: types.includes(TypeDocument.CERTIFICAT)
          ? TypeDocument.CERTIFICAT
          : types.includes(TypeDocument.ATTESTATION)
            ? TypeDocument.ATTESTATION
            : null,
      };
    });
    const documents = inscriptions.flatMap((i) => i.documents);

    return {
      formationsSuivies: suivies.length,
      competences: progression
        .filter((p) => STATUTS_EVALUABLES.includes(p.statut))
        .reduce(
          (t, p) => ({
            acquises: t.acquises + p.competencesAcquises,
            total: t.total + p.competencesVisees,
          }),
          { acquises: 0, total: 0 },
        ),
      documents: {
        total: documents.length,
        certificats: documents.filter((d) => d.type === TypeDocument.CERTIFICAT).length,
        attestations: documents.filter((d) => d.type === TypeDocument.ATTESTATION).length,
      },
      progression,
      prochainesSessions: inscriptions
        .filter((i) => versIso(i.session.dateDebut) > jour)
        .reverse()
        .map((i) => ({
          inscriptionId: i.id,
          formation: i.session.formation.intitule,
          dateDebut: versIso(i.session.dateDebut),
          dateFin: versIso(i.session.dateFin),
          modalite: i.session.formation.modalite,
          lieu: i.session.lieu,
        })),
      satisfactionAttendue: inscriptions
        .filter((i) => i.statut === StatutInscription.TERMINEE && !i.reponseSatisfaction)
        .map((i) => ({ inscriptionId: i.id, formation: i.session.formation.intitule })),
      consentementSatisfaction: await this.consentementActif(acteur.id),
    };
  }

  // ---------------------------------------------------------------- Salariés (écran 21b)

  async salaries(acteur: UtilisateurAuthentifie, q: SalariesQueryDto): Promise<PageSalariesDto> {
    const jour = depuisIso(aujourdhui());
    const temporel: Prisma.SessionWhereInput =
      q.etat === 'A_VENIR'
        ? { dateDebut: { gt: jour } }
        : q.etat === 'TERMINEE'
          ? { dateFin: { lt: jour } }
          : q.etat === 'EN_COURS'
            ? { dateDebut: { lte: jour }, dateFin: { gte: jour } }
            : {};
    const where: Prisma.InscriptionWhereInput = {
      AND: [
        porteeInscriptions(acteur),
        { statut: { not: StatutInscription.ANNULEE } },
        { session: { ...temporel, formationId: q.formationId } },
      ],
    };
    const [lignes, total, distincts] = await Promise.all([
      this.prisma.inscription.findMany({
        where,
        select: {
          id: true,
          statut: true,
          apprenant: { select: { id: true, nom: true, prenom: true } },
          evaluations: { where: { acquise: true }, select: { competenceId: true } },
          documents: { select: { type: true } },
          session: {
            select: {
              dateDebut: true,
              dateFin: true,
              formation: {
                select: {
                  id: true,
                  intitule: true,
                  competences: { select: { competenceId: true } },
                },
              },
            },
          },
        },
        orderBy: [{ session: { dateDebut: 'desc' } }, { apprenant: { nom: 'asc' } }],
        ...clausePagination(q),
      }),
      this.prisma.inscription.count({ where }),
      this.prisma.inscription.findMany({
        where,
        distinct: ['apprenantId'],
        select: { apprenantId: true },
      }),
    ]);
    const iso = aujourdhui();
    return {
      donnees: lignes.map((i) => {
        const visees = new Set(i.session.formation.competences.map((c) => c.competenceId));
        const debut = versIso(i.session.dateDebut);
        const fin = versIso(i.session.dateFin);
        return {
          inscriptionId: i.id,
          apprenant: i.apprenant,
          formation: { id: i.session.formation.id, intitule: i.session.formation.intitule },
          session: { dateDebut: debut, dateFin: fin },
          statut: i.statut,
          etat: etatSession(debut, fin, iso),
          competencesAcquises: i.evaluations.filter((e) => visees.has(e.competenceId)).length,
          competencesVisees: visees.size,
          documents: [...new Set(i.documents.map((d) => d.type))],
        };
      }),
      total,
      page: q.page,
      limit: q.limit,
      salaries: distincts.length,
    };
  }

  // ---------------------------------------------------------------- Satisfaction (RG-DASH-04)

  /**
   * Réponse au questionnaire de satisfaction : réservée à l'apprenant, sur une inscription
   * terminée, une seule fois. Le consentement à la finalité « questionnaires de satisfaction »
   * est recueilli explicitement au moment de la réponse s'il n'est pas déjà actif (RG-RGPD-01).
   */
  async repondreSatisfaction(
    acteur: UtilisateurAuthentifie,
    inscriptionId: string,
    dto: ReponseSatisfactionDto,
  ): Promise<SatisfactionEnregistreeDto> {
    const inscription = await this.prisma.inscription.findFirst({
      where: { id: inscriptionId, apprenantId: acteur.id },
      select: { id: true, statut: true, reponseSatisfaction: { select: { id: true } } },
    });
    if (!inscription) {
      throw new NotFoundException({
        code: 'INSCRIPTION_INTROUVABLE',
        message: 'Inscription introuvable.',
      });
    }
    if (inscription.statut !== StatutInscription.TERMINEE) {
      throw new RegleMetierException(
        'SATISFACTION_PREMATUREE',
        'Le questionnaire est proposé à l’issue de la formation.',
      );
    }
    if (inscription.reponseSatisfaction) {
      throw new RegleMetierException(
        'SATISFACTION_DEJA_DONNEE',
        'Vous avez déjà répondu au questionnaire de cette formation.',
      );
    }
    const consentementActif = await this.consentementActif(acteur.id);
    const version = await this.parametres.versionMentions();

    return this.prisma.$transaction(async (tx) => {
      if (!consentementActif) {
        await tx.consentement.create({
          data: {
            utilisateurId: acteur.id,
            finalite: FinaliteConsentement.QUESTIONNAIRES_SATISFACTION,
            versionMentions: version,
          },
        });
        await this.journal.enregistrer(
          {
            action: ActionJournal.CONSENTEMENT_DONNE,
            typeObjet: 'consentement',
            details: `${FinaliteConsentement.QUESTIONNAIRES_SATISFACTION} (mentions ${version})`,
          },
          tx,
        );
      }
      const reponse = await tx.reponseSatisfaction.create({
        data: { inscriptionId, score: dto.score, commentaire: dto.commentaire || null },
        select: { id: true, score: true, dateReponse: true },
      });
      await this.journal.enregistrer(
        {
          action: ActionJournal.REPONSE_SATISFACTION,
          typeObjet: 'inscription',
          idObjet: inscriptionId,
        },
        tx,
      );
      return reponse;
    });
  }
}
