import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  FinaliteConsentement,
  Prisma,
  StatutCompte,
  TypeJeton,
  type CodeRole,
} from '@prisma/client';
import { RegleMetierException } from '../../common/exceptions/regle-metier.exception';
import {
  hacherMotDePasse,
  obtenirHashLeurre,
  verifierMotDePasse,
} from '../../common/securite/hachage';
import { empreinte, genererJeton } from '../../common/securite/jetons';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import { MailService } from '../mail/mail.service';
import { ParametresService } from '../parametres/parametres.service';
import { JetonsService, type RefreshEmis } from './jetons.service';
import { MfaService } from './mfa.service';
import { MotDePasseService } from './mot-de-passe.service';
import {
  apresEchec,
  apresSucces,
  estVerrouille,
  etatApresExpiration,
  minutesRestantes,
} from './regles/verrouillage';

/** Durées de validité des liens à usage unique (RG-AUTH-04 : 30 min pour la réinitialisation). */
const VALIDITE_REINITIALISATION_MS = 30 * 60_000;
const VALIDITE_ACTIVATION_MS = 72 * 3_600_000;

export interface ProfilUtilisateur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: CodeRole;
  mfaActive: boolean;
  mfaEnrolementRequis: boolean;
  entreprise: { id: string; raisonSociale: string } | null;
}

export interface SessionOuverte {
  accessToken: string;
  expireDans: number;
  refresh: RefreshEmis;
  utilisateur: ProfilUtilisateur;
}

export type ResultatConnexion =
  ({ type: 'CONNECTE' } & SessionOuverte) | { type: 'MFA_REQUIS'; jetonMfa: string };

const SELECTION_COMPTE = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  motDePasseHash: true,
  mfaActive: true,
  mfaSecretChiffre: true,
  mfaDernierPas: true,
  statutCompte: true,
  tentativesEchouees: true,
  verrouilleJusquA: true,
  role: { select: { code: true } },
  entreprise: { select: { id: true, raisonSociale: true } },
} satisfies Prisma.UtilisateurSelect;

type Compte = Prisma.UtilisateurGetPayload<{ select: typeof SELECTION_COMPTE }>;

const identifiantsInvalides = () =>
  new UnauthorizedException({
    code: 'IDENTIFIANTS_INVALIDES',
    // Message générique : ne révèle pas si l'email existe (UC-01 A1, anti-énumération).
    message: 'Adresse email ou mot de passe incorrect.',
  });

