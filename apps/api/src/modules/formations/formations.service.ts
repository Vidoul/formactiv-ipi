import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CodeRole, Prisma, StatutFormation } from '@prisma/client';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { clausePagination, construirePage, type Page } from '../../common/dto/pagination.dto';
import { RegleMetierException } from '../../common/exceptions/regle-metier.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import { CleParametre } from '../parametres/catalogue-parametres';
import { ParametresService } from '../parametres/parametres.service';
import type {
  CreationFormationDto,
  FormationDetailDto,
  FormationResumeDto,
  ListeFormationsQueryDto,
  ModificationFormationDto,
} from './dto/formations.dto';
import { controlerTransition, estSupprimable, normaliserPrerequis } from './formations.regles';

const SELECTION_RESUME = {
  id: true,
  intitule: true,
  dureeHeures: true,
  modalite: true,
  prerequis: true,
  statut: true,
  seuilAcquisition: true,
  _count: { select: { competences: true, sessions: true } },
} satisfies Prisma.FormationSelect;

const SELECTION_DETAIL = {
  ...SELECTION_RESUME,
  dateCreation: true,
  dateModification: true,
  competences: {
    select: {
      competence: { select: { id: true, libelle: true, typeReferentiel: true, codeRncp: true } },
    },
    orderBy: { competence: { libelle: 'asc' } },
  },
} satisfies Prisma.FormationSelect;

type Resume = Prisma.FormationGetPayload<{ select: typeof SELECTION_RESUME }>;
type Detail = Prisma.FormationGetPayload<{ select: typeof SELECTION_DETAIL }>;

function versResume({ _count, seuilAcquisition, ...f }: Resume): FormationResumeDto {
  return {
    ...f,
    seuilAcquisition: seuilAcquisition.toNumber(),
    nombreCompetences: _count.competences,
    nombreSessions: _count.sessions,
  };
}

function versDetail(f: Detail): FormationDetailDto {
  const { competences, dateCreation, dateModification, ...resume } = f;
  return {
    ...versResume(resume),
    competences: competences.map((l) => l.competence),
    dateCreation,
    dateModification,
  };
}

const introuvable = () =>
  new NotFoundException({ code: 'FORMATION_INTROUVABLE', message: 'Formation introuvable.' });

