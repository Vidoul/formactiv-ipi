import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CodeRole, Prisma, StatutCompte, StatutFormation, StatutInscription } from '@prisma/client';
import { porteeInscriptions, porteeSessions, voitLesCoordonnees } from '../../common/auth/portees';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { clausePagination, construirePage, type Page } from '../../common/dto/pagination.dto';
import { RegleMetierException } from '../../common/exceptions/regle-metier.exception';
import { aujourdhui, versIso } from '../../common/utils/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import type {
  InscriptionDto,
  ListeInscriptionsQueryDto,
  ModificationInscriptionDto,
  ResultatInscriptionDto,
} from './dto/inscriptions.dto';
import {
  STATUTS_OCCUPANT_UNE_PLACE,
  aDesPrerequis,
  capaciteAtteinte,
  controlerTransition,
} from './inscriptions.regles';

const SELECTION = {
  id: true,
  statut: true,
  dateInscription: true,
  prerequisVerifies: true,
  apprenant: {
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      entreprise: { select: { id: true, raisonSociale: true } },
    },
  },
  session: {
    select: {
      id: true,
      dateDebut: true,
      dateFin: true,
      lieu: true,
      formation: { select: { id: true, intitule: true, prerequis: true } },
    },
  },
} satisfies Prisma.InscriptionSelect;

type Ligne = Prisma.InscriptionGetPayload<{ select: typeof SELECTION }>;

const introuvable = () =>
  new NotFoundException({ code: 'INSCRIPTION_INTROUVABLE', message: 'Inscription introuvable.' });

