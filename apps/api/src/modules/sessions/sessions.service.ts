import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CodeRole, Prisma, StatutCompte, StatutFormation } from '@prisma/client';
import { porteeSessions } from '../../common/auth/portees';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { clausePagination, construirePage, type Page } from '../../common/dto/pagination.dto';
import { RegleMetierException } from '../../common/exceptions/regle-metier.exception';
import { aujourdhui, depuisIso, versIso } from '../../common/utils/dates';
import { PrismaService } from '../../prisma/prisma.service';
import {
  STATUTS_EVALUABLES,
  STATUTS_INSCRITS,
  STATUTS_OCCUPANT_UNE_PLACE,
} from '../inscriptions/inscriptions.regles';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import { CleParametre } from '../parametres/catalogue-parametres';
import { ParametresService } from '../parametres/parametres.service';
import type {
  ConflitDto,
  CreationSessionDto,
  DisponibiliteFormateurDto,
  ListeSessionsQueryDto,
  ModificationSessionDto,
  PeriodeQueryDto,
  SessionDto,
} from './dto/sessions.dto';
import {
  alerteSansFormateur,
  chevauchent,
  controlerDates,
  notesManquantes,
  premierJourCommun,
  statutTemporel,
} from './sessions.regles';

const SELECTION = {
  id: true,
  dateDebut: true,
  dateFin: true,
  lieu: true,
  capaciteMax: true,
  formation: {
    select: {
      id: true,
      intitule: true,
      modalite: true,
      statut: true,
      _count: { select: { competences: true } },
    },
  },
  animations: {
    select: { formateur: { select: { id: true, nom: true, prenom: true } } },
    orderBy: { dateAffectation: 'asc' },
  },
  _count: {
    select: {
      inscriptions: { where: { statut: { in: STATUTS_INSCRITS } } },
    },
  },
} satisfies Prisma.SessionSelect;

type Ligne = Prisma.SessionGetPayload<{ select: typeof SELECTION }>;

const introuvable = () =>
  new NotFoundException({ code: 'SESSION_INTROUVABLE', message: 'Session introuvable.' });