/** UC-04 — Créer et paramétrer une formation (US-06, US-07, US-09). */
@Injectable()
export class FormationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
    private readonly parametres: ParametresService,
  ) {}

  /** RG-FORM-03 : les apprenants et clients ne voient que le catalogue publié. */
  private portee(acteur: UtilisateurAuthentifie): Prisma.FormationWhereInput {
    return acteur.role === CodeRole.APPRENANT || acteur.role === CodeRole.CLIENT_ENTREPRISE
      ? { statut: StatutFormation.PUBLIEE }
      : {};
  }

  async lister(
    acteur: UtilisateurAuthentifie,
    q: ListeFormationsQueryDto,
  ): Promise<Page<FormationResumeDto>> {
    const where: Prisma.FormationWhereInput = {
      AND: [
        this.portee(acteur),
        { statut: q.statut, modalite: q.modalite },
        q.recherche ? { intitule: { contains: q.recherche, mode: 'insensitive' } } : {},
      ],
    };
    const [lignes, total] = await this.prisma.$transaction([
      this.prisma.formation.findMany({
        where,
        select: SELECTION_RESUME,
        orderBy: [{ statut: 'asc' }, { intitule: 'asc' }],
        ...clausePagination(q),
      }),
      this.prisma.formation.count({ where }),
    ]);
    return construirePage(lignes.map(versResume), total, q);
  }

  async detail(acteur: UtilisateurAuthentifie, id: string): Promise<FormationDetailDto> {
    const formation = await this.prisma.formation.findFirst({
      where: { AND: [{ id }, this.portee(acteur)] },
      select: SELECTION_DETAIL,
    });
    if (!formation) throw introuvable();
    return versDetail(formation);
  }

  private async verifierCompetences(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const trouvees = await this.prisma.competence.count({ where: { id: { in: ids } } });
    if (trouvees !== ids.length) {
      throw new RegleMetierException(
        'COMPETENCE_INTROUVABLE',
        'Une des compétences sélectionnées n’existe pas.',
        HttpStatus.BAD_REQUEST,
        [{ champ: 'competenceIds', messages: ['Compétence introuvable.'] }],
      );
    }
  }

  async creer(dto: CreationFormationDto): Promise<FormationDetailDto> {
    const competenceIds = dto.competenceIds ?? [];
    await this.verifierCompetences(competenceIds);
    const seuil =
      dto.seuilAcquisition ?? (await this.parametres.entier(CleParametre.EVALUATION_SEUIL_DEFAUT));

    return this.prisma.$transaction(async (tx) => {
      const creee = await tx.formation.create({
        data: {
          intitule: dto.intitule,
          dureeHeures: dto.dureeHeures,
          modalite: dto.modalite,
          prerequis: normaliserPrerequis(dto.prerequis),
          seuilAcquisition: seuil,
          statut: StatutFormation.BROUILLON,
          competences: { create: competenceIds.map((competenceId) => ({ competenceId })) },
        },
        select: SELECTION_DETAIL,
      });
      await this.journal.enregistrer(
        {
          action: ActionJournal.CREATION_FORMATION,
          typeObjet: 'formation',
          idObjet: creee.id,
          details: creee.intitule,
        },
        tx,
      );
      return versDetail(creee);
    });
  }

  async modifier(id: string, dto: ModificationFormationDto): Promise<FormationDetailDto> {
    const actuelle = await this.prisma.formation.findUnique({
      where: { id },
      select: SELECTION_RESUME,
    });
    if (!actuelle) throw introuvable();

    if (dto.statut !== undefined) {
      const refus = controlerTransition(
        {
          statut: actuelle.statut,
          nombreCompetences: actuelle._count.competences,
          nombreSessions: actuelle._count.sessions,
        },
        dto.statut,
      );
      if (refus) throw new RegleMetierException('TRANSITION_STATUT_INVALIDE', refus);
    }

    // Le seuil fige l'état « acquise » des évaluations déjà saisies (RG-EVAL-02) : il ne peut
    // plus changer une fois des notes enregistrées pour cette formation.
    if (
      dto.seuilAcquisition !== undefined &&
      dto.seuilAcquisition !== actuelle.seuilAcquisition.toNumber() &&
      (await this.prisma.evaluation.count({
        where: { inscription: { session: { formationId: id } } },
      })) > 0
    ) {
      const message = 'Le seuil ne peut plus être modifié : des évaluations ont déjà été saisies.';
      throw new RegleMetierException('SEUIL_VERROUILLE', message, HttpStatus.CONFLICT, [
        { champ: 'seuilAcquisition', messages: [message] },
      ]);
    }

    return this.prisma.$transaction(async (tx) => {
      const maj = await tx.formation.update({
        where: { id },
        data: {
          intitule: dto.intitule,
          dureeHeures: dto.dureeHeures,
          modalite: dto.modalite,
          prerequis: dto.prerequis !== undefined ? normaliserPrerequis(dto.prerequis) : undefined,
          seuilAcquisition: dto.seuilAcquisition,
          statut: dto.statut,
        },
        select: SELECTION_DETAIL,
      });
      const champs = Object.keys(dto).filter(
        (c) => c !== 'statut' && dto[c as keyof ModificationFormationDto] !== undefined,
      );
      if (champs.length) {
        await this.journal.enregistrer(
          {
            action: ActionJournal.MODIFICATION_FORMATION,
            typeObjet: 'formation',
            idObjet: id,
            details: `champs : ${champs.join(', ')}`,
          },
          tx,
        );
      }
      if (dto.statut !== undefined && dto.statut !== actuelle.statut) {
        await this.journal.enregistrer(
          {
            action: ActionJournal.CHANGEMENT_STATUT_FORMATION,
            typeObjet: 'formation',
            idObjet: id,
            details: `${actuelle.statut} vers ${dto.statut}`,
          },
          tx,
        );
      }
      return versDetail(maj);
    });
  }

  async supprimer(id: string): Promise<void> {
    const f = await this.prisma.formation.findUnique({ where: { id }, select: SELECTION_RESUME });
    if (!f) throw introuvable();
    if (
      !estSupprimable({
        statut: f.statut,
        nombreCompetences: f._count.competences,
        nombreSessions: f._count.sessions,
      })
    ) {
      throw new RegleMetierException(
        'FORMATION_NON_SUPPRIMABLE',
        'Seul un brouillon sans session peut être supprimé : archivez la formation.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.formation.delete({ where: { id } });
      await this.journal.enregistrer(
        {
          action: ActionJournal.SUPPRESSION_FORMATION,
          typeObjet: 'formation',
          idObjet: id,
          details: f.intitule,
        },
        tx,
      );
    });
  }

  // --- Compétences visées (RG-FORM-02) -------------------------------------------------------

  async ajouterCompetence(id: string, competenceId: string): Promise<FormationDetailDto> {
    if (!(await this.prisma.formation.count({ where: { id } }))) throw introuvable();
    await this.verifierCompetences([competenceId]);
    await this.prisma.$transaction(async (tx) => {
      await tx.formationCompetence.upsert({
        where: { formationId_competenceId: { formationId: id, competenceId } },
        update: {},
        create: { formationId: id, competenceId },
      });
      await this.journal.enregistrer(
        {
          action: ActionJournal.MODIFICATION_FORMATION,
          typeObjet: 'formation',
          idObjet: id,
          details: `compétence ajoutée ${competenceId}`,
        },
        tx,
      );
    });
    return this.detailInterne(id);
  }

  async retirerCompetence(id: string, competenceId: string): Promise<FormationDetailDto> {
    const f = await this.prisma.formation.findUnique({ where: { id }, select: SELECTION_RESUME });
    if (!f) throw introuvable();
    const evaluees = await this.prisma.evaluation.count({
      where: { competenceId, inscription: { session: { formationId: id } } },
    });
    if (evaluees > 0) {
      throw new RegleMetierException(
        'COMPETENCE_EVALUEE',
        'Cette compétence a déjà été évaluée dans une session : elle ne peut plus être retirée.',
      );
    }
    if (f.statut === StatutFormation.PUBLIEE && f._count.competences <= 1) {
      throw new RegleMetierException(
        'COMPETENCE_REQUISE',
        'Une formation publiée doit viser au moins une compétence (RG-FORM-02).',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.formationCompetence.deleteMany({ where: { formationId: id, competenceId } });
      await this.journal.enregistrer(
        {
          action: ActionJournal.MODIFICATION_FORMATION,
          typeObjet: 'formation',
          idObjet: id,
          details: `compétence retirée ${competenceId}`,
        },
        tx,
      );
    });
    return this.detailInterne(id);
  }

  private async detailInterne(id: string): Promise<FormationDetailDto> {
    const f = await this.prisma.formation.findUnique({ where: { id }, select: SELECTION_DETAIL });
    if (!f) throw introuvable();
    return versDetail(f);
  }
}
