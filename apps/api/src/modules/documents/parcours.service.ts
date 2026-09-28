import { Injectable, NotFoundException } from '@nestjs/common';
import { CodeRole, StatutInscription } from '@prisma/client';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { aujourdhui, versIso } from '../../common/utils/dates';
import { PrismaService } from '../../prisma/prisma.service';
import type { ParcoursDto } from './dto/documents.dto';
import { bilanCompetence, moyenne, type EvaluationCompetence } from './parcours.regles';

/**
 * UC-10 — Consulter son parcours (US-21) : historique complet des inscriptions, notes,
 * compétences et documents (RG-HIST-01), consultable par l'apprenant lui-même, le responsable
 * formation et l'administrateur.
 */
@Injectable()
export class ParcoursService {
  constructor(private readonly prisma: PrismaService) {}

  private peutConsulter(acteur: UtilisateurAuthentifie, apprenantId: string): boolean {
    return (
      acteur.id === apprenantId ||
      acteur.role === CodeRole.ADMIN ||
      acteur.role === CodeRole.RESP_FORMATION
    );
  }

  async parcours(acteur: UtilisateurAuthentifie, apprenantId: string): Promise<ParcoursDto> {
    const apprenant = this.peutConsulter(acteur, apprenantId)
      ? await this.prisma.utilisateur.findUnique({
          where: { id: apprenantId },
          select: { id: true, nom: true, prenom: true },
        })
      : null;
    if (!apprenant) {
      // 404 plutôt que 403 : l'existence d'un parcours hors portée n'est pas révélée.
      throw new NotFoundException({
        code: 'PARCOURS_INTROUVABLE',
        message: 'Parcours introuvable.',
      });
    }

    const inscriptions = await this.prisma.inscription.findMany({
      where: { apprenantId },
      select: {
        id: true,
        statut: true,
        dateInscription: true,
        evaluations: {
          select: { competenceId: true, note: true, acquise: true, dateSaisie: true },
        },
        documents: {
          select: { id: true, type: true, referenceUnique: true, dateGeneration: true },
          orderBy: { dateGeneration: 'desc' },
        },
        session: {
          select: {
            id: true,
            dateDebut: true,
            dateFin: true,
            lieu: true,
            formation: {
              select: {
                id: true,
                intitule: true,
                dureeHeures: true,
                seuilAcquisition: true,
                competences: {
                  select: {
                    competence: {
                      select: { id: true, libelle: true, typeReferentiel: true, codeRncp: true },
                    },
                  },
                  orderBy: { competence: { libelle: 'asc' } },
                },
              },
            },
          },
        },
      },
      orderBy: [{ session: { dateDebut: 'desc' } }, { dateInscription: 'desc' }],
    });

    const jour = aujourdhui();
    const competences = new Map<
      string,
      {
        libelle: string;
        typeReferentiel: ParcoursDto['competences'][number]['typeReferentiel'];
        codeRncp: string | null;
        evaluations: EvaluationCompetence[];
      }
    >();

    const etapes = inscriptions.map((i) => {
      const f = i.session.formation;
      const seuil = f.seuilAcquisition.toNumber();
      const compte =
        i.statut !== StatutInscription.ANNULEE && i.statut !== StatutInscription.EN_ATTENTE;
      const evaluations = f.competences.map(({ competence: c }) => {
        const e = i.evaluations.find((x) => x.competenceId === c.id);
        if (compte) {
          const entree = competences.get(c.id) ?? {
            libelle: c.libelle,
            typeReferentiel: c.typeReferentiel,
            codeRncp: c.codeRncp,
            evaluations: [],
          };
          if (e) {
            entree.evaluations.push({
              competenceId: c.id,
              note: e.note.toNumber(),
              acquise: e.acquise,
              seuil,
            });
          }
          competences.set(c.id, entree);
        }
        return {
          competenceId: c.id,
          libelle: c.libelle,
          note: e ? e.note.toNumber() : null,
          acquise: e?.acquise ?? false,
          dateSaisie: e?.dateSaisie ?? null,
        };
      });
      const notes = evaluations.flatMap((e) => (e.note === null ? [] : [e.note]));
      const debut = versIso(i.session.dateDebut);
      const fin = versIso(i.session.dateFin);
      return {
        inscriptionId: i.id,
        statut: i.statut,
        dateInscription: i.dateInscription,
        formation: { id: f.id, intitule: f.intitule, dureeHeures: f.dureeHeures },
        session: {
          id: i.session.id,
          dateDebut: debut,
          dateFin: fin,
          lieu: i.session.lieu,
          enCours: debut <= jour && jour <= fin,
        },
        moyenne: moyenne(notes),
        partielle: notes.length > 0 && notes.length < evaluations.length,
        competencesAcquises: evaluations.filter((e) => e.acquise).length,
        competencesVisees: evaluations.length,
        evaluations,
        documents: i.documents.map((d) => ({
          id: d.id,
          type: d.type,
          reference: d.referenceUnique,
          dateGeneration: d.dateGeneration,
        })),
      };
    });

    return {
      apprenant,
      etapes,
      competences: [...competences.entries()]
        .map(([id, c]) => ({
          id,
          libelle: c.libelle,
          typeReferentiel: c.typeReferentiel,
          codeRncp: c.codeRncp,
          ...bilanCompetence(c.evaluations),
        }))
        .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr')),
    };
  }
}
