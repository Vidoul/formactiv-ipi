import {
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CodeRole, Prisma, StatutCompte, TypeDocument } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { porteeInscriptions, porteeSessions } from '../../common/auth/portees';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { clausePagination, construirePage, type Page } from '../../common/dto/pagination.dto';
import { RegleMetierException } from '../../common/exceptions/regle-metier.exception';
import { egaliteConstante, signer } from '../../common/securite/jetons';
import { aujourdhui, versIso } from '../../common/utils/dates';
import type { Environnement } from '../../config/environnement';
import { PrismaService } from '../../prisma/prisma.service';
import { STATUTS_EVALUABLES } from '../inscriptions/inscriptions.regles';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import {
  documentPropose,
  fonctionEmetteur,
  formaterReference,
  motifRefus,
  nomFichierDocument,
  prefixeReference,
  typesGenerables,
  type EtatAcquisition,
} from './documents.regles';
import type {
  BilanDocumentsSessionDto,
  DocumentDto,
  LienTelechargementDto,
  ListeDocumentsQueryDto,
  TelechargementQueryDto,
} from './dto/documents.dto';
import { genererDocumentPdf, type DonneesDocument } from './pdf/gabarit-document';
import { STOCKAGE, type Stockage } from './stockage/stockage';

const SELECTION_DOCUMENT = {
  id: true,
  type: true,
  referenceUnique: true,
  dateGeneration: true,
  inscriptionId: true,
  emetteur: { select: { nom: true, prenom: true } },
  inscription: {
    select: {
      apprenant: { select: { id: true, nom: true, prenom: true } },
      session: {
        select: {
          id: true,
          dateDebut: true,
          dateFin: true,
          formation: { select: { id: true, intitule: true } },
        },
      },
    },
  },
} satisfies Prisma.DocumentSelect;

type LigneDocument = Prisma.DocumentGetPayload<{ select: typeof SELECTION_DOCUMENT }>;

/** Données nécessaires à la génération (contrôle RG-CERT-01 et contenu du PDF). */
const SELECTION_GENERATION = {
  id: true,
  statut: true,
  apprenant: { select: { id: true, nom: true, prenom: true } },
  evaluations: { select: { competenceId: true, acquise: true } },
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
          modalite: true,
          competences: {
            select: {
              competence: { select: { id: true, libelle: true, codeRncp: true } },
            },
            orderBy: { competence: { libelle: 'asc' } },
          },
        },
      },
    },
  },
} satisfies Prisma.InscriptionSelect;

type InscriptionAGenerer = Prisma.InscriptionGetPayload<{ select: typeof SELECTION_GENERATION }>;

const TENTATIVES_REFERENCE = 3;

/** Contenu PDF prêt à être déposé. */
interface FichierGenere {
  cle: string;
  contenu: Buffer;
  empreinte: string;
}

export function empreinteSha256(contenu: Buffer): string {
  return createHash('sha256').update(contenu).digest('hex');
}

