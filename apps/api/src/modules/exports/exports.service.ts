import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import { CodeRole, Prisma, StatutInscription } from '@prisma/client';
import { porteeInscriptions, voitLesCoordonnees } from '../../common/auth/portees';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { RegleMetierException } from '../../common/exceptions/regle-metier.exception';
import { aujourdhui, depuisIso, versIso } from '../../common/utils/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { genererTableauPdf } from '../documents/pdf/gabarit-tableau';
import { moyenne } from '../documents/parcours.regles';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import { genererCsv, type Cellule } from './csv';
import type { ExportQueryDto, JeuExport } from './dto/exports.dto';

/** Au-delà, l'utilisateur est invité à affiner ses filtres (sobriété, chapitre 8). */
export const LIGNES_MAX_EXPORT = 5000;

const LIBELLES_STATUT: Record<StatutInscription, string> = {
  EN_ATTENTE: 'En attente',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
  TERMINEE: 'Terminée',
};

const TITRES: Record<JeuExport, string> = {
  inscriptions: 'Inscriptions',
  resultats: 'Résultats par apprenant',
  evaluations: 'Évaluations par compétence',
};

interface Colonne {
  entete: string;
  largeur: number;
}

interface Tableau {
  colonnes: Colonne[];
  lignes: Cellule[][];
}

export interface FichierExport {
  contenu: Buffer;
  nomFichier: string;
  typeMime: string;
  lignes: number;
}

