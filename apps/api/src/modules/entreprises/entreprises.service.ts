import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CodeRole, Prisma } from '@prisma/client';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { clausePagination, construirePage, type Page } from '../../common/dto/pagination.dto';
import { RegleMetierException } from '../../common/exceptions/regle-metier.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import type {
  CreationEntrepriseDto,
  EntrepriseDto,
  ListeEntreprisesQueryDto,
  ModificationEntrepriseDto,
} from './dto/entreprises.dto';

const SELECTION = {
  id: true,
  raisonSociale: true,
  siret: true,
  emailContact: true,
  dateCreation: true,
  _count: { select: { utilisateurs: true } },
} satisfies Prisma.EntrepriseClienteSelect;

type Ligne = Prisma.EntrepriseClienteGetPayload<{ select: typeof SELECTION }>;

const versDto = ({ _count, ...e }: Ligne): EntrepriseDto => ({
  ...e,
  nombreComptes: _count.utilisateurs,
});

/** Gestion des entreprises clientes (REQ-FUNC-018). */
@Injectable()
export class EntreprisesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  /** Portée : toutes (admin, responsable) ; la sienne uniquement (client entreprise). */
  private portee(acteur: UtilisateurAuthentifie): Prisma.EntrepriseClienteWhereInput {
    return acteur.role === CodeRole.CLIENT_ENTREPRISE ? { id: acteur.entrepriseId ?? '' } : {};
  }

  async lister(
    acteur: UtilisateurAuthentifie,
    q: ListeEntreprisesQueryDto,
  ): Promise<Page<EntrepriseDto>> {
    const where: Prisma.EntrepriseClienteWhereInput = {
      AND: [
        this.portee(acteur),
        q.recherche ? { raisonSociale: { contains: q.recherche, mode: 'insensitive' } } : {},
      ],
    };
    const [lignes, total] = await this.prisma.$transaction([
      this.prisma.entrepriseCliente.findMany({
        where,
        select: SELECTION,
        orderBy: { raisonSociale: 'asc' },
        ...clausePagination(q),
      }),
      this.prisma.entrepriseCliente.count({ where }),
    ]);
    return construirePage(lignes.map(versDto), total, q);
  }

  async detail(acteur: UtilisateurAuthentifie, id: string): Promise<EntrepriseDto> {
    const ligne = await this.prisma.entrepriseCliente.findFirst({
      where: { AND: [{ id }, this.portee(acteur)] },
      select: SELECTION,
    });
    if (!ligne)
      throw new NotFoundException({
        code: 'ENTREPRISE_INTROUVABLE',
        message: 'Entreprise introuvable.',
      });
    return versDto(ligne);
  }

  private async verifierSiretLibre(
    siret: string | null | undefined,
    saufId?: string,
  ): Promise<void> {
    if (!siret) return;
    const existante = await this.prisma.entrepriseCliente.findFirst({
      where: { siret, NOT: saufId ? { id: saufId } : undefined },
      select: { id: true },
    });
    if (existante) {
      throw new RegleMetierException(
        'SIRET_DEJA_UTILISE',
        'Une entreprise possède déjà ce SIRET.',
        HttpStatus.CONFLICT,
        [{ champ: 'siret', messages: ['Une entreprise possède déjà ce SIRET.'] }],
      );
    }
  }

  async creer(dto: CreationEntrepriseDto): Promise<EntrepriseDto> {
    await this.verifierSiretLibre(dto.siret);
    return this.prisma.$transaction(async (tx) => {
      const creee = await tx.entrepriseCliente.create({
        data: {
          raisonSociale: dto.raisonSociale,
          siret: dto.siret || null,
          emailContact: dto.emailContact,
        },
        select: SELECTION,
      });
      await this.journal.enregistrer(
        {
          action: ActionJournal.CREATION_ENTREPRISE,
          typeObjet: 'entreprise',
          idObjet: creee.id,
          details: creee.raisonSociale,
        },
        tx,
      );
      return versDto(creee);
    });
  }

  async modifier(id: string, dto: ModificationEntrepriseDto): Promise<EntrepriseDto> {
    await this.verifierSiretLibre(dto.siret, id);
    return this.prisma.$transaction(async (tx) => {
      const maj = await tx.entrepriseCliente.update({
        where: { id },
        data: {
          raisonSociale: dto.raisonSociale,
          siret: dto.siret === '' ? null : dto.siret,
          emailContact: dto.emailContact,
        },
        select: SELECTION,
      });
      await this.journal.enregistrer(
        { action: ActionJournal.MODIFICATION_ENTREPRISE, typeObjet: 'entreprise', idObjet: id },
        tx,
      );
      return versDto(maj);
    });
  }

  async supprimer(id: string): Promise<void> {
    const entreprise = await this.prisma.entrepriseCliente.findUnique({
      where: { id },
      select: { _count: { select: { utilisateurs: true } } },
    });
    if (!entreprise) {
      throw new NotFoundException({
        code: 'ENTREPRISE_INTROUVABLE',
        message: 'Entreprise introuvable.',
      });
    }
    if (entreprise._count.utilisateurs > 0) {
      throw new RegleMetierException(
        'ENTREPRISE_UTILISEE',
        'Des comptes sont rattachés à cette entreprise : détachez-les avant de la supprimer.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.entrepriseCliente.delete({ where: { id } });
      await this.journal.enregistrer(
        {
          action: ActionJournal.MODIFICATION_ENTREPRISE,
          typeObjet: 'entreprise',
          idObjet: id,
          details: 'suppression',
        },
        tx,
      );
    });
  }
}
