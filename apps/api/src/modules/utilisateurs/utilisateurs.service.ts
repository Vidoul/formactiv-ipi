import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CodeRole, Prisma, StatutCompte, TypeJeton } from '@prisma/client';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { clausePagination, construirePage, type Page } from '../../common/dto/pagination.dto';
import { RegleMetierException } from '../../common/exceptions/regle-metier.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { JetonsService } from '../auth/jetons.service';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import { MailService } from '../mail/mail.service';
import { AnonymisationService } from './anonymisation.service';
import { controlerRattachement, peutGererCompte } from './comptes.regles';
import type {
  CreationUtilisateurDto,
  ListeUtilisateursQueryDto,
  ModificationUtilisateurDto,
  UtilisateurDetailDto,
  UtilisateurResumeDto,
} from './dto/utilisateurs.dto';

const SELECTION = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  statutCompte: true,
  mfaActive: true,
  motDePasseHash: true,
  verrouilleJusquA: true,
  dateDerniereConnexion: true,
  dateCreation: true,
  entrepriseId: true,
  role: { select: { code: true } },
  entreprise: { select: { id: true, raisonSociale: true } },
} satisfies Prisma.UtilisateurSelect;

type Ligne = Prisma.UtilisateurGetPayload<{ select: typeof SELECTION }>;

function versResume(u: Ligne): UtilisateurResumeDto {
  return {
    id: u.id,
    nom: u.nom,
    prenom: u.prenom,
    email: u.email,
    role: u.role.code,
    statut: u.statutCompte,
    entreprise: u.entreprise,
  };
}

function versDetail(u: Ligne): UtilisateurDetailDto {
  return {
    ...versResume(u),
    mfaActive: u.mfaActive,
    active: u.motDePasseHash !== null,
    verrouilleJusquA: u.verrouilleJusquA,
    dateDerniereConnexion: u.dateDerniereConnexion,
    dateCreation: u.dateCreation,
  };
}

/**
 * Portée des comptes visibles (matrice RBAC, ligne « Comptes utilisateurs ») :
 * tous (admin, responsable), apprenants de ses sessions (formateur), salariés de son entreprise
 * (client entreprise), soi-même (apprenant).
 */
export function porteeUtilisateurs(acteur: UtilisateurAuthentifie): Prisma.UtilisateurWhereInput {
  switch (acteur.role) {
    case CodeRole.ADMIN:
    case CodeRole.RESP_FORMATION:
      return {};
    case CodeRole.FORMATEUR:
      return {
        role: { code: CodeRole.APPRENANT },
        inscriptions: { some: { session: { animations: { some: { formateurId: acteur.id } } } } },
      };
    case CodeRole.CLIENT_ENTREPRISE:
      return acteur.entrepriseId
        ? { role: { code: CodeRole.APPRENANT }, entrepriseId: acteur.entrepriseId }
        : { id: { in: [] } };
    case CodeRole.APPRENANT:
      return { id: acteur.id };
  }
}