/**
 * UC-09 / UC-10 — attestations et certificats (US-19, US-20).
 *
 * - Génération réservée au responsable formation, après contrôle RG-CERT-01.
 * - Chaque PDF porte une référence unique, la date et l'émetteur (RG-CERT-02) ; son empreinte
 *   SHA-256 est enregistrée et vérifiée à chaque téléchargement (OWASP A08).
 * - Téléchargement par URL signée de courte durée (ADR-05), liée à l'utilisateur et revérifiée
 *   contre la portée RBAC au moment du téléchargement.
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly secretUrl: string;
  private readonly dureeUrl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
    @Inject(STOCKAGE) private readonly stockage: Stockage,
    config: ConfigService<Environnement, true>,
  ) {
    this.secretUrl = config.get('DOCUMENT_URL_SECRET', { infer: true });
    this.dureeUrl = config.get('DOCUMENT_URL_TTL_SECONDES', { infer: true });
  }

  // ---------------------------------------------------------------- Lecture

  private versDto(d: LigneDocument): DocumentDto {
    const s = d.inscription.session;
    return {
      id: d.id,
      type: d.type,
      reference: d.referenceUnique,
      dateGeneration: d.dateGeneration,
      inscriptionId: d.inscriptionId,
      apprenant: d.inscription.apprenant,
      formation: s.formation,
      session: { id: s.id, dateDebut: versIso(s.dateDebut), dateFin: versIso(s.dateFin) },
      emetteur: d.emetteur,
    };
  }

  /** Documents visibles selon la portée RBAC (US-20 : « Mes documents » pour l'apprenant). */
  async lister(
    acteur: UtilisateurAuthentifie,
    q: ListeDocumentsQueryDto,
  ): Promise<Page<DocumentDto>> {
    const where: Prisma.DocumentWhereInput = {
      type: q.type,
      inscription: {
        AND: [porteeInscriptions(acteur), { sessionId: q.sessionId, apprenantId: q.apprenantId }],
      },
    };
    const [lignes, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        select: SELECTION_DOCUMENT,
        orderBy: [{ dateGeneration: 'desc' }, { referenceUnique: 'desc' }],
        ...clausePagination(q),
      }),
      this.prisma.document.count({ where }),
    ]);
    return construirePage(
      lignes.map((d) => this.versDto(d)),
      total,
      q,
    );
  }

  private async documentDansPortee(acteur: UtilisateurAuthentifie, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, inscription: porteeInscriptions(acteur) },
      select: { ...SELECTION_DOCUMENT, fichier: true, empreinteSha256: true },
    });
    if (!document) {
      throw new NotFoundException({
        code: 'DOCUMENT_INTROUVABLE',
        message: 'Document introuvable.',
      });
    }
    return document;
  }

  async detail(acteur: UtilisateurAuthentifie, id: string): Promise<DocumentDto> {
    return this.versDto(await this.documentDansPortee(acteur, id));
  }

  // ---------------------------------------------------------------- Téléchargement (ADR-05)

  private signature(documentId: string, utilisateurId: string, expire: number): string {
    return signer(`document:${documentId}:${utilisateurId}:${expire}`, this.secretUrl);
  }

  /** URL signée de courte durée (GET /documents/{id}). */
  async lienTelechargement(
    acteur: UtilisateurAuthentifie,
    id: string,
    maintenant = Date.now(),
  ): Promise<LienTelechargementDto> {
    const document = await this.documentDansPortee(acteur, id);
    const expire = Math.floor(maintenant / 1000) + this.dureeUrl;
    const parametres = new URLSearchParams({
      expire: String(expire),
      u: acteur.id,
      signature: this.signature(id, acteur.id, expire),
    });
    return {
      url: `/api/v1/documents/${id}/fichier?${parametres.toString()}`,
      expireLe: new Date(expire * 1000),
      nomFichier: nomFichierDocument(document.referenceUnique),
    };
  }

  /**
   * Remise du fichier (route publique protégée par la signature) : la signature, l'expiration, le
   * compte et la portée RBAC sont revérifiés, puis l'intégrité du PDF (empreinte SHA-256).
   */
  async fichier(
    id: string,
    q: TelechargementQueryDto,
    maintenant = Date.now(),
  ): Promise<{ contenu: Buffer; nomFichier: string }> {
    const refus = new ForbiddenException({
      code: 'LIEN_INVALIDE',
      message: 'Lien de téléchargement invalide ou expiré. Relancez le téléchargement.',
    });
    if (q.expire * 1000 < maintenant) throw refus;
    if (!egaliteConstante(q.signature, this.signature(id, q.u, q.expire))) throw refus;

    const compte = await this.prisma.utilisateur.findUnique({
      where: { id: q.u },
      select: {
        id: true,
        statutCompte: true,
        mfaActive: true,
        entrepriseId: true,
        role: { select: { code: true } },
      },
    });
    if (
      !compte ||
      compte.statutCompte === StatutCompte.DESACTIVE ||
      compte.statutCompte === StatutCompte.ANONYMISE
    ) {
      throw refus;
    }
    const acteur: UtilisateurAuthentifie = {
      id: compte.id,
      role: compte.role.code,
      entrepriseId: compte.entrepriseId,
      mfaActive: compte.mfaActive,
    };
    const document = await this.documentDansPortee(acteur, id);

    let contenu: Buffer;
    try {
      contenu = await this.stockage.lire(document.fichier);
    } catch (erreur) {
      this.logger.error(`Fichier du document ${id} illisible : ${String(erreur)}`);
      throw new InternalServerErrorException({
        code: 'DOCUMENT_INDISPONIBLE',
        message: 'Le document est momentanément indisponible.',
      });
    }
    if (empreinteSha256(contenu) !== document.empreinteSha256) {
      await this.journal.enregistrerSansBloquer({
        action: ActionJournal.INTEGRITE_DOCUMENT,
        typeObjet: 'document',
        idObjet: id,
        details: `Empreinte SHA-256 non conforme (${document.referenceUnique})`,
        utilisateurId: acteur.id,
      });
      throw new InternalServerErrorException({
        code: 'DOCUMENT_ALTERE',
        message: 'Le document ne peut pas être remis : son intégrité n’est pas vérifiée.',
      });
    }
    await this.journal.enregistrer({
      action: ActionJournal.TELECHARGEMENT_DOCUMENT,
      typeObjet: 'document',
      idObjet: id,
      details: document.referenceUnique,
      utilisateurId: acteur.id,
    });
    return { contenu, nomFichier: nomFichierDocument(document.referenceUnique) };
  }

  // ---------------------------------------------------------------- Génération (UC-09)

  private etat(inscription: InscriptionAGenerer): EtatAcquisition {
    const visees = inscription.session.formation.competences.map((c) => c.competence.id);
    const acquises = new Set(
      inscription.evaluations.filter((e) => e.acquise).map((e) => e.competenceId),
    );
    return {
      statut: inscription.statut,
      competencesVisees: visees.length,
      competencesAcquises: visees.filter((id) => acquises.has(id)).length,
    };
  }

  private async prochainNumero(type: TypeDocument, annee: number): Promise<number> {
    const prefixe = prefixeReference(type, annee);
    const [ligne] = await this.prisma.$queryRaw<{ max: number | null }[]>`
      SELECT max(split_part(reference_unique, '-', 3)::int) AS max
      FROM document
      WHERE reference_unique LIKE ${`${prefixe}%`}`;
    return (ligne?.max ?? 0) + 1;
  }

  private async produirePdf(donnees: DonneesDocument, annee: number): Promise<FichierGenere> {
    const contenu = await genererDocumentPdf(donnees);
    return {
      cle: `documents/${annee}/${randomUUID()}.pdf`,
      contenu,
      empreinte: empreinteSha256(contenu),
    };
  }

  /**
   * Génère un document : contrôle RG-CERT-01, PDF balisé, dépôt dans le stockage, référence en
   * base et journalisation. En cas d'échec, aucun document partiel n'est conservé (UC-09 E1).
   */
  async generer(
    acteur: UtilisateurAuthentifie,
    inscriptionId: string,
    type: TypeDocument,
  ): Promise<DocumentDto> {
    const inscription = await this.prisma.inscription.findFirst({
      where: { AND: [{ id: inscriptionId }, porteeInscriptions(acteur)] },
      select: SELECTION_GENERATION,
    });
    if (!inscription) {
      throw new NotFoundException({
        code: 'INSCRIPTION_INTROUVABLE',
        message: 'Inscription introuvable.',
      });
    }
    const motif = motifRefus(type, this.etat(inscription));
    if (motif) {
      throw new RegleMetierException(
        type === TypeDocument.CERTIFICAT ? 'CERTIFICAT_NON_ELIGIBLE' : 'DOCUMENT_NON_ELIGIBLE',
        motif,
        HttpStatus.CONFLICT,
      );
    }
    const emetteur = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: acteur.id },
      select: { nom: true, prenom: true },
    });

    const dateGeneration = new Date();
    const annee = Number(aujourdhui(dateGeneration).slice(0, 4));
    const acquises = new Set(
      inscription.evaluations.filter((e) => e.acquise).map((e) => e.competenceId),
    );
    const s = inscription.session;
    const base: Omit<DonneesDocument, 'reference'> = {
      type,
      dateGeneration,
      apprenant: inscription.apprenant,
      formation: {
        intitule: s.formation.intitule,
        dureeHeures: s.formation.dureeHeures,
        modalite: s.formation.modalite,
      },
      session: { dateDebut: versIso(s.dateDebut), dateFin: versIso(s.dateFin), lieu: s.lieu },
      competences: s.formation.competences.map(({ competence: c }) => ({
        libelle: c.libelle,
        codeRncp: c.codeRncp,
        acquise: acquises.has(c.id),
      })),
      emetteur: { ...emetteur, fonction: fonctionEmetteur(acteur.role) },
    };

    // Numérotation optimiste : la contrainte d'unicité tranche en cas de générations simultanées.
    for (let tentative = 1; tentative <= TENTATIVES_REFERENCE; tentative++) {
      const reference = formaterReference(type, annee, await this.prochainNumero(type, annee));
      let fichier: FichierGenere;
      try {
        fichier = await this.produirePdf({ ...base, reference }, annee);
        await this.stockage.deposer(fichier.cle, fichier.contenu, 'application/pdf');
      } catch (erreur) {
        this.logger.error(`Échec de génération du PDF ${reference} : ${String(erreur)}`);
        throw new InternalServerErrorException({
          code: 'GENERATION_ECHOUEE',
          message: 'La génération du document a échoué. Vous pouvez relancer l’opération.',
        });
      }
      try {
        const cree = await this.prisma.$transaction(async (tx) => {
          const d = await tx.document.create({
            data: {
              inscriptionId,
              type,
              referenceUnique: reference,
              dateGeneration,
              emetteurId: acteur.id,
              fichier: fichier.cle,
              empreinteSha256: fichier.empreinte,
            },
            select: SELECTION_DOCUMENT,
          });
          await this.journal.enregistrer(
            {
              action: ActionJournal.GENERATION_DOCUMENT,
              typeObjet: 'document',
              idObjet: d.id,
              details: `${type} ${reference} — inscription ${inscriptionId}`,
            },
            tx,
          );
          return d;
        });
        return this.versDto(cree);
      } catch (erreur) {
        // Aucun fichier orphelin : le dépôt est annulé si l'enregistrement échoue.
        await this.stockage.supprimer(fichier.cle).catch(() => undefined);
        const conflitReference =
          erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002';
        if (!conflitReference || tentative === TENTATIVES_REFERENCE) throw erreur;
      }
    }
    throw new InternalServerErrorException({
      code: 'GENERATION_ECHOUEE',
      message: 'La génération du document a échoué. Vous pouvez relancer l’opération.',
    });
  }

  // ---------------------------------------------------------------- Écran 14

  /** Bilan de génération d'une session : éligibilité RG-CERT-01 et documents déjà émis. */
  async bilanSession(
    acteur: UtilisateurAuthentifie,
    sessionId: string,
  ): Promise<BilanDocumentsSessionDto> {
    const session = await this.prisma.session.findFirst({
      where: { AND: [{ id: sessionId }, porteeSessions(acteur)] },
      select: {
        id: true,
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
    });
    if (!session) {
      throw new NotFoundException({ code: 'SESSION_INTROUVABLE', message: 'Session introuvable.' });
    }
    const visees = new Set(session.formation.competences.map((c) => c.competenceId));
    const inscriptions = await this.prisma.inscription.findMany({
      where: { sessionId, statut: { in: STATUTS_EVALUABLES } },
      select: {
        id: true,
        statut: true,
        apprenant: { select: { id: true, nom: true, prenom: true } },
        evaluations: { where: { acquise: true }, select: { competenceId: true } },
        documents: {
          select: { id: true, type: true, referenceUnique: true, dateGeneration: true },
          orderBy: { dateGeneration: 'desc' },
        },
      },
      orderBy: [{ apprenant: { nom: 'asc' } }, { apprenant: { prenom: 'asc' } }],
    });

    return {
      session: {
        id: session.id,
        dateDebut: versIso(session.dateDebut),
        dateFin: versIso(session.dateFin),
        terminee: versIso(session.dateFin) < aujourdhui(),
        formation: { id: session.formation.id, intitule: session.formation.intitule },
      },
      peutGenerer: acteur.role === CodeRole.RESP_FORMATION,
      lignes: inscriptions.map((i) => {
        const etat: EtatAcquisition = {
          statut: i.statut,
          competencesVisees: visees.size,
          competencesAcquises: i.evaluations.filter((e) => visees.has(e.competenceId)).length,
        };
        return {
          inscriptionId: i.id,
          statut: i.statut,
          apprenant: i.apprenant,
          competencesAcquises: etat.competencesAcquises,
          competencesVisees: etat.competencesVisees,
          typesGenerables: typesGenerables(etat),
          documentPropose: documentPropose(etat),
          documents: i.documents.map((d) => ({
            id: d.id,
            type: d.type,
            reference: d.referenceUnique,
            dateGeneration: d.dateGeneration,
          })),
        };
      }),
    };
  }

  // ---------------------------------------------------------------- RGPD (RG-CPT-02)

  /**
   * Nettoyeur appelé lors de l'anonymisation d'un apprenant : ses PDF nominatifs sont remplacés
   * par une version anonymisée (les documents restent comptés dans les indicateurs, RG-DASH-01).
   * Les anciens fichiers deviennent orphelins et sont purgés par la tâche de conservation.
   */
  async anonymiserDocuments(apprenantId: string, tx: Prisma.TransactionClient): Promise<void> {
    const documents = await tx.document.findMany({
      where: { inscription: { apprenantId } },
      select: {
        id: true,
        type: true,
        referenceUnique: true,
        dateGeneration: true,
        emetteur: { select: { nom: true, prenom: true, role: { select: { code: true } } } },
        inscription: { select: SELECTION_GENERATION },
      },
    });
    for (const d of documents) {
      const s = d.inscription.session;
      const acquises = new Set(
        d.inscription.evaluations.filter((e) => e.acquise).map((e) => e.competenceId),
      );
      const annee = Number(aujourdhui(d.dateGeneration).slice(0, 4));
      const fichier = await this.produirePdf(
        {
          type: d.type,
          reference: d.referenceUnique,
          dateGeneration: d.dateGeneration,
          apprenant: { prenom: 'Compte', nom: 'Anonyme' },
          formation: {
            intitule: s.formation.intitule,
            dureeHeures: s.formation.dureeHeures,
            modalite: s.formation.modalite,
          },
          session: { dateDebut: versIso(s.dateDebut), dateFin: versIso(s.dateFin), lieu: s.lieu },
          competences: s.formation.competences.map(({ competence: c }) => ({
            libelle: c.libelle,
            codeRncp: c.codeRncp,
            acquise: acquises.has(c.id),
          })),
          emetteur: {
            nom: d.emetteur.nom,
            prenom: d.emetteur.prenom,
            fonction: fonctionEmetteur(d.emetteur.role.code),
          },
        },
        annee,
      );
      await this.stockage.deposer(fichier.cle, fichier.contenu, 'application/pdf');
      await tx.document.update({
        where: { id: d.id },
        data: { fichier: fichier.cle, empreinteSha256: fichier.empreinte },
      });
    }
  }
}