/** UC-06 — Gérer les inscriptions (US-12, US-13) ; consultation selon portée (UC-07). */
@Injectable()
export class InscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  private versDto(l: Ligne, acteur: UtilisateurAuthentifie): InscriptionDto {
    const { email, ...apprenant } = l.apprenant;
    const { formation, ...session } = l.session;
    return {
      id: l.id,
      statut: l.statut,
      dateInscription: l.dateInscription,
      prerequisRequis: aDesPrerequis(formation.prerequis),
      prerequisVerifies: l.prerequisVerifies,
      apprenant: voitLesCoordonnees(acteur) ? { ...apprenant, email } : apprenant,
      session: {
        ...session,
        dateDebut: versIso(session.dateDebut),
        dateFin: versIso(session.dateFin),
        formation: { id: formation.id, intitule: formation.intitule },
      },
    };
  }

  async lister(
    acteur: UtilisateurAuthentifie,
    q: ListeInscriptionsQueryDto,
  ): Promise<Page<InscriptionDto>> {
    const where: Prisma.InscriptionWhereInput = {
      AND: [
        porteeInscriptions(acteur),
        {
          sessionId: q.sessionId,
          statut: q.statut,
          apprenantId: q.apprenantId,
        },
        q.entrepriseId ? { apprenant: { entrepriseId: q.entrepriseId } } : {},
      ],
    };
    const [lignes, total] = await this.prisma.$transaction([
      this.prisma.inscription.findMany({
        where,
        select: SELECTION,
        orderBy: [{ session: { dateDebut: 'desc' } }, { apprenant: { nom: 'asc' } }],
        ...clausePagination(q),
      }),
      this.prisma.inscription.count({ where }),
    ]);
    return construirePage(
      lignes.map((l) => this.versDto(l, acteur)),
      total,
      q,
    );
  }

  async detail(acteur: UtilisateurAuthentifie, id: string): Promise<InscriptionDto> {
    const ligne = await this.prisma.inscription.findFirst({
      where: { AND: [{ id }, porteeInscriptions(acteur)] },
      select: SELECTION,
    });
    if (!ligne) throw introuvable();
    return this.versDto(ligne, acteur);
  }

  /**
   * US-12 — inscrire un apprenant à une session : unicité (RG-INSC-01), capacité (RG-SESS-03),
   * avertissement sur les prérequis (RG-INSC-03). Une inscription annulée est réactivée.
   */
  async inscrire(
    acteur: UtilisateurAuthentifie,
    sessionId: string,
    apprenantId: string,
  ): Promise<ResultatInscriptionDto> {
    const session = await this.prisma.session.findFirst({
      where: { AND: [{ id: sessionId }, porteeSessions(acteur)] },
      select: {
        id: true,
        dateFin: true,
        capaciteMax: true,
        formation: { select: { statut: true, prerequis: true } },
      },
    });
    if (!session) {
      throw new NotFoundException({ code: 'SESSION_INTROUVABLE', message: 'Session introuvable.' });
    }
    if (versIso(session.dateFin) < aujourdhui()) {
      throw new RegleMetierException('SESSION_TERMINEE', 'Cette session est terminée.');
    }
    if (session.formation.statut !== StatutFormation.PUBLIEE) {
      throw new RegleMetierException(
        'FORMATION_NON_PUBLIEE',
        'La formation n’est plus ouverte aux inscriptions (archivée).',
      );
    }
    const apprenant = await this.prisma.utilisateur.findFirst({
      where: {
        id: apprenantId,
        role: { code: CodeRole.APPRENANT },
        statutCompte: { not: StatutCompte.ANONYMISE },
      },
      select: { id: true, nom: true, prenom: true },
    });
    if (!apprenant) {
      const message = 'Seul un compte apprenant existant peut être inscrit.';
      throw new RegleMetierException('APPRENANT_INVALIDE', message, HttpStatus.BAD_REQUEST, [
        { champ: 'apprenantId', messages: [message] },
      ]);
    }

    const id = await this.prisma.$transaction(
      async (tx) => {
        const existante = await tx.inscription.findUnique({
          where: { apprenantId_sessionId: { apprenantId, sessionId } },
          select: { id: true, statut: true },
        });
        if (existante && existante.statut !== StatutInscription.ANNULEE) {
          throw new RegleMetierException(
            'INSCRIPTION_EXISTANTE',
            `${apprenant.prenom} ${apprenant.nom} est déjà inscrit(e) à cette session (RG-INSC-01).`,
          );
        }
        const occupees = await tx.inscription.count({
          where: { sessionId, statut: { in: STATUTS_OCCUPANT_UNE_PLACE } },
        });
        if (capaciteAtteinte(session.capaciteMax, occupees)) {
          throw new RegleMetierException(
            'CAPACITE_ATTEINTE',
            `La capacité maximale de ${session.capaciteMax} places est atteinte (RG-SESS-03).`,
          );
        }
        const inscription = existante
          ? await tx.inscription.update({
              where: { id: existante.id },
              data: {
                statut: StatutInscription.EN_ATTENTE,
                dateInscription: new Date(),
                prerequisVerifies: false,
              },
              select: { id: true },
            })
          : await tx.inscription.create({
              data: { apprenantId, sessionId },
              select: { id: true },
            });
        await this.journal.enregistrer(
          {
            action: ActionJournal.INSCRIPTION_APPRENANT,
            typeObjet: 'inscription',
            idObjet: inscription.id,
            details: `session ${sessionId}${existante ? ' (réinscription)' : ''}`,
          },
          tx,
        );
        return inscription.id;
      },
      // Sérialisable : deux inscriptions simultanées ne peuvent pas dépasser la capacité.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return {
      inscription: await this.detail(acteur, id),
      avertissements: aDesPrerequis(session.formation.prerequis) ? ['PREREQUIS_A_VERIFIER'] : [],
    };
  }

  /** US-13 — suivi du cycle de statuts (RG-INSC-02) et traçage des prérequis (RG-INSC-03). */
  async modifier(
    acteur: UtilisateurAuthentifie,
    id: string,
    dto: ModificationInscriptionDto,
  ): Promise<InscriptionDto> {
    const actuelle = await this.prisma.inscription.findFirst({
      where: { AND: [{ id }, porteeInscriptions(acteur)] },
      select: SELECTION,
    });
    if (!actuelle) throw introuvable();

    const prerequisVerifies = dto.prerequisVerifies ?? actuelle.prerequisVerifies;
    if (dto.statut !== undefined) {
      const refus = controlerTransition(actuelle.statut, dto.statut, {
        sessionTerminee: versIso(actuelle.session.dateFin) < aujourdhui(),
        prerequisRequis: aDesPrerequis(actuelle.session.formation.prerequis),
        prerequisVerifies,
      });
      if (refus) throw new RegleMetierException(refus.code, refus.message);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.inscription.update({
        where: { id },
        data: { statut: dto.statut, prerequisVerifies: dto.prerequisVerifies },
      });
      if (dto.statut !== undefined && dto.statut !== actuelle.statut) {
        await this.journal.enregistrer(
          {
            action: ActionJournal.CHANGEMENT_STATUT_INSCRIPTION,
            typeObjet: 'inscription',
            idObjet: id,
            details: `${actuelle.statut} vers ${dto.statut}`,
          },
          tx,
        );
      }
      if (
        dto.prerequisVerifies !== undefined &&
        dto.prerequisVerifies !== actuelle.prerequisVerifies
      ) {
        await this.journal.enregistrer(
          {
            action: ActionJournal.CHANGEMENT_STATUT_INSCRIPTION,
            typeObjet: 'inscription',
            idObjet: id,
            details: `prérequis ${dto.prerequisVerifies ? 'vérifiés' : 'à vérifier'}`,
          },
          tx,
        );
      }
    });
    return this.detail(acteur, id);
  }
}
