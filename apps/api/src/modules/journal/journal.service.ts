import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { contexteRequete } from '../../common/context/contexte-requete';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActionJournal } from './actions-journal';

export interface EntreeJournal {
  action: ActionJournal;
  typeObjet?: string;
  idObjet?: string;
  /** Contexte lisible. Ne JAMAIS y placer de mot de passe, jeton ou donnée sensible. */
  details?: string;
  /** Par défaut : l'utilisateur authentifié du contexte de requête (null = système). */
  utilisateurId?: string | null;
}

type ClientTransaction = Prisma.TransactionClient;

/** Motifs retirés des détails par sécurité (défense en profondeur, chapitre 10 §4). */
const MOTIFS_INTERDITS = [
  /\$argon2[^\s]*/gi,
  /eyJ[\w-]+\.[\w-]+\.[\w-]+/g, // JWT
  /(mot[_ ]?de[_ ]?passe|password|jeton|token)\s*[:=]\s*\S+/gi,
];

export function assainirDetails(details?: string): string | undefined {
  if (!details) return undefined;
  const nettoye = MOTIFS_INTERDITS.reduce(
    (texte, motif) => texte.replace(motif, '[masqué]'),
    details,
  );
  return nettoye.slice(0, 500);
}

/**
 * Journal des actions sensibles (REQ-SEC-004, RG-LOG-01) : qui, quoi, quand, sur quel objet.
 *
 * - Écriture seule : ce service n'expose aucune méthode de modification ; la base l'impose en
 *   plus par trigger (migration initiale).
 * - Passer le client de transaction `tx` pour rendre l'entrée atomique avec l'action métier.
 */
@Injectable()
export class JournalService {
  private readonly logger = new Logger(JournalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enregistrer(entree: EntreeJournal, tx?: ClientTransaction): Promise<void> {
    const ctx = contexteRequete.courant();
    const client = tx ?? this.prisma;
    await client.journalAction.create({
      data: {
        action: entree.action,
        typeObjet: entree.typeObjet,
        idObjet: entree.idObjet,
        details: assainirDetails(entree.details),
        utilisateurId:
          entree.utilisateurId === undefined ? ctx?.utilisateurId : entree.utilisateurId,
        adresseIp: ctx?.ip?.slice(0, 45),
      },
    });
  }

  /**
   * Variante « au mieux » pour les événements hors transaction métier (ex. accès refusé) :
   * un échec d'écriture est tracé dans les logs techniques sans masquer la réponse d'origine.
   */
  async enregistrerSansBloquer(entree: EntreeJournal): Promise<void> {
    try {
      await this.enregistrer(entree);
    } catch (erreur) {
      this.logger.error(`Échec de journalisation ${entree.action} : ${String(erreur)}`);
    }
  }
}