/** UC-03 — Gérer les comptes et les rôles (US-01, US-02). */
@Injectable()
export class UtilisateursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
    private readonly auth: AuthService,
    private readonly jetons: JetonsService,
    private readonly mail: MailService,
    private readonly anonymisation: AnonymisationService,
  ) {}

  async lister(
    acteur: UtilisateurAuthentifie,
    q: ListeUtilisateursQueryDto,
  ): Promise<Page<UtilisateurResumeDto>> {
    const where: Prisma.UtilisateurWhereInput = {
      AND: [
        porteeUtilisateurs(acteur),
        q.role ? { role: { code: q.role } } : {},
        q.entrepriseId ? { entrepriseId: q.entrepriseId } : {},
        q.statut ? { statutCompte: q.statut } : {},
        q.recherche
          ? {
              OR: [
                { nom: { contains: q.recherche, mode: 'insensitive' } },
                { prenom: { contains: q.recherche, mode: 'insensitive' } },
                { email: { contains: q.recherche, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    };
    const [lignes, total] = await this.prisma.$transaction([
      this.prisma.utilisateur.findMany({
        where,
        select: SELECTION,
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
        ...clausePagination(q),
      }),
      this.prisma.utilisateur.count({ where }),
    ]);
    return construirePage(lignes.map(versResume), total, q);
  }

  async detail(acteur: UtilisateurAuthentifie, id: string): Promise<UtilisateurDetailDto> {
    const ligne = await this.prisma.utilisateur.findFirst({
      where: { AND: [{ id }, acteur.id === id ? {} : porteeUtilisateurs(acteur)] },
      select: SELECTION,
    });
    // Hors portée : 404 plutôt que 403, pour ne pas révéler l'existence du compte.
    if (!ligne)
      throw new NotFoundException({
        code: 'UTILISATEUR_INTROUVABLE',
        message: 'Compte introuvable.',
      });
    return versDetail(ligne);
  }

  private async idRole(code: CodeRole): Promise<string> {
    return (await this.prisma.role.findUniqueOrThrow({ where: { code } })).id;
  }

  private async verifierEntreprise(role: CodeRole, entrepriseId: string | null): Promise<void> {
    const erreur = controlerRattachement(role, entrepriseId);
    if (erreur) {
      throw new RegleMetierException('RATTACHEMENT_INVALIDE', erreur, HttpStatus.BAD_REQUEST, [
        { champ: 'entrepriseId', messages: [erreur] },
      ]);
    }
    if (
      entrepriseId &&
      !(await this.prisma.entrepriseCliente.count({ where: { id: entrepriseId } }))
    ) {
      throw new RegleMetierException(
        'ENTREPRISE_INTROUVABLE',
        'Entreprise introuvable.',
        HttpStatus.BAD_REQUEST,
        [{ champ: 'entrepriseId', messages: ['Entreprise introuvable.'] }],
      );
    }
  }

  private async verifierEmailLibre(email: string, saufId?: string): Promise<void> {
    const existant = await this.prisma.utilisateur.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        NOT: saufId ? { id: saufId } : undefined,
      },
      select: { id: true },
    });
    if (existant) {
      throw new RegleMetierException(
        'EMAIL_DEJA_UTILISE',
        'Cette adresse email est déjà utilisée.',
        HttpStatus.CONFLICT,
        [{ champ: 'email', messages: ['Cette adresse email est déjà utilisée.'] }],
      );
    }
  }

  /**
   * Création d'un compte : aucun mot de passe n'est défini par l'administration ; le titulaire
   * reçoit un lien d'activation (72 h) pour choisir son mot de passe et donner son consentement
   * explicite (RG-RGPD-01).
   */
  async creer(
    acteur: UtilisateurAuthentifie,
    dto: CreationUtilisateurDto,
  ): Promise<UtilisateurDetailDto> {
    if (!peutGererCompte(acteur.role, null, dto.role)) {
      throw new ForbiddenException({
        code: 'ACCES_REFUSE',
        message: 'Vous ne pouvez pas créer ce type de compte.',
      });
    }
    const entrepriseId = dto.entrepriseId ?? null;
    await this.verifierEntreprise(dto.role, entrepriseId);
    await this.verifierEmailLibre(dto.email);

    const { cree, jeton } = await this.prisma.$transaction(async (tx) => {
      const cree = await tx.utilisateur.create({
        data: {
          nom: dto.nom,
          prenom: dto.prenom,
          email: dto.email,
          roleId: await this.idRole(dto.role),
          entrepriseId,
        },
        select: SELECTION,
      });
      const jeton = await this.auth.creerJetonUsageUnique(cree.id, TypeJeton.ACTIVATION, tx);
      await this.journal.enregistrer(
        {
          action: ActionJournal.CREATION_COMPTE,
          typeObjet: 'utilisateur',
          idObjet: cree.id,
          details: `rôle ${dto.role}`,
        },
        tx,
      );
      return { cree, jeton };
    });
    this.mail.envoyerEnArrierePlan(this.mail.messageActivation(cree.email, cree.prenom, jeton));
    return versDetail(cree);
  }

  async renvoyerActivation(acteur: UtilisateurAuthentifie, id: string): Promise<void> {
    const cible = await this.detail(acteur, id);
    if (!peutGererCompte(acteur.role, cible.role))
      throw new ForbiddenException({ code: 'ACCES_REFUSE' });
    if (cible.active) {
      throw new RegleMetierException('COMPTE_DEJA_ACTIVE', 'Ce compte est déjà activé.');
    }
    const jeton = await this.auth.creerJetonUsageUnique(id, TypeJeton.ACTIVATION);
    this.mail.envoyerEnArrierePlan(this.mail.messageActivation(cible.email, cible.prenom, jeton));
  }

  /**
   * Modification d'un compte. Un utilisateur peut rectifier son propre nom et prénom
   * (REQ-RGPD-004) ; les autres champs relèvent de l'administration.
   */
  async modifier(
    acteur: UtilisateurAuthentifie,
    id: string,
    dto: ModificationUtilisateurDto,
  ): Promise<UtilisateurDetailDto> {
    const cible = await this.prisma.utilisateur.findUnique({ where: { id }, select: SELECTION });
    if (!cible || cible.statutCompte === StatutCompte.ANONYMISE) {
      throw new NotFoundException({
        code: 'UTILISATEUR_INTROUVABLE',
        message: 'Compte introuvable.',
      });
    }

    const soiMeme = acteur.id === id;
    const champsAdministratifs =
      dto.email !== undefined ||
      dto.role !== undefined ||
      dto.entrepriseId !== undefined ||
      dto.statut !== undefined ||
      dto.mfaActive !== undefined;
    const gestionnaire = peutGererCompte(acteur.role, cible.role.code, dto.role);

    if (!gestionnaire && !(soiMeme && !champsAdministratifs)) {
      throw new ForbiddenException({
        code: 'ACCES_REFUSE',
        message: 'Modification non autorisée.',
      });
    }
    // Garde-fou : un administrateur ne peut pas se retirer ses propres droits ni se désactiver.
    if (
      soiMeme &&
      ((dto.role !== undefined && dto.role !== cible.role.code) ||
        dto.statut === StatutCompte.DESACTIVE)
    ) {
      throw new RegleMetierException(
        'AUTO_MODIFICATION_INTERDITE',
        'Vous ne pouvez pas modifier votre propre rôle ni désactiver votre compte.',
      );
    }

    const role = dto.role ?? cible.role.code;
    const entrepriseId =
      dto.entrepriseId !== undefined
        ? dto.entrepriseId
        : role === cible.role.code
          ? cible.entrepriseId
          : null;
    if (dto.role !== undefined || dto.entrepriseId !== undefined)
      await this.verifierEntreprise(role, entrepriseId);
    if (dto.email !== undefined && dto.email !== cible.email)
      await this.verifierEmailLibre(dto.email, id);

    const donnees: Prisma.UtilisateurUpdateInput = {
      nom: dto.nom,
      prenom: dto.prenom,
      email: dto.email,
    };
    if (dto.role !== undefined && dto.role !== cible.role.code) {
      donnees.role = { connect: { code: dto.role } };
    }
    if (dto.role !== undefined || dto.entrepriseId !== undefined) {
      donnees.entreprise = entrepriseId ? { connect: { id: entrepriseId } } : { disconnect: true };
    }
    if (dto.statut !== undefined) {
      donnees.statutCompte = dto.statut;
      if (dto.statut === StatutCompte.ACTIF) {
        donnees.tentativesEchouees = 0;
        donnees.verrouilleJusquA = null;
      }
    }
    if (dto.mfaActive === false) {
      donnees.mfaActive = false;
      donnees.mfaSecretChiffre = null;
      donnees.mfaDernierPas = null;
    }

    const maj = await this.prisma.$transaction(async (tx) => {
      const maj = await tx.utilisateur.update({ where: { id }, data: donnees, select: SELECTION });
      const journaliser = (action: ActionJournal, details?: string) =>
        this.journal.enregistrer({ action, typeObjet: 'utilisateur', idObjet: id, details }, tx);

      if (soiMeme && !champsAdministratifs) {
        await journaliser(ActionJournal.RECTIFICATION_DONNEES, 'Nom / prénom (self-service)');
      } else {
        const champs = Object.entries(dto)
          .filter(([cle, v]) => v !== undefined && cle !== 'role' && cle !== 'statut')
          .map(([cle]) => cle);
        if (champs.length)
          await journaliser(ActionJournal.MODIFICATION_COMPTE, `champs : ${champs.join(', ')}`);
      }
      if (dto.role !== undefined && dto.role !== cible.role.code) {
        await journaliser(ActionJournal.CHANGEMENT_ROLE, `${cible.role.code} vers ${dto.role}`);
      }
      if (dto.statut === StatutCompte.ACTIF && cible.statutCompte === StatutCompte.VERROUILLE) {
        await journaliser(ActionJournal.DEVERROUILLAGE_COMPTE);
      } else if (dto.statut !== undefined && dto.statut !== cible.statutCompte) {
        await journaliser(
          ActionJournal.MODIFICATION_COMPTE,
          `statut ${cible.statutCompte} vers ${dto.statut}`,
        );
      }
      // Changement de rôle, désactivation ou réinitialisation MFA : sessions fermées.
      if (
        (dto.role !== undefined && dto.role !== cible.role.code) ||
        dto.statut === StatutCompte.DESACTIVE ||
        dto.mfaActive === false
      ) {
        await this.jetons.revoquerToutesLesSessions(id, tx);
      }
      return maj;
    });
    return versDetail(maj);
  }

  /** DELETE /utilisateurs/{id} — suppression ou anonymisation (RG-CPT-02). */
  async supprimer(acteur: UtilisateurAuthentifie, id: string): Promise<'SUPPRIME' | 'ANONYMISE'> {
    if (acteur.id === id) {
      throw new RegleMetierException(
        'AUTO_SUPPRESSION_INTERDITE',
        'Vous ne pouvez pas supprimer votre propre compte ici : utilisez « Mes données (RGPD) ».',
      );
    }
    const cible = await this.prisma.utilisateur.findUnique({
      where: { id },
      select: { statutCompte: true },
    });
    if (!cible || cible.statutCompte === StatutCompte.ANONYMISE) {
      throw new NotFoundException({
        code: 'UTILISATEUR_INTROUVABLE',
        message: 'Compte introuvable.',
      });
    }
    return this.prisma.$transaction((tx) =>
      this.anonymisation.effacer(id, tx, 'Suppression par l’administrateur'),
    );
  }

  async roles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, libelle: true, _count: { select: { utilisateurs: true } } },
    });
    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      libelle: r.libelle,
      nombreComptes: r._count.utilisateurs,
    }));
  }
}
