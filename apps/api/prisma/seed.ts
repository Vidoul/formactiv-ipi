/**
 * Jeu de données FORMACTIV.
 *
 *   SEED_MODE=demo (défaut)   référentiel + données de DÉMONSTRATION fictives (DEV / TEST / recette)
 *   SEED_MODE=production      référentiel + compte administrateur initial (SEED_ADMIN_EMAIL / _PASSWORD)
 *
 * Conformément au chapitre 12, aucune donnée personnelle réelle n'est utilisée hors production :
 * les personnes ci-dessous sont celles des maquettes Figma, complétées de noms générés.
 * Les dates sont calculées relativement au jour d'exécution pour que la démonstration reste
 * cohérente (sessions « à venir », « en cours », « passées »).
 */
import {
  CodeRole,
  FinaliteConsentement,
  Modalite,
  PrismaClient,
  StatutCompte,
  StatutDemandeRgpd,
  StatutFormation,
  StatutInscription,
  TypeDemandeRgpd,
  TypeReferentiel,
} from '@prisma/client';
import { hacherMotDePasse } from '../src/common/securite/hachage';
import {
  CATALOGUE_PARAMETRES,
  CleParametre,
  valeurParDefaut,
} from '../src/modules/parametres/catalogue-parametres';

const prisma = new PrismaClient();

/** Mot de passe commun aux comptes de démonstration (conforme RG-AUTH-01). DEV UNIQUEMENT. */
const MOT_DE_PASSE_DEMO = 'Demo#Formactiv2026';
const VERSION_MENTIONS = valeurParDefaut(CleParametre.RGPD_VERSION_MENTIONS);

const LIBELLES_ROLES: Record<CodeRole, string> = {
  ADMIN: 'Administrateur',
  RESP_FORMATION: 'Responsable formation',
  FORMATEUR: 'Formateur',
  APPRENANT: 'Apprenant',
  CLIENT_ENTREPRISE: 'Client entreprise',
};

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

/** Générateur pseudo-aléatoire déterministe (mulberry32) : jeu de données reproductible. */
function generateur(graine: number): () => number {
  let a = graine;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
const alea = generateur(2026);
const entre = (min: number, max: number) => Math.round(min + alea() * (max - min));

const aujourdHui = new Date();
/** Date (minuit UTC) décalée de `n` jours par rapport à aujourd'hui. */
function jour(n: number): Date {
  return new Date(
    Date.UTC(aujourdHui.getUTCFullYear(), aujourdHui.getUTCMonth(), aujourdHui.getUTCDate() + n),
  );
}
/** Instant décalé de `n` jours (et d'une heure donnée) par rapport à maintenant. */
function instant(n: number, heure = 9, minute = 0): Date {
  const d = jour(n);
  d.setUTCHours(heure, minute);
  return d;
}

// ---------------------------------------------------------------------------
// Référentiel (tous modes)
// ---------------------------------------------------------------------------

async function seedReferentiel(): Promise<Record<CodeRole, string>> {
  const ids = {} as Record<CodeRole, string>;
  for (const code of Object.values(CodeRole)) {
    const role = await prisma.role.upsert({
      where: { code },
      update: { libelle: LIBELLES_ROLES[code] },
      create: { code, libelle: LIBELLES_ROLES[code] },
    });
    ids[code] = role.id;
  }
  for (const [cle, definition] of Object.entries(CATALOGUE_PARAMETRES)) {
    await prisma.parametre.upsert({
      where: { cle },
      update: { description: definition.description },
      create: {
        cle,
        valeur: valeurParDefaut(cle as CleParametre),
        description: definition.description,
      },
    });
  }
  return ids;
}

async function seedAdministrateurInitial(roles: Record<CodeRole, string>): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const motDePasse = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !motDePasse || motDePasse.length < 12) {
    throw new Error('SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD (12 caractères min.) sont requis');
  }
  if (await prisma.utilisateur.findUnique({ where: { email } })) {
    console.log(`Administrateur ${email} déjà présent.`);
    return;
  }
  const admin = await prisma.utilisateur.create({
    data: {
      nom: 'Administrateur',
      prenom: 'FORMACTIV',
      email,
      motDePasseHash: await hacherMotDePasse(motDePasse),
      roleId: roles.ADMIN,
    },
  });
  await prisma.consentement.create({
    data: {
      utilisateurId: admin.id,
      finalite: FinaliteConsentement.GESTION_COMPTE,
      versionMentions: VERSION_MENTIONS,
    },
  });
  console.log(`Administrateur initial créé : ${email} (MFA à configurer à la première connexion).`);
}