/** « 18/09/2026 » depuis une date ISO ou un horodatage (jour calendaire à Paris). */
function dateFr(date: Date | string): string {
  const iso = typeof date === 'string' ? date : aujourdhui(date);
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

/** Texte d'une cellule du PDF (mêmes conventions que le CSV, sans échappement). */
function texteCellule(c: Cellule): string {
  if (c === null || c === undefined) return '';
  if (typeof c === 'boolean') return c ? 'Oui' : 'Non';
  return typeof c === 'number' ? String(c).replace('.', ',') : c;
}

const SELECTION_EXPORT = {
  id: true,
  statut: true,
  dateInscription: true,
  apprenant: {
    select: {
      nom: true,
      prenom: true,
      email: true,
      entreprise: { select: { raisonSociale: true } },
    },
  },
  session: {
    select: {
      dateDebut: true,
      dateFin: true,
      formation: {
        select: {
          intitule: true,
          competences: { select: { competenceId: true } },
        },
      },
    },
  },
  evaluations: {
    select: {
      note: true,
      acquise: true,
      dateSaisie: true,
      competenceId: true,
      competence: { select: { libelle: true, typeReferentiel: true, codeRncp: true } },
    },
    orderBy: { competence: { libelle: 'asc' } },
  },
  documents: {
    select: { type: true, referenceUnique: true },
    orderBy: { dateGeneration: 'desc' },
  },
} satisfies Prisma.InscriptionSelect;

type LigneExport = Prisma.InscriptionGetPayload<{ select: typeof SELECTION_EXPORT }>;

/**
 * UC-11 — Exporter des données (US-22). RG-EXP-01 : un export ne contient que les données
 * auxquelles le rôle demandeur a accès — la portée RBAC est appliquée dans la requête, et les
 * colonnes sont réduites selon le rôle (coordonnées réservées à l'administration, notes
 * détaillées masquées au client entreprise).
 */
@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  private filtres(acteur: UtilisateurAuthentifie, q: ExportQueryDto): Prisma.InscriptionWhereInput {
    const administration =
      acteur.role === CodeRole.ADMIN || acteur.role === CodeRole.RESP_FORMATION;
    if (q.entrepriseId && !administration) {
      throw new ForbiddenException({
        code: 'FILTRE_NON_AUTORISE',
        message: 'Le filtre entreprise est réservé à l’administration (RG-DASH-03).',
      });
    }
    if (q.du && q.au && q.du > q.au) {
      throw new RegleMetierException(
        'PERIODE_INVALIDE',
        'La date de début de période doit précéder la date de fin.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const session: Prisma.SessionWhereInput = {
      id: q.sessionId,
      formationId: q.formationId,
      dateFin: q.du ? { gte: depuisIso(q.du) } : undefined,
      dateDebut: q.au ? { lte: depuisIso(q.au) } : undefined,
    };
    return {
      AND: [
        porteeInscriptions(acteur),
        { session },
        q.entrepriseId ? { apprenant: { entrepriseId: q.entrepriseId } } : {},
      ],
    };
  }

  private tableau(acteur: UtilisateurAuthentifie, jeu: JeuExport, lignes: LigneExport[]): Tableau {
    const coordonnees = voitLesCoordonnees(acteur);
    const synthese = acteur.role === CodeRole.CLIENT_ENTREPRISE;
    const identite = (l: LigneExport) => `${l.apprenant.prenom} ${l.apprenant.nom}`;
    const entreprise = (l: LigneExport) => l.apprenant.entreprise?.raisonSociale ?? '';
    const periode = (l: LigneExport) =>
      `${dateFr(versIso(l.session.dateDebut))} – ${dateFr(versIso(l.session.dateFin))}`;

    switch (jeu) {
      case 'inscriptions':
        return {
          colonnes: [
            { entete: 'Formation', largeur: 5 },
            { entete: 'Session', largeur: 4 },
            { entete: 'Apprenant', largeur: 4 },
            ...(coordonnees ? [{ entete: 'Email', largeur: 5 }] : []),
            { entete: 'Entreprise', largeur: 4 },
            { entete: 'Statut', largeur: 2 },
            { entete: 'Inscrit le', largeur: 2 },
          ],
          lignes: lignes.map((l) => [
            l.session.formation.intitule,
            periode(l),
            identite(l),
            ...(coordonnees ? [l.apprenant.email] : []),
            entreprise(l),
            LIBELLES_STATUT[l.statut],
            dateFr(l.dateInscription),
          ]),
        };
      case 'resultats':
        return {
          colonnes: [
            { entete: 'Formation', largeur: 5 },
            { entete: 'Session', largeur: 4 },
            { entete: 'Apprenant', largeur: 4 },
            { entete: 'Entreprise', largeur: 4 },
            { entete: 'Statut', largeur: 2 },
            { entete: 'Compétences acquises', largeur: 3 },
            ...(synthese ? [] : [{ entete: 'Moyenne /20', largeur: 2 }]),
            { entete: 'Documents', largeur: 3 },
          ],
          lignes: lignes.map((l) => {
            const visees = new Set(l.session.formation.competences.map((c) => c.competenceId));
            const evaluees = l.evaluations.filter((e) => visees.has(e.competenceId));
            const acquises = evaluees.filter((e) => e.acquise).length;
            return [
              l.session.formation.intitule,
              periode(l),
              identite(l),
              entreprise(l),
              LIBELLES_STATUT[l.statut],
              `${acquises} / ${visees.size}`,
              ...(synthese ? [] : [moyenne(evaluees.map((e) => e.note.toNumber()))]),
              l.documents.map((d) => d.referenceUnique).join(', '),
            ];
          }),
        };
      case 'evaluations':
        return {
          colonnes: [
            { entete: 'Formation', largeur: 4 },
            { entete: 'Session', largeur: 3 },
            { entete: 'Apprenant', largeur: 3 },
            { entete: 'Entreprise', largeur: 3 },
            { entete: 'Compétence', largeur: 4 },
            { entete: 'Référentiel', largeur: 2 },
            ...(synthese ? [] : [{ entete: 'Note /20', largeur: 2 }]),
            { entete: 'Acquise', largeur: 2 },
            { entete: 'Saisie le', largeur: 2 },
          ],
          lignes: lignes.flatMap((l) =>
            l.evaluations.map((e) => [
              l.session.formation.intitule,
              periode(l),
              identite(l),
              entreprise(l),
              e.competence.libelle,
              e.competence.codeRncp ?? e.competence.typeReferentiel,
              ...(synthese ? [] : [e.note.toNumber()]),
              e.acquise,
              dateFr(e.dateSaisie),
            ]),
          ),
        };
    }
  }

  async exporter(acteur: UtilisateurAuthentifie, q: ExportQueryDto): Promise<FichierExport> {
    const where = this.filtres(acteur, q);
    const inscriptions = await this.prisma.inscription.findMany({
      where,
      select: SELECTION_EXPORT,
      orderBy: [
        { session: { dateDebut: 'desc' } },
        { apprenant: { nom: 'asc' } },
        { apprenant: { prenom: 'asc' } },
      ],
      take: LIGNES_MAX_EXPORT + 1,
    });
    const { colonnes, lignes } = this.tableau(acteur, q.jeu, inscriptions);
    if (inscriptions.length > LIGNES_MAX_EXPORT || lignes.length > LIGNES_MAX_EXPORT * 10) {
      throw new RegleMetierException(
        'EXPORT_TROP_VOLUMINEUX',
        `L’export dépasse ${LIGNES_MAX_EXPORT} inscriptions : affinez les filtres (période, formation, session).`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const date = aujourdhui();
    const nomFichier = `formactiv-${q.jeu}-${date}.${q.format}`;
    const contenu =
      q.format === 'csv'
        ? genererCsv(
            colonnes.map((c) => c.entete),
            lignes,
          )
        : await genererTableauPdf({
            titre: `Export — ${TITRES[q.jeu]}`,
            sousTitre: `Extraction du ${dateFr(date)} — ${lignes.length} ligne(s) — données limitées à la portée du rôle (RG-EXP-01).`,
            colonnes,
            lignes: lignes.map((l) => l.map((c) => texteCellule(c))),
          });

    const filtres = Object.entries({
      session: q.sessionId,
      formation: q.formationId,
      entreprise: q.entrepriseId,
      du: q.du,
      au: q.au,
    })
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    await this.journal.enregistrer({
      action: q.format === 'csv' ? ActionJournal.EXPORT_CSV : ActionJournal.EXPORT_PDF,
      typeObjet: 'export',
      details: `${q.jeu} — ${lignes.length} ligne(s)${filtres ? ` — ${filtres}` : ''}`,
    });
    return {
      contenu,
      nomFichier,
      typeMime: q.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf',
      lignes: lignes.length,
    };
  }
}
