import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { clausePagination, construirePage, type Page } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { EntreeJournalDto, JournalQueryDto } from './dto/journal.dto';

/** Recherches qui désignent les actions du système (auteur absent). */
const MOTS_SYSTEME = ['systeme', 'système'];

/**
 * UC-15 — Consultation du journal des actions sensibles (RG-LOG-01), réservée à
 * l'administrateur. Lecture seule : aucune méthode de modification (écriture seule côté
 * application, trigger côté base).
 */
@Injectable()
export class JournalConsultationService {
  constructor(private readonly prisma: PrismaService) {}

  async lister(q: JournalQueryDto, maintenant = new Date()): Promise<Page<EntreeJournalDto>> {
    const recherche = q.utilisateur?.trim();
    const auteur: Prisma.JournalActionWhereInput = !recherche
      ? {}
      : MOTS_SYSTEME.includes(recherche.toLowerCase())
        ? { utilisateurId: null }
        : {
            utilisateur: {
              OR: [
                { email: { contains: recherche, mode: 'insensitive' } },
                { nom: { contains: recherche, mode: 'insensitive' } },
                { prenom: { contains: recherche, mode: 'insensitive' } },
              ],
            },
          };
    const where: Prisma.JournalActionWhereInput = {
      ...auteur,
      action: q.action,
      dateAction: q.jours
        ? { gte: new Date(maintenant.getTime() - q.jours * 86_400_000) }
        : undefined,
    };
    const [lignes, total] = await Promise.all([
      this.prisma.journalAction.findMany({
        where,
        select: {
          id: true,
          dateAction: true,
          action: true,
          typeObjet: true,
          idObjet: true,
          details: true,
          adresseIp: true,
          utilisateur: { select: { id: true, nom: true, prenom: true, email: true } },
        },
        orderBy: [{ dateAction: 'desc' }, { id: 'desc' }],
        ...clausePagination(q),
      }),
      this.prisma.journalAction.count({ where }),
    ]);
    return construirePage(
      lignes.map(({ dateAction, ...reste }) => ({ date: dateAction, ...reste })),
      total,
      q,
    );
  }
}
