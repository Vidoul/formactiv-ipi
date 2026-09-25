import { CodeRole, FinaliteConsentement, StatutCompte } from '@prisma/client';
import { authenticator } from 'otplib';
import request from 'supertest';
import { chiffrer } from '../../src/common/securite/chiffrement';
import { hacherMotDePasse } from '../../src/common/securite/hachage';
import { JetonsService } from '../../src/modules/auth/jetons.service';
import type { ContexteTest } from './application';

/** Mot de passe conforme à RG-AUTH-01 utilisé par les comptes de test. */
export const MOT_DE_PASSE_TEST = 'Tr0mpette!Verte-Soir';

export interface UtilisateurTest {
  id: string;
  email: string;
  role: CodeRole;
  motDePasse: string;
  secretMfa?: string;
  entrepriseId: string | null;
}

let compteur = 0;

/**
 * Crée un compte de test. Les rôles soumis à la MFA obligatoire (ADMIN, RESP_FORMATION) reçoivent
 * un secret TOTP par défaut, comme en conditions réelles.
 */
export async function creerUtilisateur(
  ctx: ContexteTest,
  role: CodeRole,
  options: {
    email?: string;
    nom?: string;
    prenom?: string;
    entrepriseId?: string | null;
    mfa?: boolean;
    motDePasse?: string | null;
    statut?: StatutCompte;
  } = {},
): Promise<UtilisateurTest> {
  compteur += 1;
  const email = options.email ?? `${role.toLowerCase()}.${compteur}@test.formactiv.fr`;
  const avecMfa = options.mfa ?? (role === CodeRole.ADMIN || role === CodeRole.RESP_FORMATION);
  const secretMfa = avecMfa ? authenticator.generateSecret(20) : undefined;
  const motDePasse = options.motDePasse === undefined ? MOT_DE_PASSE_TEST : options.motDePasse;
  const roleEnBase = await ctx.prisma.role.findUniqueOrThrow({ where: { code: role } });

  const cree = await ctx.prisma.utilisateur.create({
    data: {
      email,
      nom: options.nom ?? `Nom${compteur}`,
      prenom: options.prenom ?? `Prenom${compteur}`,
      motDePasseHash: motDePasse ? await hacherMotDePasse(motDePasse) : null,
      roleId: roleEnBase.id,
      entrepriseId: options.entrepriseId ?? null,
      statutCompte: options.statut ?? StatutCompte.ACTIF,
      mfaActive: avecMfa,
      mfaSecretChiffre: secretMfa ? chiffrer(secretMfa, process.env.MFA_ENCRYPTION_KEY!) : null,
      consentements: {
        create: { finalite: FinaliteConsentement.GESTION_COMPTE, versionMentions: 'v2.1' },
      },
    },
  });
  return {
    id: cree.id,
    email,
    role,
    motDePasse: motDePasse ?? '',
    secretMfa,
    entrepriseId: cree.entrepriseId,
  };
}

/** En-tête Authorization pour un utilisateur, sans passer par le parcours de connexion. */
export function autorisation(ctx: ContexteTest, u: { id: string; role: CodeRole }): string {
  return `Bearer ${ctx.app.get(JetonsService).emettreAcces(u)}`;
}

export function codeMfa(secret: string): string {
  return authenticator.generate(secret);
}

/** Extrait la valeur du cookie de refresh d'une réponse. */
export function cookieRefresh(reponse: request.Response): string | undefined {
  const cookies = ([] as string[]).concat(reponse.headers['set-cookie'] ?? []);
  return cookies.find((c) => c.startsWith('formactiv_refresh='))?.split(';')[0];
}

export async function creerEntreprise(ctx: ContexteTest, raisonSociale = 'Groupe Oxalys') {
  return ctx.prisma.entrepriseCliente.create({
    data: {
      raisonSociale,
      emailContact: `contact@${raisonSociale.replace(/\W/g, '').toLowerCase()}.fr`,
    },
  });
}