// ---------------------------------------------------------------------------
// Données de démonstration
// ---------------------------------------------------------------------------

const PRENOMS = [
  'Hugo',
  'Chloé',
  'Lucas',
  'Emma',
  'Nathan',
  'Inès',
  'Louis',
  'Jade',
  'Gabriel',
  'Manon',
  'Arthur',
  'Camille',
  'Jules',
  'Sarah',
  'Adam',
  'Zoé',
  'Raphaël',
  'Lina',
  'Tom',
  'Anaïs',
  'Enzo',
  'Clara',
  'Mathis',
  'Eva',
];
const NOMS = [
  'Bernard',
  'Dubois',
  'Thomas',
  'Robert',
  'Richard',
  'Durand',
  'Moreau',
  'Laurent',
  'Simon',
  'Michel',
  'Lefebvre',
  'Leroy',
  'Roux',
  'David',
  'Bertrand',
  'Morel',
  'Fournier',
  'Girard',
  'Bonnet',
  'Dupont',
  'Lambert',
  'Fontaine',
  'Rousseau',
  'Vincent',
];

function sansAccents(texte: string): string {
  // Décomposition NFD puis suppression des signes diacritiques (catégorie Unicode « Mark »).
  return texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

async function seedDemo(roles: Record<CodeRole, string>): Promise<void> {
  // --- Entreprises clientes (REQ-FUNC-018) -------------------------------------------------
  const [oxalys, nexatech, neosys] = await Promise.all([
    prisma.entrepriseCliente.create({
      data: {
        raisonSociale: 'Groupe Oxalys',
        siret: '81234567800019',
        emailContact: 'formation@oxalys.fr',
      },
    }),
    prisma.entrepriseCliente.create({
      data: { raisonSociale: 'Nexatech', siret: '79865432100027', emailContact: 'rh@nexatech.fr' },
    }),
    prisma.entrepriseCliente.create({
      data: {
        raisonSociale: 'Neosys Conseil',
        siret: '52147896300035',
        emailContact: 'contact@neosys.fr',
      },
    }),
  ]);

  // --- Comptes -------------------------------------------------------------------------------
  const creer = async (
    prenom: string,
    nom: string,
    email: string,
    role: CodeRole,
    options: {
      entrepriseId?: string;
      statut?: StatutCompte;
      derniereConnexion?: Date;
      satisfaction?: boolean;
      creeIlYA?: number;
    } = {},
  ) => {
    const dateCreation = instant(-(options.creeIlYA ?? 420));
    const u = await prisma.utilisateur.create({
      data: {
        prenom,
        nom,
        email,
        motDePasseHash: await hacherMotDePasse(MOT_DE_PASSE_DEMO),
        roleId: roles[role],
        entrepriseId: options.entrepriseId,
        statutCompte: options.statut ?? StatutCompte.ACTIF,
        verrouilleJusquA:
          options.statut === StatutCompte.VERROUILLE ? new Date(Date.now() + 15 * 60_000) : null,
        tentativesEchouees: options.statut === StatutCompte.VERROUILLE ? 5 : 0,
        dateDerniereConnexion: options.derniereConnexion ?? instant(-entre(0, 20), entre(8, 18)),
        dateCreation,
      },
    });
    // Consentement explicite horodaté (RG-RGPD-01)
    await prisma.consentement.create({
      data: {
        utilisateurId: u.id,
        finalite: FinaliteConsentement.GESTION_COMPTE,
        versionMentions: VERSION_MENTIONS,
        dateConsentement: dateCreation,
      },
    });
    if (options.satisfaction ?? role === CodeRole.APPRENANT) {
      await prisma.consentement.create({
        data: {
          utilisateurId: u.id,
          finalite: FinaliteConsentement.QUESTIONNAIRES_SATISFACTION,
          versionMentions: VERSION_MENTIONS,
          dateConsentement: dateCreation,
        },
      });
    }
    return u;
  };

  const alex = await creer('Alex', 'Dupré', 'a.dupre@formactiv.fr', CodeRole.ADMIN);
  const nadia = await creer('Nadia', 'Rey', 'nadia.rey@formactiv.fr', CodeRole.RESP_FORMATION);
  const karim = await creer('Karim', 'Selle', 'k.selle@formactiv.fr', CodeRole.FORMATEUR);
  const sonia = await creer('Sonia', 'Vidal', 's.vidal@formactiv.fr', CodeRole.FORMATEUR);
  await creer('Théo', 'Morel', 't.morel@oxalys.fr', CodeRole.CLIENT_ENTREPRISE, {
    entrepriseId: oxalys.id,
  });
  await creer('Inès', 'Garnier', 'i.garnier@nexatech.fr', CodeRole.CLIENT_ENTREPRISE, {
    entrepriseId: nexatech.id,
  });

  const lea = await creer('Léa', 'Martin', 'lea.martin@mail.fr', CodeRole.APPRENANT, {
    entrepriseId: oxalys.id,
    derniereConnexion: instant(-1, 18, 42),
  });
  const paul = await creer('Paul', 'Girard', 'p.girard@nexatech.fr', CodeRole.APPRENANT, {
    entrepriseId: nexatech.id,
  });
  const sami = await creer('Sami', 'Blanc', 's.blanc@mail.fr', CodeRole.APPRENANT);
  const marie = await creer('Marie', 'Perez', 'm.perez@mail.fr', CodeRole.APPRENANT, {
    entrepriseId: oxalys.id,
  });
  const marc = await creer('Marc', 'Petit', 'm.petit@oxalys.fr', CodeRole.APPRENANT, {
    entrepriseId: oxalys.id,
  });
  const julie = await creer('Julie', 'Roux', 'j.roux@oxalys.fr', CodeRole.APPRENANT, {
    entrepriseId: oxalys.id,
  });
  const nina = await creer('Nina', 'Costa', 'n.costa@oxalys.fr', CodeRole.APPRENANT, {
    entrepriseId: oxalys.id,
  });

  // Apprenants générés : 8 Oxalys, 6 Nexatech, 4 Neosys, 6 sans entreprise (H2)
  const repartition = [
    ...Array<string | undefined>(8).fill(oxalys.id),
    ...Array<string | undefined>(6).fill(nexatech.id),
    ...Array<string | undefined>(4).fill(neosys.id),
    ...Array<string | undefined>(6).fill(undefined),
  ];
  const generes = [];
  for (let i = 0; i < repartition.length; i++) {
    const prenom = PRENOMS[i];
    const nom = NOMS[(i * 7) % NOMS.length];
    const domaine =
      repartition[i] === oxalys.id
        ? 'oxalys.fr'
        : repartition[i] === nexatech.id
          ? 'nexatech.fr'
          : repartition[i] === neosys.id
            ? 'neosys.fr'
            : 'mail.fr';
    generes.push(
      await creer(
        prenom,
        nom,
        `${sansAccents(prenom)}.${sansAccents(nom)}@${domaine}`,
        CodeRole.APPRENANT,
        {
          entrepriseId: repartition[i],
          satisfaction: i % 5 !== 0,
          statut:
            i === 21 ? StatutCompte.VERROUILLE : i === 22 ? StatutCompte.DESACTIVE : undefined,
        },
      ),
    );
  }

  // --- Référentiels de compétences (RG-COMP-01) -----------------------------------------------
  const competence = (libelle: string, typeReferentiel: TypeReferentiel, codeRncp?: string) =>
    prisma.competence.create({ data: { libelle, typeReferentiel, codeRncp } });
  const cSecuriser = await competence(
    "Sécuriser un système d'information",
    TypeReferentiel.RNCP,
    'RNCP36125-C2',
  );
  const cRisques = await competence('Analyser les risques', TypeReferentiel.RNCP, 'RNCP36125-C3');
  const cAgile = await competence('Conduire un projet agile', TypeReferentiel.RNCP, 'RNCP35574-C1');
  const cBudget = await competence(
    'Piloter le budget d’un projet',
    TypeReferentiel.RNCP,
    'RNCP35574-C2',
  );
  const cPhishing = await competence('Sensibilisation phishing', TypeReferentiel.INTERNE);
  const cSql = await competence('Écrire des requêtes SQL', TypeReferentiel.INTERNE);
  const cHtml = await competence('HTML / CSS', TypeReferentiel.INTERNE);
  const cJs = await competence('JavaScript', TypeReferentiel.INTERNE);
  const cBdd = await competence('Bases de données', TypeReferentiel.INTERNE);
  const cRgpd = await competence('Appliquer le RGPD au quotidien', TypeReferentiel.INTERNE);
  const cTableur = await competence('Maîtriser les tableurs', TypeReferentiel.INTERNE);
  const cEquipe = await competence('Animer une équipe technique', TypeReferentiel.INTERNE);

  // --- Catalogue (RG-FORM-01..03) -------------------------------------------------------------
  const formation = (
    intitule: string,
    dureeHeures: number,
    modalite: Modalite,
    prerequis: string,
    statut: StatutFormation,
    competences: { id: string }[],
  ) =>
    prisma.formation.create({
      data: {
        intitule,
        dureeHeures,
        modalite,
        prerequis,
        statut,
        competences: { create: competences.map((c) => ({ competenceId: c.id })) },
      },
    });

  const fCyber = await formation(
    'Cybersécurité fondamentaux',
    35,
    Modalite.HYBRIDE,
    'Bases en informatique',
    StatutFormation.PUBLIEE,
    [cSecuriser, cRisques, cPhishing],
  );
  const fProjet = await formation(
    'Gestion de projet IT',
    28,
    Modalite.PRESENTIEL,
    'Aucun',
    StatutFormation.PUBLIEE,
    [cAgile, cBudget],
  );
  const fWeb = await formation(
    'Développement web',
    70,
    Modalite.DISTANCIEL,
    "Notions d'algorithmique",
    StatutFormation.PUBLIEE,
    [cHtml, cJs, cBdd],
  );
  await formation(
    "Management d'équipe IT",
    21,
    Modalite.PRESENTIEL,
    "Deux ans d'expérience en équipe IT",
    StatutFormation.BROUILLON,
    [cEquipe],
  );
  const fBureautique = await formation(
    'Bureautique avancée',
    14,
    Modalite.PRESENTIEL,
    'Aucun',
    StatutFormation.ARCHIVEE,
    [cTableur],
  );
  const fRgpd = await formation(
    'RGPD en pratique',
    14,
    Modalite.DISTANCIEL,
    'Aucun',
    StatutFormation.PUBLIEE,
    [cRgpd, cPhishing],
  );
  // Compétence SQL rattachée à la formation web en seconde version du référentiel
  await prisma.formationCompetence.create({
    data: { formationId: fWeb.id, competenceId: cSql.id },
  });

  const competencesDe = async (formationId: string) =>
    (await prisma.formationCompetence.findMany({ where: { formationId } })).map(
      (l) => l.competenceId,
    );

  // --- Sessions et affectations (RG-SESS-01/02) -----------------------------------------------
  const session = (
    formationId: string,
    debut: number,
    fin: number,
    lieu: string,
    formateurs: { id: string }[],
    capaciteMax?: number,
  ) =>
    prisma.session.create({
      data: {
        formationId,
        dateDebut: jour(debut),
        dateFin: jour(fin),
        lieu,
        capaciteMax,
        animations: { create: formateurs.map((f) => ({ formateurId: f.id })) },
      },
    });

  const sCyberPassee = await session(fCyber.id, -40, -36, 'Toulouse', [karim], 12);
  const sCyberProchaine = await session(fCyber.id, 10, 14, 'Toulouse', [karim, sonia], 12);
  const sRgpd = await session(fRgpd.id, 20, 21, 'Distanciel', [karim]);
  const sWebPassee = await session(fWeb.id, -95, -91, 'Distanciel', [karim]);
  const sProjetPassee = await session(fProjet.id, -107, -105, 'Toulouse', [karim]);
  const sWebEnCours = await session(fWeb.id, -10, 4, 'Distanciel', [sonia]);
  const sProjetProchaine = await session(fProjet.id, 17, 19, 'Toulouse', [sonia]);
  const sBureautique = await session(fBureautique.id, -400, -399, 'Toulouse', [sonia]);
  // Session proche sans formateur : alimente l'alerte RG-SESS-02 du tableau de bord
  await session(fRgpd.id, 6, 7, 'Distanciel', [], 15);

  // --- Inscriptions, évaluations, satisfaction ------------------------------------------------
  const inscrire = async (
    apprenant: { id: string },
    s: { id: string; formationId: string; dateDebut: Date },
    statut: StatutInscription,
    options: {
      notes?: (number | null)[];
      formateur?: { id: string };
      score?: number;
      prerequis?: boolean;
    } = {},
  ) => {
    const insc = await prisma.inscription.create({
      data: {
        apprenantId: apprenant.id,
        sessionId: s.id,
        statut,
        prerequisVerifies: options.prerequis ?? statut !== StatutInscription.EN_ATTENTE,
        dateInscription: new Date(s.dateDebut.getTime() - entre(10, 40) * 86_400_000),
      },
    });
    if (options.notes) {
      const competences = await competencesDe(s.formationId);
      for (let i = 0; i < competences.length; i++) {
        const note = options.notes[i];
        if (note === null || note === undefined) continue;
        await prisma.evaluation.create({
          data: {
            inscriptionId: insc.id,
            competenceId: competences[i],
            note,
            acquise: note >= 10,
            formateurId: (options.formateur ?? karim).id,
            dateSaisie: new Date(s.dateDebut.getTime() + 3 * 86_400_000),
          },
        });
      }
    }
    if (options.score) {
      await prisma.reponseSatisfaction.create({
        data: {
          inscriptionId: insc.id,
          score: options.score,
          commentaire: options.score >= 4 ? 'Formation claire et concrète.' : undefined,
        },
      });
    }
    return insc;
  };
  const notesAleatoires = (n: number) => Array.from({ length: n }, () => entre(6, 19));

  // Cybersécurité — session passée, terminée
  await inscrire(lea, sCyberPassee, StatutInscription.TERMINEE, { notes: [15, 13, 17], score: 5 });
  await inscrire(paul, sCyberPassee, StatutInscription.TERMINEE, { notes: [12, 8, 14], score: 4 });
  await inscrire(sami, sCyberPassee, StatutInscription.TERMINEE, { notes: [16, 11, 12], score: 4 });
  await inscrire(nina, sCyberPassee, StatutInscription.TERMINEE, { notes: [14, 12, 15], score: 5 });
  for (const a of generes.slice(0, 6)) {
    await inscrire(a, sCyberPassee, StatutInscription.TERMINEE, {
      notes: notesAleatoires(3),
      score: entre(3, 5),
    });
  }

  // Cybersécurité — prochaine session : 9 inscrits / 12 places
  await inscrire(marie, sCyberProchaine, StatutInscription.VALIDEE);
  await inscrire(julie, sCyberProchaine, StatutInscription.EN_ATTENTE, { prerequis: false });
  await inscrire(marc, sCyberProchaine, StatutInscription.VALIDEE);
  await inscrire(generes[14], sCyberProchaine, StatutInscription.ANNULEE);
  for (const a of generes.slice(6, 12)) {
    await inscrire(a, sCyberProchaine, StatutInscription.VALIDEE);
  }

  // RGPD en pratique — 14 inscrits
  for (const a of [...generes.slice(8, 20), paul, nina]) {
    await inscrire(a, sRgpd, StatutInscription.VALIDEE);
  }

  // Développement web — session passée terminée
  await inscrire(marc, sWebPassee, StatutInscription.TERMINEE, {
    notes: [14, 12, 11, 13],
    score: 4,
  });
  for (const a of generes.slice(10, 18)) {
    await inscrire(a, sWebPassee, StatutInscription.TERMINEE, {
      notes: notesAleatoires(4),
      score: entre(3, 5),
    });
  }

  // Gestion de projet — session passée : 2 notes manquantes
  const participantsProjet = generes.slice(2, 8);
  for (let i = 0; i < participantsProjet.length; i++) {
    const notes = i < 2 ? [entre(9, 16), null] : notesAleatoires(2);
    await inscrire(participantsProjet[i], sProjetPassee, StatutInscription.VALIDEE, {
      notes,
      score: entre(3, 5),
    });
  }

  // Développement web — session en cours (Léa : progression partielle)
  await inscrire(lea, sWebEnCours, StatutInscription.VALIDEE, {
    notes: [16, 11],
    formateur: sonia,
  });
  await inscrire(julie, sWebEnCours, StatutInscription.VALIDEE, { notes: [9], formateur: sonia });

  // Gestion de projet — prochaine session
  await inscrire(lea, sProjetProchaine, StatutInscription.EN_ATTENTE);
  await inscrire(julie, sProjetProchaine, StatutInscription.VALIDEE);

  // Bureautique avancée — ancienne session (formation archivée depuis)
  await inscrire(lea, sBureautique, StatutInscription.TERMINEE, {
    notes: [12],
    formateur: sonia,
    score: 4,
  });

  // --- Demandes RGPD (UC-13 / UC-14) ----------------------------------------------------------
  await prisma.demandeRgpd.createMany({
    data: [
      {
        utilisateurId: marie.id,
        type: TypeDemandeRgpd.ACCES,
        statut: StatutDemandeRgpd.TRAITEE,
        dateDemande: instant(-4),
        dateTraitement: instant(-3),
        traitantId: alex.id,
        reponse: 'Export des données transmis.',
      },
      {
        utilisateurId: sami.id,
        type: TypeDemandeRgpd.RECTIFICATION,
        statut: StatutDemandeRgpd.RECUE,
        dateDemande: instant(-1),
        message: 'Mon nom de famille comporte une faute (Blanc → Blancq).',
      },
      {
        utilisateurId: paul.id,
        type: TypeDemandeRgpd.SUPPRESSION,
        statut: StatutDemandeRgpd.EN_COURS,
        dateDemande: instant(0, 8),
        traitantId: alex.id,
      },
      {
        utilisateurId: lea.id,
        type: TypeDemandeRgpd.ACCES,
        statut: StatutDemandeRgpd.RECUE,
        dateDemande: instant(0, 10),
      },
    ],
  });

  // --- Journal : activité récente de démonstration (tableau de bord administrateur) -----------
  const acteurs = [alex, nadia, karim, sonia, lea, paul, marie, ...generes.slice(0, 10)];
  const entrees = [];
  for (let j = -6; j <= 0; j++) {
    const volume = j === -1 || j === 0 ? entre(10, 16) : entre(40, 65);
    for (let k = 0; k < volume; k++) {
      entrees.push({
        utilisateurId: acteurs[entre(0, acteurs.length - 1)].id,
        action: 'CONNEXION_REUSSIE',
        dateAction: instant(j, entre(7, 19), entre(0, 59)),
        details: 'Donnée de démonstration',
      });
    }
  }
  entrees.push(
    {
      utilisateurId: alex.id,
      action: 'CHANGEMENT_ROLE',
      typeObjet: 'utilisateur',
      idObjet: generes[3].id,
      dateAction: instant(0, 9, 12),
      details: 'APPRENANT vers FORMATEUR (démonstration)',
    },
    {
      utilisateurId: nadia.id,
      action: 'EXPORT_CSV',
      typeObjet: 'inscriptions',
      dateAction: instant(0, 8, 55),
      details: 'filtre : trimestre en cours (démonstration)',
    },
    {
      utilisateurId: karim.id,
      action: 'CORRECTION_NOTE',
      typeObjet: 'evaluation',
      dateAction: instant(-1, 18, 20),
      details: 'ancienne valeur tracée (démonstration)',
    },
    {
      utilisateurId: null,
      action: 'VERROUILLAGE_COMPTE',
      typeObjet: 'utilisateur',
      idObjet: generes[21].id,
      dateAction: instant(-1, 17, 2),
      details: '5 échecs de connexion (démonstration)',
    },
  );
  await prisma.journalAction.createMany({ data: entrees });

  console.log(
    `Démonstration : ${await prisma.utilisateur.count()} comptes, ${await prisma.formation.count()} formations, ` +
      `${await prisma.session.count()} sessions, ${await prisma.inscription.count()} inscriptions.`,
  );
  console.log(`Mot de passe des comptes de démonstration : ${MOT_DE_PASSE_DEMO}`);
}

async function main(): Promise<void> {
  const mode = process.env.SEED_MODE ?? 'demo';
  const roles = await seedReferentiel();

  if (mode === 'production') {
    await seedAdministrateurInitial(roles);
    return;
  }
  if (mode !== 'demo') throw new Error(`SEED_MODE inconnu : ${mode}`);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refus : données de démonstration interdites en production (chapitre 12).');
  }
  if ((await prisma.utilisateur.count()) > 0) {
    console.log(
      'Des comptes existent déjà : données de démonstration non rechargées (npm run db:reset).',
    );
    return;
  }
  await seedDemo(roles);
}

main()
  .catch((erreur: unknown) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
