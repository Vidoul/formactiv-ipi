import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CodeRole, Prisma } from '@prisma/client';
import { porteeInscriptions, porteeSessions } from '../../common/auth/portees';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { RegleMetierException } from '../../common/exceptions/regle-metier.exception';
import { aujourdhui, versIso } from '../../common/utils/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { STATUTS_EVALUABLES } from '../inscriptions/inscriptions.regles';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import type {
  EvaluationDto,
  FeuilleEvaluationDto,
  NoteDeFeuilleDto,
  SaisieNoteDto,
} from './dto/evaluations.dto';
import { arrondirNote, estAcquise, syntheseAcquisition } from './evaluations.regles';

const SELECTION_EVALUATION = {
  id: true,
  note: true,
  acquise: true,
  dateSaisie: true,
  competence: { select: { id: true, libelle: true, typeReferentiel: true } },
  formateur: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.EvaluationSelect;

type LigneEvaluation = Prisma.EvaluationGetPayload<{ select: typeof SELECTION_EVALUATION }>;

/** Contexte d'une session nécessaire aux contrôles de saisie. */
const SELECTION_SESSION = {
  id: true,
  dateDebut: true,
  dateFin: true,
  animations: { select: { formateurId: true } },
  formation: {
    select: {
      id: true,
      intitule: true,
      seuilAcquisition: true,
      competences: {
        select: { competence: { select: { id: true, libelle: true, typeReferentiel: true } } },
        orderBy: { competence: { libelle: 'asc' } },
      },
    },
  },
} satisfies Prisma.SessionSelect;

type ContexteSession = Prisma.SessionGetPayload<{ select: typeof SELECTION_SESSION }>;

/** UC-08 — Évaluer les apprenants (US-16, US-17) ; consultation des acquis (US-18). */
@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  // ---------------------------------------------------------------- Contrôles

  /**
   * RG-EVAL-01 : seul un formateur affecté à la session saisit ou modifie les évaluations.
   * Toute tentative hors affectation est refusée et journalisée (UC-08 E1).
   */
  private async verifierDroitSaisie(acteur: UtilisateurAuthentifie, session: ContexteSession) {
    const affecte =
      acteur.role === CodeRole.FORMATEUR &&
      session.animations.some((a) => a.formateurId === acteur.id);
    if (affecte) return;
    await this.journal.enregistrerSansBloquer({
      action: ActionJournal.ACCES_REFUSE,
      typeObjet: 'session',
      idObjet: session.id,
      details: 'Saisie de notes hors affectation (RG-EVAL-01)',
    });
    throw new ForbiddenException({
      code: 'FORMATEUR_NON_AFFECTE',
      message: 'Seul un formateur affecté à la session peut saisir les évaluations (RG-EVAL-01).',
    });
  }

  private verifierSessionCommencee(session: ContexteSession): void {
    if (aujourdhui() < versIso(session.dateDebut)) {
      throw new RegleMetierException(
        'SESSION_NON_COMMENCEE',
        'Les évaluations sont saisies à partir du début de la session.',
      );
    }
  }

  private verifierCompetence(session: ContexteSession, competenceId: string): void {
    if (!session.formation.competences.some((c) => c.competence.id === competenceId)) {
      throw new RegleMetierException(
        'COMPETENCE_HORS_FORMATION',
        'Cette compétence n’est pas visée par la formation.',
        HttpStatus.BAD_REQUEST,
        [{ champ: 'competenceId', messages: ['Compétence non visée par la formation.'] }],
      );
    }
  }

  private async inscriptionEvaluable(acteur: UtilisateurAuthentifie, inscriptionId: string) {
    const inscription = await this.prisma.inscription.findFirst({
      where: { AND: [{ id: inscriptionId }, porteeInscriptions(acteur)] },
      select: { id: true, statut: true, session: { select: SELECTION_SESSION } },
    });
    if (!inscription) {
      throw new NotFoundException({
        code: 'INSCRIPTION_INTROUVABLE',
        message: 'Inscription introuvable.',
      });
    }
    return inscription;
  }

  private exigerEvaluable(statut: string): void {
    if (!STATUTS_EVALUABLES.includes(statut as never)) {
      throw new RegleMetierException(
        'INSCRIPTION_NON_EVALUABLE',
        'Seules les inscriptions validées ou terminées sont évaluées.',
      );
    }
  }

  private versDto(e: LigneEvaluation, acteur: UtilisateurAuthentifie): EvaluationDto {
    // Client entreprise : synthèse (acquise ou non) sans la note détaillée ([À VALIDER], ch. 10).
    const synthese = acteur.role === CodeRole.CLIENT_ENTREPRISE;
    return {
      id: e.id,
      competence: e.competence,
      note: synthese ? null : e.note.toNumber(),
      acquise: e.acquise,
      dateSaisie: e.dateSaisie,
      formateur: synthese ? null : e.formateur,
    };
  }

  // ---------------------------------------------------------------- Par inscription

  async lister(acteur: UtilisateurAuthentifie, inscriptionId: string): Promise<EvaluationDto[]> {
    await this.inscriptionEvaluable(acteur, inscriptionId);
    const lignes = await this.prisma.evaluation.findMany({
      where: { inscriptionId },
      select: SELECTION_EVALUATION,
      orderBy: { competence: { libelle: 'asc' } },
    });
    return lignes.map((e) => this.versDto(e, acteur));
  }

  async saisir(
    acteur: UtilisateurAuthentifie,
    inscriptionId: string,
    dto: SaisieNoteDto,
  ): Promise<EvaluationDto> {
    const inscription = await this.inscriptionEvaluable(acteur, inscriptionId);
    const session = inscription.session;
    await this.verifierDroitSaisie(acteur, session);
    this.exigerEvaluable(inscription.statut);
    this.verifierSessionCommencee(session);
    this.verifierCompetence(session, dto.competenceId);

    const existante = await this.prisma.evaluation.findUnique({
      where: {
        inscriptionId_competenceId: { inscriptionId, competenceId: dto.competenceId },
      },
      select: { id: true },
    });
    if (existante) {
      throw new RegleMetierException(
        'EVALUATION_EXISTANTE',
        'Une note existe déjà pour cette compétence : utilisez la correction.',
        HttpStatus.CONFLICT,
        { evaluationId: existante.id },
      );
    }
    const note = arrondirNote(dto.note);
    const creee = await this.prisma.$transaction(async (tx) => {
      const e = await tx.evaluation.create({
        data: {
          inscriptionId,
          competenceId: dto.competenceId,
          note,
          acquise: estAcquise(note, session.formation.seuilAcquisition.toNumber()),
          formateurId: acteur.id,
        },
        select: SELECTION_EVALUATION,
      });
      await this.journal.enregistrer(
        {
          action: ActionJournal.SAISIE_NOTE,
          typeObjet: 'evaluation',
          idObjet: e.id,
          details: `inscription ${inscriptionId}, compétence ${e.competence.libelle}`,
        },
        tx,
      );
      return e;
    });
    return this.versDto(creee, acteur);
  }

  /** Correction d'une note : l'ancienne valeur est conservée au journal (UC-08 A1). */
  async corriger(
    acteur: UtilisateurAuthentifie,
    evaluationId: string,
    nouvelleNote: number,
  ): Promise<EvaluationDto> {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id: evaluationId, inscription: porteeInscriptions(acteur) },
      select: { id: true, note: true, inscriptionId: true },
    });
    if (!evaluation) {
      throw new NotFoundException({
        code: 'EVALUATION_INTROUVABLE',
        message: 'Évaluation introuvable.',
      });
    }
    const inscription = await this.inscriptionEvaluable(acteur, evaluation.inscriptionId);
    await this.verifierDroitSaisie(acteur, inscription.session);
    this.exigerEvaluable(inscription.statut);

    const note = arrondirNote(nouvelleNote);
    const seuil = inscription.session.formation.seuilAcquisition.toNumber();
    const maj = await this.prisma.$transaction(async (tx) => {
      const e = await tx.evaluation.update({
        where: { id: evaluationId },
        data: {
          note,
          acquise: estAcquise(note, seuil),
          formateurId: acteur.id,
          dateSaisie: new Date(),
        },
        select: SELECTION_EVALUATION,
      });
      await this.journal.enregistrer(
        {
          action: ActionJournal.CORRECTION_NOTE,
          typeObjet: 'evaluation',
          idObjet: evaluationId,
          details: `ancienne valeur ${evaluation.note.toNumber()} → ${note}`,
        },
        tx,
      );
      return e;
    });
    return this.versDto(maj, acteur);
  }

  // ---------------------------------------------------------------- Feuille de session

  private async sessionDansPortee(acteur: UtilisateurAuthentifie, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { AND: [{ id: sessionId }, porteeSessions(acteur)] },
      select: SELECTION_SESSION,
    });
    if (!session) {
      throw new NotFoundException({ code: 'SESSION_INTROUVABLE', message: 'Session introuvable.' });
    }
    return session;
  }

  /** Feuille d'évaluation d'une session (écran Figma 16) : apprenants × compétences. */
  async feuille(acteur: UtilisateurAuthentifie, sessionId: string): Promise<FeuilleEvaluationDto> {
    const session = await this.sessionDansPortee(acteur, sessionId);
    const seuil = session.formation.seuilAcquisition.toNumber();
    const competences = session.formation.competences.map((c) => c.competence);
    const inscriptions = await this.prisma.inscription.findMany({
      where: { sessionId, statut: { in: STATUTS_EVALUABLES } },
      select: {
        id: true,
        statut: true,
        apprenant: { select: { id: true, nom: true, prenom: true } },
        evaluations: { select: { id: true, competenceId: true, note: true, acquise: true } },
      },
      orderBy: [{ apprenant: { nom: 'asc' } }, { apprenant: { prenom: 'asc' } }],
    });

    return {
      session: {
        id: session.id,
        dateDebut: versIso(session.dateDebut),
        dateFin: versIso(session.dateFin),
        formation: {
          id: session.formation.id,
          intitule: session.formation.intitule,
          seuilAcquisition: seuil,
        },
      },
      competences,
      modifiable:
        acteur.role === CodeRole.FORMATEUR &&
        session.animations.some((a) => a.formateurId === acteur.id) &&
        aujourdhui() >= versIso(session.dateDebut),
      lignes: inscriptions.map((i) => {
        const notes = Object.fromEntries(
          competences.map((c) => {
            const e = i.evaluations.find((x) => x.competenceId === c.id);
            return [
              c.id,
              e ? { evaluationId: e.id, note: e.note.toNumber(), acquise: e.acquise } : null,
            ];
          }),
        );
        const synthese = syntheseAcquisition(
          competences.map((c) => notes[c.id]?.note ?? null),
          seuil,
        );
        return {
          inscriptionId: i.id,
          statut: i.statut,
          apprenant: i.apprenant,
          notes,
          acquises: synthese.acquises,
          total: synthese.total,
        };
      }),
    };
  }

  /** Enregistrement groupé de la feuille (une transaction, journalisation des seuls changements). */
  async enregistrerFeuille(
    acteur: UtilisateurAuthentifie,
    sessionId: string,
    notes: NoteDeFeuilleDto[],
  ): Promise<FeuilleEvaluationDto> {
    const session = await this.sessionDansPortee(acteur, sessionId);
    await this.verifierDroitSaisie(acteur, session);
    this.verifierSessionCommencee(session);
    const seuil = session.formation.seuilAcquisition.toNumber();

    const inscriptions = await this.prisma.inscription.findMany({
      where: { sessionId, statut: { in: STATUTS_EVALUABLES } },
      select: { id: true },
    });
    const evaluables = new Set(inscriptions.map((i) => i.id));
    for (const n of notes) {
      if (!evaluables.has(n.inscriptionId)) {
        throw new RegleMetierException(
          'INSCRIPTION_NON_EVALUABLE',
          'Une des lignes ne correspond pas à un apprenant évaluable de cette session.',
          HttpStatus.BAD_REQUEST,
        );
      }
      this.verifierCompetence(session, n.competenceId);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const n of notes) {
        const note = arrondirNote(n.note);
        const existante = await tx.evaluation.findUnique({
          where: {
            inscriptionId_competenceId: {
              inscriptionId: n.inscriptionId,
              competenceId: n.competenceId,
            },
          },
          select: { id: true, note: true },
        });
        if (existante && existante.note.toNumber() === note) continue;
        const donnees = { note, acquise: estAcquise(note, seuil), formateurId: acteur.id };
        if (existante) {
          await tx.evaluation.update({
            where: { id: existante.id },
            data: { ...donnees, dateSaisie: new Date() },
          });
          await this.journal.enregistrer(
            {
              action: ActionJournal.CORRECTION_NOTE,
              typeObjet: 'evaluation',
              idObjet: existante.id,
              details: `ancienne valeur ${existante.note.toNumber()} → ${note}`,
            },
            tx,
          );
        } else {
          const creee = await tx.evaluation.create({
            data: { ...donnees, inscriptionId: n.inscriptionId, competenceId: n.competenceId },
            select: { id: true },
          });
          await this.journal.enregistrer(
            {
              action: ActionJournal.SAISIE_NOTE,
              typeObjet: 'evaluation',
              idObjet: creee.id,
              details: `inscription ${n.inscriptionId}`,
            },
            tx,
          );
        }
      }
    });
    return this.feuille(acteur, sessionId);
  }
}