/** UC-05 — Planifier une session et affecter les intervenants (US-10, US-11, US-14, US-15). */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
    private readonly parametres: ParametresService,
  ) {}

  // ---------------------------------------------------------------- Lecture

  async lister(
    acteur: UtilisateurAuthentifie,
    q: ListeSessionsQueryDto,
  ): Promise<Page<SessionDto>> {
    const jour = depuisIso(aujourdhui());
    const periode: Prisma.SessionWhereInput =
      q.periode === 'a_venir'
        ? { dateDebut: { gt: jour } }
        : q.periode === 'passees'
          ? { dateFin: { lt: jour } }
          : q.periode === 'en_cours'
            ? { dateDebut: { lte: jour }, dateFin: { gte: jour } }
            : {};
    const where: Prisma.SessionWhereInput = {
      AND: [
        porteeSessions(acteur),
        periode,
        q.formationId ? { formationId: q.formationId } : {},
        q.depuis ? { dateFin: { gte: depuisIso(q.depuis) } } : {},
        q.jusqua ? { dateDebut: { lte: depuisIso(q.jusqua) } } : {},
      ],
    };
    const ordre = q.periode === 'a_venir' || q.periode === 'en_cours' ? 'asc' : 'desc';
    const [lignes, total] = await this.prisma.$transaction([
      this.prisma.session.findMany({
        where,
        select: SELECTION,
        orderBy: [{ dateDebut: ordre }, { id: 'asc' }],
        ...clausePagination(q),
      }),
      this.prisma.session.count({ where }),
    ]);
    return construirePage(await this.enrichir(lignes), total, q);
  }

  async detail(acteur: UtilisateurAuthentifie, id: string): Promise<SessionDto> {
    const ligne = await this.prisma.session.findFirst({
      where: { AND: [{ id }, porteeSessions(acteur)] },
      select: SELECTION,
    });
    if (!ligne) throw introuvable();
    return (await this.enrichir([ligne]))[0];
  }

  /** Ajoute les indicateurs calculés : conflits d'agenda, places, alertes, notes manquantes. */
  private async enrichir(lignes: Ligne[]): Promise<SessionDto[]> {
    if (lignes.length === 0) return [];
    const jour = aujourdhui();
    const delai = await this.parametres.entier(CleParametre.SESSION_ALERTE_SANS_FORMATEUR_JOURS);
    const ids = lignes.map((l) => l.id);

    const [places, evaluables, notes, conflits] = await Promise.all([
      this.prisma.inscription.groupBy({
        by: ['sessionId'],
        where: { sessionId: { in: ids }, statut: { in: STATUTS_OCCUPANT_UNE_PLACE } },
        _count: { _all: true },
      }),
      this.prisma.inscription.groupBy({
        by: ['sessionId'],
        where: { sessionId: { in: ids }, statut: { in: STATUTS_EVALUABLES } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<{ id_session: string; total: bigint }[]>`
        SELECT i.id_session, COUNT(*)::bigint AS total
        FROM evaluation e JOIN inscription i ON i.id_inscription = e.id_inscription
        WHERE i.id_session = ANY(${ids}::uuid[])
        GROUP BY i.id_session`,
      this.conflitsDesFormateurs(lignes),
    ]);
    const parSession = <T extends { sessionId: string; _count: { _all: number } }>(l: T[]) =>
      new Map(l.map((x) => [x.sessionId, x._count._all]));
    const placesParSession = parSession(places);
    const evaluablesParSession = parSession(evaluables);
    const notesParSession = new Map(notes.map((n) => [n.id_session, Number(n.total)]));

    return lignes.map((l) => {
      const debut = versIso(l.dateDebut);
      const fin = versIso(l.dateFin);
      return {
        id: l.id,
        formation: {
          id: l.formation.id,
          intitule: l.formation.intitule,
          modalite: l.formation.modalite,
          statut: l.formation.statut,
        },
        dateDebut: debut,
        dateFin: fin,
        lieu: l.lieu,
        capaciteMax: l.capaciteMax,
        statutTemporel: statutTemporel(debut, fin, jour),
        nombreInscrits: l._count.inscriptions,
        placesOccupees: placesParSession.get(l.id) ?? 0,
        formateurs: l.animations.map(({ formateur }) => ({
          ...formateur,
          conflits: conflits.get(`${l.id}:${formateur.id}`) ?? [],
        })),
        alerteSansFormateur: alerteSansFormateur(l.animations.length, debut, jour, delai),
        notesManquantes: notesManquantes(
          evaluablesParSession.get(l.id) ?? 0,
          l.formation._count.competences,
          notesParSession.get(l.id) ?? 0,
        ),
      };
    });
  }

  /** Conflits d'agenda : autres sessions des mêmes formateurs qui chevauchent la période. */
  private async conflitsDesFormateurs(lignes: Ligne[]): Promise<Map<string, ConflitDto[]>> {
    const formateurIds = [
      ...new Set(lignes.flatMap((l) => l.animations.map((a) => a.formateur.id))),
    ];
    const resultat = new Map<string, ConflitDto[]>();
    if (formateurIds.length === 0) return resultat;
    const agendas = await this.agendas(formateurIds);
    for (const l of lignes) {
      const periode = { debut: versIso(l.dateDebut), fin: versIso(l.dateFin) };
      for (const { formateur } of l.animations) {
        resultat.set(
          `${l.id}:${formateur.id}`,
          this.conflitsDans(agendas.get(formateur.id) ?? [], periode, l.id),
        );
      }
    }
    return resultat;
  }

  private async agendas(formateurIds: string[]) {
    const animations = await this.prisma.animation.findMany({
      where: { formateurId: { in: formateurIds } },
      select: {
        formateurId: true,
        session: {
          select: {
            id: true,
            dateDebut: true,
            dateFin: true,
            formation: { select: { intitule: true } },
          },
        },
      },
    });
    const parFormateur = new Map<string, typeof animations>();
    for (const a of animations) {
      parFormateur.set(a.formateurId, [...(parFormateur.get(a.formateurId) ?? []), a]);
    }
    return parFormateur;
  }

  private conflitsDans(
    agenda: {
      session: { id: string; dateDebut: Date; dateFin: Date; formation: { intitule: string } };
    }[],
    periode: { debut: string; fin: string },
    sessionExclue?: string,
  ): ConflitDto[] {
    return agenda
      .filter((a) => a.session.id !== sessionExclue)
      .map((a) => ({
        ...a.session,
        debut: versIso(a.session.dateDebut),
        fin: versIso(a.session.dateFin),
      }))
      .filter((s) => chevauchent(periode, s))
      .map((s) => ({
        sessionId: s.id,
        formation: s.formation.intitule,
        premierJour: premierJourCommun(periode, s),
      }));
  }

  /** Formateurs actifs et leurs conflits sur une période (dialogue « Affecter un formateur »). */
  async disponibilites(q: PeriodeQueryDto): Promise<DisponibiliteFormateurDto[]> {
    const formateurs = await this.prisma.utilisateur.findMany({
      where: {
        role: { code: CodeRole.FORMATEUR },
        statutCompte: { in: [StatutCompte.ACTIF, StatutCompte.VERROUILLE] },
      },
      select: { id: true, nom: true, prenom: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
    const agendas = await this.agendas(formateurs.map((f) => f.id));
    return formateurs.map((f) => ({
      ...f,
      conflits: this.conflitsDans(
        agendas.get(f.id) ?? [],
        { debut: q.debut, fin: q.fin },
        q.sessionExclue,
      ),
    }));
  }

  // ---------------------------------------------------------------- Écriture

  private controlerPeriode(debut: string, fin: string): void {
    const erreur = controlerDates(debut, fin);
    if (erreur) {
      throw new RegleMetierException('DATES_INCOHERENTES', erreur, HttpStatus.BAD_REQUEST, [
        { champ: 'dateFin', messages: [erreur] },
      ]);
    }
  }

  private async verifierFormateurs(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const valides = await this.prisma.utilisateur.count({
      where: {
        id: { in: ids },
        role: { code: CodeRole.FORMATEUR },
        statutCompte: { in: [StatutCompte.ACTIF, StatutCompte.VERROUILLE] },
      },
    });
    if (valides !== ids.length) {
      throw new RegleMetierException(
        'FORMATEUR_INVALIDE',
        'Seuls des comptes formateurs actifs peuvent être affectés à une session.',
        HttpStatus.BAD_REQUEST,
        [{ champ: 'formateurIds', messages: ['Formateur introuvable ou inactif.'] }],
      );
    }
  }

  async creer(acteur: UtilisateurAuthentifie, dto: CreationSessionDto): Promise<SessionDto> {
    this.controlerPeriode(dto.dateDebut, dto.dateFin);
    const formation = await this.prisma.formation.findUnique({
      where: { id: dto.formationId },
      select: { statut: true, intitule: true },
    });
    if (!formation) {
      throw new RegleMetierException(
        'FORMATION_INTROUVABLE',
        'Formation introuvable.',
        HttpStatus.BAD_REQUEST,
        [{ champ: 'formationId', messages: ['Formation introuvable.'] }],
      );
    }
    if (formation.statut !== StatutFormation.PUBLIEE) {
      throw new RegleMetierException(
        'FORMATION_NON_PUBLIEE',
        'Une session ne peut être planifiée que pour une formation publiée (UC-05).',
      );
    }
    const formateurIds = dto.formateurIds ?? [];
    await this.verifierFormateurs(formateurIds);

    const id = await this.prisma.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          formationId: dto.formationId,
          dateDebut: depuisIso(dto.dateDebut),
          dateFin: depuisIso(dto.dateFin),
          capaciteMax: dto.capaciteMax ?? null,
          lieu: dto.lieu || null,
          animations: { create: formateurIds.map((formateurId) => ({ formateurId })) },
        },
        select: { id: true },
      });
      await this.journal.enregistrer(
        {
          action: ActionJournal.CREATION_SESSION,
          typeObjet: 'session',
          idObjet: session.id,
          details: `${formation.intitule} du ${dto.dateDebut} au ${dto.dateFin}`,
        },
        tx,
      );
      for (const formateurId of formateurIds) {
        await this.journal.enregistrer(
          {
            action: ActionJournal.AFFECTATION_FORMATEUR,
            typeObjet: 'session',
            idObjet: session.id,
            details: `formateur ${formateurId}`,
          },
          tx,
        );
      }
      return session.id;
    });
    return this.detail(acteur, id);
  }

  async modifier(
    acteur: UtilisateurAuthentifie,
    id: string,
    dto: ModificationSessionDto,
  ): Promise<SessionDto> {
    const actuelle = await this.detail(acteur, id);
    const debut = dto.dateDebut ?? actuelle.dateDebut;
    const fin = dto.dateFin ?? actuelle.dateFin;
    this.controlerPeriode(debut, fin);
    if (
      dto.capaciteMax !== undefined &&
      dto.capaciteMax !== null &&
      dto.capaciteMax < actuelle.placesOccupees
    ) {
      const message = `La capacité ne peut pas être inférieure aux ${actuelle.placesOccupees} places déjà occupées.`;
      throw new RegleMetierException('CAPACITE_INSUFFISANTE', message, HttpStatus.CONFLICT, [
        { champ: 'capaciteMax', messages: [message] },
      ]);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id },
        data: {
          dateDebut: dto.dateDebut ? depuisIso(dto.dateDebut) : undefined,
          dateFin: dto.dateFin ? depuisIso(dto.dateFin) : undefined,
          capaciteMax: dto.capaciteMax,
          lieu: dto.lieu,
        },
      });
      await this.journal.enregistrer(
        {
          action: ActionJournal.MODIFICATION_SESSION,
          typeObjet: 'session',
          idObjet: id,
          details: `champs : ${Object.keys(dto).join(', ')}`,
        },
        tx,
      );
    });
    return this.detail(acteur, id);
  }

  async supprimer(acteur: UtilisateurAuthentifie, id: string): Promise<void> {
    await this.detail(acteur, id);
    const inscriptions = await this.prisma.inscription.count({ where: { sessionId: id } });
    if (inscriptions > 0) {
      throw new RegleMetierException(
        'SESSION_AVEC_INSCRIPTIONS',
        'Cette session comporte des inscriptions : annulez-les avant de la supprimer.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.session.delete({ where: { id } });
      await this.journal.enregistrer(
        { action: ActionJournal.SUPPRESSION_SESSION, typeObjet: 'session', idObjet: id },
        tx,
      );
    });
  }

  async affecterFormateur(
    acteur: UtilisateurAuthentifie,
    id: string,
    formateurId: string,
  ): Promise<SessionDto> {
    await this.detail(acteur, id);
    await this.verifierFormateurs([formateurId]);
    await this.prisma.$transaction(async (tx) => {
      const existante = await tx.animation.findUnique({
        where: { sessionId_formateurId: { sessionId: id, formateurId } },
      });
      if (existante) return;
      await tx.animation.create({ data: { sessionId: id, formateurId } });
      await this.journal.enregistrer(
        {
          action: ActionJournal.AFFECTATION_FORMATEUR,
          typeObjet: 'session',
          idObjet: id,
          details: `formateur ${formateurId}`,
        },
        tx,
      );
    });
    return this.detail(acteur, id);
  }

  async retirerFormateur(
    acteur: UtilisateurAuthentifie,
    id: string,
    formateurId: string,
  ): Promise<SessionDto> {
    const session = await this.detail(acteur, id);
    if (!session.formateurs.some((f) => f.id === formateurId)) return session;
    // RG-SESS-02 : une session commencée conserve au moins un formateur.
    if (session.formateurs.length === 1 && session.statutTemporel !== 'A_VENIR') {
      throw new RegleMetierException(
        'FORMATEUR_REQUIS',
        'Une session commencée doit conserver au moins un formateur (RG-SESS-02).',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.animation.delete({
        where: { sessionId_formateurId: { sessionId: id, formateurId } },
      });
      await this.journal.enregistrer(
        {
          action: ActionJournal.RETRAIT_FORMATEUR,
          typeObjet: 'session',
          idObjet: id,
          details: `formateur ${formateurId}`,
        },
        tx,
      );
    });
    return this.detail(acteur, id);
  }
}