export function normaliserEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Authentification (UC-01), récupération de mot de passe (UC-02), activation de compte avec
 * consentement explicite (RG-RGPD-01) et gestion de la double authentification (US-04).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jetons: JetonsService,
    private readonly mfa: MfaService,
    private readonly motsDePasse: MotDePasseService,
    private readonly parametres: ParametresService,
    private readonly journal: JournalService,
    private readonly mail: MailService,
  ) {}

  // ---------------------------------------------------------------------------------------------
  // UC-01 — S'authentifier
  // ---------------------------------------------------------------------------------------------

  async connecter(email: string, motDePasse: string): Promise<ResultatConnexion> {
    const compte = await this.prisma.utilisateur.findUnique({
      where: { email: normaliserEmail(email) },
      select: SELECTION_COMPTE,
    });

    // E1 — compte inconnu, non activé, désactivé ou anonymisé : même réponse, même coût de calcul.
    if (
      !compte ||
      !compte.motDePasseHash ||
      compte.statutCompte === StatutCompte.DESACTIVE ||
      compte.statutCompte === StatutCompte.ANONYMISE
    ) {
      await verifierMotDePasse(await obtenirHashLeurre(), motDePasse);
      await this.journal.enregistrer({
        action: ActionJournal.CONNEXION_ECHOUEE,
        utilisateurId: null,
        typeObjet: 'utilisateur',
        idObjet: compte?.id,
        details: compte ? 'Compte inactif ou non activé' : 'Compte inconnu',
      });
      throw identifiantsInvalides();
    }

    this.refuserSiVerrouille(compte);

    if (!(await verifierMotDePasse(compte.motDePasseHash, motDePasse))) {
      await this.enregistrerEchec(
        compte,
        ActionJournal.CONNEXION_ECHOUEE,
        'Mot de passe incorrect',
      );
      throw identifiantsInvalides();
    }

    if (compte.mfaActive && compte.mfaSecretChiffre) {
      return { type: 'MFA_REQUIS', jetonMfa: this.jetons.emettreJetonMfa(compte.id) };
    }
    return { type: 'CONNECTE', ...(await this.ouvrirSession(compte)) };
  }

  /** Étape 3 de UC-01 : vérification du second facteur (code TOTP). */
  async verifierMfa(jetonMfa: string, code: string): Promise<SessionOuverte> {
    const utilisateurId = await this.jetons.verifierJetonMfa(jetonMfa);
    const compte = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: SELECTION_COMPTE,
    });
    if (!compte || !compte.mfaActive || !compte.mfaSecretChiffre) throw identifiantsInvalides();
    if (
      compte.statutCompte === StatutCompte.DESACTIVE ||
      compte.statutCompte === StatutCompte.ANONYMISE
    ) {
      throw identifiantsInvalides();
    }
    this.refuserSiVerrouille(compte);

    const pas = this.mfa.verifierCode(compte.mfaSecretChiffre, code, compte.mfaDernierPas);
    if (pas === null) {
      await this.enregistrerEchec(compte, ActionJournal.MFA_ECHEC, 'Code de vérification invalide');
      throw new UnauthorizedException({
        code: 'CODE_MFA_INVALIDE',
        message: 'Code de vérification invalide.',
      });
    }
    await this.prisma.utilisateur.update({
      where: { id: compte.id },
      data: { mfaDernierPas: pas },
    });
    return this.ouvrirSession(compte);
  }

  private refuserSiVerrouille(compte: Compte): void {
    const maintenant = new Date();
    if (estVerrouille(compte, maintenant)) {
      const minutes = minutesRestantes(compte, maintenant);
      throw new RegleMetierException(
        'COMPTE_VERROUILLE',
        `Compte temporairement verrouillé suite à plusieurs échecs. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
        HttpStatus.LOCKED,
        { minutesRestantes: minutes },
      );
    }
  }

  /** RG-AUTH-02 : compte les échecs et verrouille temporairement au seuil paramétré. */
  private async enregistrerEchec(
    compte: Compte,
    action: ActionJournal,
    details: string,
  ): Promise<void> {
    const regles = await this.parametres.reglesVerrouillage();
    const etat = apresEchec(compte, regles, new Date());
    await this.prisma.$transaction(async (tx) => {
      await tx.utilisateur.update({
        where: { id: compte.id },
        data: {
          statutCompte: etat.statutCompte,
          tentativesEchouees: etat.tentativesEchouees,
          verrouilleJusquA: etat.verrouilleJusquA,
        },
      });
      await this.journal.enregistrer(
        { action, utilisateurId: null, typeObjet: 'utilisateur', idObjet: compte.id, details },
        tx,
      );
      if (etat.vientDEtreVerrouille) {
        await this.journal.enregistrer(
          {
            action: ActionJournal.VERROUILLAGE_COMPTE,
            utilisateurId: null,
            typeObjet: 'utilisateur',
            idObjet: compte.id,
            details: `${etat.tentativesEchouees} échecs de connexion — verrouillage ${regles.dureeMinutes} min`,
          },
          tx,
        );
      }
    });
    if (etat.vientDEtreVerrouille) {
      throw new RegleMetierException(
        'COMPTE_VERROUILLE',
        `Compte temporairement verrouillé pour ${regles.dureeMinutes} minutes suite à ${regles.tentativesMax} échecs.`,
        HttpStatus.LOCKED,
        { minutesRestantes: regles.dureeMinutes },
      );
    }
  }

  private async ouvrirSession(compte: Compte): Promise<SessionOuverte> {
    const etat = apresSucces(etatApresExpiration(compte, new Date()));
    const refresh = await this.prisma.$transaction(async (tx) => {
      await tx.utilisateur.update({
        where: { id: compte.id },
        data: { ...etat, dateDerniereConnexion: new Date() },
      });
      await this.journal.enregistrer(
        { action: ActionJournal.CONNEXION_REUSSIE, utilisateurId: compte.id },
        tx,
      );
      return this.jetons.creerRefresh(compte.id, undefined, tx);
    });
    return {
      accessToken: this.jetons.emettreAcces({ id: compte.id, role: compte.role.code }),
      expireDans: this.jetons.dureeAccesSecondes,
      refresh,
      utilisateur: await this.versProfil(compte),
    };
  }

  /** Renouvelle l'access token à partir du refresh token (rotation systématique). */
  async rafraichir(jetonRefresh: string): Promise<SessionOuverte> {
    const rotation = await this.jetons.tournerRefresh(jetonRefresh);
    const compte = await this.prisma.utilisateur.findUnique({
      where: { id: rotation.utilisateurId },
      select: SELECTION_COMPTE,
    });
    if (
      !compte ||
      compte.statutCompte === StatutCompte.DESACTIVE ||
      compte.statutCompte === StatutCompte.ANONYMISE
    ) {
      await this.jetons.revoquerToutesLesSessions(rotation.utilisateurId);
      throw new UnauthorizedException({ code: 'SESSION_INVALIDE', message: 'Session invalide.' });
    }
    return {
      accessToken: this.jetons.emettreAcces({ id: compte.id, role: compte.role.code }),
      expireDans: this.jetons.dureeAccesSecondes,
      refresh: rotation,
      utilisateur: await this.versProfil(compte),
    };
  }

  async deconnecter(jetonRefresh: string | undefined): Promise<void> {
    if (!jetonRefresh) return;
    const utilisateurId = await this.jetons.revoquerRefresh(jetonRefresh);
    if (utilisateurId) {
      await this.journal.enregistrer({ action: ActionJournal.DECONNEXION, utilisateurId });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // UC-02 — Récupérer son mot de passe (RG-AUTH-04) et activation de compte
  // ---------------------------------------------------------------------------------------------

  /** Toujours la même réponse, que le compte existe ou non (anti-énumération). */
  async demanderReinitialisation(email: string): Promise<void> {
    const compte = await this.prisma.utilisateur.findUnique({
      where: { email: normaliserEmail(email) },
      select: { id: true, prenom: true, email: true, statutCompte: true, motDePasseHash: true },
    });
    if (
      !compte ||
      !compte.motDePasseHash ||
      compte.statutCompte === StatutCompte.DESACTIVE ||
      compte.statutCompte === StatutCompte.ANONYMISE
    ) {
      return;
    }
    const jeton = await this.creerJetonUsageUnique(compte.id, TypeJeton.REINITIALISATION);
    await this.journal.enregistrer({
      action: ActionJournal.REINITIALISATION_DEMANDEE,
      utilisateurId: compte.id,
      typeObjet: 'utilisateur',
      idObjet: compte.id,
    });
    this.mail.envoyerEnArrierePlan(
      this.mail.messageReinitialisation(compte.email, compte.prenom, jeton),
    );
  }

  /**
   * Crée un jeton à usage unique ; les jetons précédents du même type sont invalidés
   * (seul le dernier lien envoyé fonctionne).
   */
  async creerJetonUsageUnique(
    utilisateurId: string,
    type: TypeJeton,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = tx ?? this.prisma;
    const jeton = genererJeton();
    const maintenant = new Date();
    await client.jetonUsageUnique.updateMany({
      where: { utilisateurId, type, dateUtilisation: null },
      data: { dateUtilisation: maintenant },
    });
    await client.jetonUsageUnique.create({
      data: {
        utilisateurId,
        type,
        empreinte: empreinte(jeton),
        dateExpiration: new Date(
          maintenant.getTime() +
            (type === TypeJeton.REINITIALISATION
              ? VALIDITE_REINITIALISATION_MS
              : VALIDITE_ACTIVATION_MS),
        ),
      },
    });
    return jeton;
  }

  private async consommerJeton(jeton: string, type: TypeJeton, tx: Prisma.TransactionClient) {
    const trouve = await tx.jetonUsageUnique.findUnique({
      where: { empreinte: empreinte(jeton) },
      include: {
        utilisateur: {
          select: { id: true, nom: true, prenom: true, email: true, statutCompte: true },
        },
      },
    });
    const invalide =
      !trouve ||
      trouve.type !== type ||
      trouve.dateUtilisation !== null ||
      trouve.dateExpiration <= new Date() ||
      trouve.utilisateur.statutCompte === StatutCompte.ANONYMISE ||
      trouve.utilisateur.statutCompte === StatutCompte.DESACTIVE;
    if (invalide) {
      throw new RegleMetierException(
        'LIEN_INVALIDE',
        'Ce lien est invalide, a expiré ou a déjà été utilisé.',
        HttpStatus.BAD_REQUEST,
      );
    }
    // Marquage conditionnel : un même lien ne peut pas être consommé deux fois en parallèle.
    const marque = await tx.jetonUsageUnique.updateMany({
      where: { id: trouve.id, dateUtilisation: null },
      data: { dateUtilisation: new Date() },
    });
    if (marque.count === 0) {
      throw new RegleMetierException(
        'LIEN_INVALIDE',
        'Ce lien a déjà été utilisé.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return trouve.utilisateur;
  }

  async reinitialiser(jeton: string, motDePasse: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const utilisateur = await this.consommerJeton(jeton, TypeJeton.REINITIALISATION, tx);
      await this.motsDePasse.valider(motDePasse, utilisateur);
      await this.definirMotDePasse(utilisateur.id, motDePasse, tx);
      await this.journal.enregistrer(
        {
          action: ActionJournal.MOT_DE_PASSE_MODIFIE,
          utilisateurId: utilisateur.id,
          typeObjet: 'utilisateur',
          idObjet: utilisateur.id,
          details: 'Réinitialisation par lien à usage unique',
        },
        tx,
      );
    });
  }

  /** Activation d'un compte créé par un administrateur : mot de passe + consentements. */
  async activer(jeton: string, motDePasse: string, satisfaction: boolean): Promise<void> {
    const version = await this.parametres.versionMentions();
    await this.prisma.$transaction(async (tx) => {
      const utilisateur = await this.consommerJeton(jeton, TypeJeton.ACTIVATION, tx);
      await this.motsDePasse.valider(motDePasse, utilisateur);
      await this.definirMotDePasse(utilisateur.id, motDePasse, tx);

      // RG-RGPD-01 : consentement explicite, horodaté et conservé comme preuve.
      const finalites = [
        FinaliteConsentement.GESTION_COMPTE,
        ...(satisfaction ? [FinaliteConsentement.QUESTIONNAIRES_SATISFACTION] : []),
      ];
      for (const finalite of finalites) {
        await tx.consentement.create({
          data: { utilisateurId: utilisateur.id, finalite, versionMentions: version },
        });
        await this.journal.enregistrer(
          {
            action: ActionJournal.CONSENTEMENT_DONNE,
            utilisateurId: utilisateur.id,
            typeObjet: 'consentement',
            details: `${finalite} (mentions ${version})`,
          },
          tx,
        );
      }
      await this.journal.enregistrer(
        {
          action: ActionJournal.ACTIVATION_COMPTE,
          utilisateurId: utilisateur.id,
          typeObjet: 'utilisateur',
          idObjet: utilisateur.id,
        },
        tx,
      );
    });
  }

  private async definirMotDePasse(
    utilisateurId: string,
    motDePasse: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.utilisateur.update({
      where: { id: utilisateurId },
      data: {
        motDePasseHash: await hacherMotDePasse(motDePasse),
        statutCompte: StatutCompte.ACTIF,
        tentativesEchouees: 0,
        verrouilleJusquA: null,
      },
    });
    // Toute session ouverte avec l'ancien mot de passe est fermée.
    await this.jetons.revoquerToutesLesSessions(utilisateurId, tx);
  }

  async changerMotDePasse(utilisateurId: string, actuel: string, nouveau: string): Promise<void> {
    const compte = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: utilisateurId },
      select: { id: true, nom: true, prenom: true, email: true, motDePasseHash: true },
    });
    if (!compte.motDePasseHash || !(await verifierMotDePasse(compte.motDePasseHash, actuel))) {
      throw new RegleMetierException(
        'MOT_DE_PASSE_ACTUEL_INCORRECT',
        'Le mot de passe actuel est incorrect.',
        HttpStatus.BAD_REQUEST,
        [{ champ: 'motDePasseActuel', messages: ['Le mot de passe actuel est incorrect.'] }],
      );
    }
    await this.motsDePasse.valider(nouveau, compte);
    await this.prisma.$transaction(async (tx) => {
      await this.definirMotDePasse(compte.id, nouveau, tx);
      await this.journal.enregistrer(
        {
          action: ActionJournal.MOT_DE_PASSE_MODIFIE,
          typeObjet: 'utilisateur',
          idObjet: compte.id,
          details: 'Changement par l’utilisateur',
        },
        tx,
      );
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Profil et double authentification (US-04, RG-AUTH-03)
  // ---------------------------------------------------------------------------------------------

  async profil(utilisateurId: string): Promise<ProfilUtilisateur> {
    const compte = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: SELECTION_COMPTE,
    });
    if (!compte) throw new NotFoundException();
    return this.versProfil(compte);
  }

  private async versProfil(compte: Compte): Promise<ProfilUtilisateur> {
    const rolesMfa = await this.parametres.rolesMfaObligatoire();
    return {
      id: compte.id,
      nom: compte.nom,
      prenom: compte.prenom,
      email: compte.email,
      role: compte.role.code,
      mfaActive: compte.mfaActive,
      mfaEnrolementRequis: !compte.mfaActive && rolesMfa.includes(compte.role.code),
      entreprise: compte.entreprise,
    };
  }

  async demarrerEnrolementMfa(utilisateurId: string) {
    const compte = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: utilisateurId },
      select: { email: true, mfaActive: true },
    });
    if (compte.mfaActive) {
      throw new RegleMetierException(
        'MFA_DEJA_ACTIVE',
        'La double authentification est déjà active.',
      );
    }
    const enrolement = await this.mfa.preparerEnrolement(compte.email);
    // Le secret reste inactif tant que l'utilisateur n'a pas confirmé un premier code.
    await this.prisma.utilisateur.update({
      where: { id: utilisateurId },
      data: { mfaSecretChiffre: enrolement.secretChiffre, mfaDernierPas: null },
    });
    return { secret: enrolement.secret, uri: enrolement.uri, qrCode: enrolement.qrCode };
  }

  async confirmerEnrolementMfa(utilisateurId: string, code: string): Promise<ProfilUtilisateur> {
    const compte = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: utilisateurId },
      select: { mfaActive: true, mfaSecretChiffre: true },
    });
    if (compte.mfaActive) {
      throw new RegleMetierException(
        'MFA_DEJA_ACTIVE',
        'La double authentification est déjà active.',
      );
    }
    if (!compte.mfaSecretChiffre) {
      throw new RegleMetierException('MFA_NON_INITIALISEE', "Démarrez d'abord la configuration.");
    }
    const pas = this.mfa.verifierCode(compte.mfaSecretChiffre, code, null);
    if (pas === null) {
      throw new RegleMetierException(
        'CODE_MFA_INVALIDE',
        'Code de vérification invalide.',
        HttpStatus.BAD_REQUEST,
        [{ champ: 'code', messages: ['Code de vérification invalide.'] }],
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.utilisateur.update({
        where: { id: utilisateurId },
        data: { mfaActive: true, mfaDernierPas: pas },
      });
      await this.journal.enregistrer(
        { action: ActionJournal.MFA_ACTIVATION, typeObjet: 'utilisateur', idObjet: utilisateurId },
        tx,
      );
    });
    return this.profil(utilisateurId);
  }

  async desactiverMfa(
    utilisateurId: string,
    motDePasse: string,
    code: string,
  ): Promise<ProfilUtilisateur> {
    const compte = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: utilisateurId },
      select: SELECTION_COMPTE,
    });
    const rolesMfa = await this.parametres.rolesMfaObligatoire();
    if (rolesMfa.includes(compte.role.code)) {
      throw new ForbiddenException({
        code: 'MFA_OBLIGATOIRE',
        message: 'La double authentification est obligatoire pour votre profil.',
      });
    }
    const pas =
      compte.mfaSecretChiffre &&
      this.mfa.verifierCode(compte.mfaSecretChiffre, code, compte.mfaDernierPas);
    if (
      !compte.motDePasseHash ||
      !(await verifierMotDePasse(compte.motDePasseHash, motDePasse)) ||
      !pas
    ) {
      throw new RegleMetierException(
        'VERIFICATION_ECHOUEE',
        'Mot de passe ou code de vérification incorrect.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.utilisateur.update({
        where: { id: utilisateurId },
        data: { mfaActive: false, mfaSecretChiffre: null, mfaDernierPas: null },
      });
      await this.journal.enregistrer(
        {
          action: ActionJournal.MFA_DESACTIVATION,
          typeObjet: 'utilisateur',
          idObjet: utilisateurId,
        },
        tx,
      );
    });
    return this.profil(utilisateurId);
  }
}
