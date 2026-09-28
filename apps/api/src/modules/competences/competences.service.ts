import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TypeReferentiel } from '@prisma/client';
import { clausePagination, construirePage, type Page } from '../../common/dto/pagination.dto';
import { RegleMetierException } from '../../common/exceptions/regle-metier.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import type {
  CompetenceDto,
  CreationCompetenceDto,
  ListeCompetencesQueryDto,
  ModificationCompetenceDto,
} from './dto/competences.dto';

const SELECTION = {
  id: true,
  libelle: true,
  typeReferentiel: true,
  codeRncp: true,
  _count: { select: { formations: true } },
} satisfies Prisma.CompetenceSelect;

type Ligne = Prisma.CompetenceGetPayload<{ select: typeof SELECTION }>;

/** Clé de comparaison d'un libellé : sans casse, sans accents, espaces normalisés. */
export function cleLibelle(libelle: string): string {
  return libelle.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const versDto = ({ _count, ...c }: Ligne): CompetenceDto => ({
  ...c,
  nombreFormations: _count.formations,
});

/** Référentiels de compétences RNCP et interne (US-08, RG-COMP-01). */
@Injectable()
export class CompetencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  async lister(q: ListeCompetencesQueryDto): Promise<Page<CompetenceDto>> {
    const where: Prisma.CompetenceWhereInput = {
      typeReferentiel: q.referentiel,
      ...(q.recherche
        ? {
            OR: [
              { libelle: { contains: q.recherche, mode: 'insensitive' } },
              { codeRncp: { contains: q.recherche, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [lignes, total] = await this.prisma.$transaction([
      this.prisma.competence.findMany({
        where,
        select: SELECTION,
        orderBy: [{ typeReferentiel: 'desc' }, { libelle: 'asc' }],
        ...clausePagination(q),
      }),
      this.prisma.competence.count({ where }),
    ]);
    return construirePage(lignes.map(versDto), total, q);
  }

  private async trouver(id: string): Promise<Ligne> {
    const ligne = await this.prisma.competence.findUnique({ where: { id }, select: SELECTION });
    if (!ligne) {
      throw new NotFoundException({
        code: 'COMPETENCE_INTROUVABLE',
        message: 'Compétence introuvable.',
      });
    }
    return ligne;
  }

  /** RG-COMP-01 : libellé unique au sein d'un référentiel (insensible à la casse). */
  private async verifierUnicite(
    libelle: string,
    type: TypeReferentiel,
    saufId?: string,
  ): Promise<void> {
    // Comparaison applicative (casse, accents, espaces) : indépendante de la collation de la base.
    // Les référentiels comptent au plus quelques centaines d'entrées.
    const existantes = await this.prisma.competence.findMany({
      where: { typeReferentiel: type, NOT: saufId ? { id: saufId } : undefined },
      select: { libelle: true },
    });
    const cle = cleLibelle(libelle);
    if (existantes.some((c) => cleLibelle(c.libelle) === cle)) {
      const message = 'Ce libellé existe déjà dans ce référentiel (RG-COMP-01).';
      throw new RegleMetierException('COMPETENCE_EXISTANTE', message, HttpStatus.CONFLICT, [
        { champ: 'libelle', messages: [message] },
      ]);
    }
  }

  async creer(dto: CreationCompetenceDto): Promise<CompetenceDto> {
    await this.verifierUnicite(dto.libelle, dto.typeReferentiel);
    return this.prisma.$transaction(async (tx) => {
      const creee = await tx.competence.create({
        data: {
          libelle: dto.libelle,
          typeReferentiel: dto.typeReferentiel,
          codeRncp: dto.typeReferentiel === TypeReferentiel.RNCP ? dto.codeRncp : null,
        },
        select: SELECTION,
      });
      await this.journal.enregistrer(
        {
          action: ActionJournal.CREATION_COMPETENCE,
          typeObjet: 'competence',
          idObjet: creee.id,
          details: `${creee.typeReferentiel} — ${creee.libelle}`,
        },
        tx,
      );
      return versDto(creee);
    });
  }

  async modifier(id: string, dto: ModificationCompetenceDto): Promise<CompetenceDto> {
    const actuelle = await this.trouver(id);
    const type = dto.typeReferentiel ?? actuelle.typeReferentiel;
    const libelle = dto.libelle ?? actuelle.libelle;
    const codeRncp = type === TypeReferentiel.RNCP ? (dto.codeRncp ?? actuelle.codeRncp) : null;
    if (type === TypeReferentiel.RNCP && !codeRncp) {
      const message = 'Le code RNCP est obligatoire pour le référentiel RNCP (RG-COMP-01).';
      throw new RegleMetierException('CODE_RNCP_REQUIS', message, HttpStatus.BAD_REQUEST, [
        { champ: 'codeRncp', messages: [message] },
      ]);
    }
    await this.verifierUnicite(libelle, type, id);
    return this.prisma.$transaction(async (tx) => {
      const maj = await tx.competence.update({
        where: { id },
        data: { libelle, typeReferentiel: type, codeRncp },
        select: SELECTION,
      });
      await this.journal.enregistrer(
        { action: ActionJournal.MODIFICATION_COMPETENCE, typeObjet: 'competence', idObjet: id },
        tx,
      );
      return versDto(maj);
    });
  }

  async supprimer(id: string): Promise<void> {
    const competence = await this.trouver(id);
    const evaluations = await this.prisma.evaluation.count({ where: { competenceId: id } });
    if (competence._count.formations > 0 || evaluations > 0) {
      throw new RegleMetierException(
        'COMPETENCE_UTILISEE',
        'Cette compétence est visée par des formations ou évaluée : elle ne peut pas être supprimée.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.competence.delete({ where: { id } });
      await this.journal.enregistrer(
        {
          action: ActionJournal.SUPPRESSION_COMPETENCE,
          typeObjet: 'competence',
          idObjet: id,
          details: competence.libelle,
        },
        tx,
      );
    });
  }
}
