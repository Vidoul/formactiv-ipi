-- CreateEnum
CREATE TYPE "CodeRole" AS ENUM ('ADMIN', 'RESP_FORMATION', 'FORMATEUR', 'APPRENANT', 'CLIENT_ENTREPRISE');

-- CreateEnum
CREATE TYPE "StatutCompte" AS ENUM ('ACTIF', 'VERROUILLE', 'DESACTIVE', 'ANONYMISE');

-- CreateEnum
CREATE TYPE "Modalite" AS ENUM ('PRESENTIEL', 'DISTANCIEL', 'HYBRIDE');

-- CreateEnum
CREATE TYPE "StatutFormation" AS ENUM ('BROUILLON', 'PUBLIEE', 'ARCHIVEE');

-- CreateEnum
CREATE TYPE "TypeReferentiel" AS ENUM ('RNCP', 'INTERNE');

-- CreateEnum
CREATE TYPE "StatutInscription" AS ENUM ('EN_ATTENTE', 'VALIDEE', 'ANNULEE', 'TERMINEE');

-- CreateEnum
CREATE TYPE "TypeDocument" AS ENUM ('ATTESTATION', 'CERTIFICAT');

-- CreateEnum
CREATE TYPE "TypeDemandeRgpd" AS ENUM ('ACCES', 'RECTIFICATION', 'SUPPRESSION');

-- CreateEnum
CREATE TYPE "StatutDemandeRgpd" AS ENUM ('RECUE', 'EN_COURS', 'TRAITEE', 'REFUSEE');

-- CreateEnum
CREATE TYPE "FinaliteConsentement" AS ENUM ('GESTION_COMPTE', 'QUESTIONNAIRES_SATISFACTION');

-- CreateEnum
CREATE TYPE "TypeJeton" AS ENUM ('REINITIALISATION', 'ACTIVATION');

-- CreateTable
CREATE TABLE "role" (
    "id_role" UUID NOT NULL,
    "code" "CodeRole" NOT NULL,
    "libelle" VARCHAR(50) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id_role")
);

-- CreateTable
CREATE TABLE "entreprise_cliente" (
    "id_entreprise" UUID NOT NULL,
    "raison_sociale" VARCHAR(150) NOT NULL,
    "siret" VARCHAR(14),
    "email_contact" VARCHAR(255) NOT NULL,
    "date_creation" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entreprise_cliente_pkey" PRIMARY KEY ("id_entreprise")
);

-- CreateTable
CREATE TABLE "utilisateur" (
    "id_utilisateur" UUID NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "prenom" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "mot_de_passe_hash" TEXT,
    "mfa_active" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret_chiffre" TEXT,
    "mfa_dernier_pas" INTEGER,
    "statut_compte" "StatutCompte" NOT NULL DEFAULT 'ACTIF',
    "tentatives_echouees" INTEGER NOT NULL DEFAULT 0,
    "verrouille_jusqu_a" TIMESTAMPTZ(3),
    "date_derniere_connexion" TIMESTAMPTZ(3),
    "date_creation" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMPTZ(3) NOT NULL,
    "id_role" UUID NOT NULL,
    "id_entreprise" UUID,

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id_utilisateur")
);

-- CreateTable
CREATE TABLE "formation" (
    "id_formation" UUID NOT NULL,
    "intitule" VARCHAR(200) NOT NULL,
    "duree_heures" INTEGER NOT NULL,
    "modalite" "Modalite" NOT NULL,
    "prerequis" TEXT NOT NULL,
    "statut" "StatutFormation" NOT NULL DEFAULT 'BROUILLON',
    "seuil_acquisition" DECIMAL(4,2) NOT NULL DEFAULT 10,
    "date_creation" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "formation_pkey" PRIMARY KEY ("id_formation")
);

-- CreateTable
CREATE TABLE "competence" (
    "id_competence" UUID NOT NULL,
    "libelle" VARCHAR(200) NOT NULL,
    "type_referentiel" "TypeReferentiel" NOT NULL,
    "code_rncp" VARCHAR(20),

    CONSTRAINT "competence_pkey" PRIMARY KEY ("id_competence")
);

-- CreateTable
CREATE TABLE "formation_competence" (
    "id_formation" UUID NOT NULL,
    "id_competence" UUID NOT NULL,

    CONSTRAINT "formation_competence_pkey" PRIMARY KEY ("id_formation","id_competence")
);

-- CreateTable
CREATE TABLE "session" (
    "id_session" UUID NOT NULL,
    "id_formation" UUID NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "capacite_max" INTEGER,
    "lieu" VARCHAR(150),
    "date_creation" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id_session")
);

-- CreateTable
CREATE TABLE "animation" (
    "id_session" UUID NOT NULL,
    "id_formateur" UUID NOT NULL,
    "date_affectation" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animation_pkey" PRIMARY KEY ("id_session","id_formateur")
);

-- CreateTable
CREATE TABLE "inscription" (
    "id_inscription" UUID NOT NULL,
    "id_apprenant" UUID NOT NULL,
    "id_session" UUID NOT NULL,
    "statut" "StatutInscription" NOT NULL DEFAULT 'EN_ATTENTE',
    "date_inscription" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prerequis_verifies" BOOLEAN NOT NULL DEFAULT false,
    "date_modification" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inscription_pkey" PRIMARY KEY ("id_inscription")
);

-- CreateTable
CREATE TABLE "evaluation" (
    "id_evaluation" UUID NOT NULL,
    "id_inscription" UUID NOT NULL,
    "id_competence" UUID NOT NULL,
    "note" DECIMAL(4,2) NOT NULL,
    "acquise" BOOLEAN NOT NULL,
    "id_formateur" UUID NOT NULL,
    "date_saisie" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_pkey" PRIMARY KEY ("id_evaluation")
);

-- CreateTable
CREATE TABLE "document" (
    "id_document" UUID NOT NULL,
    "id_inscription" UUID NOT NULL,
    "type" "TypeDocument" NOT NULL,
    "reference_unique" VARCHAR(30) NOT NULL,
    "date_generation" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_emetteur" UUID NOT NULL,
    "fichier" VARCHAR(255) NOT NULL,
    "empreinte_sha256" CHAR(64) NOT NULL,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id_document")
);

-- CreateTable
CREATE TABLE "reponse_satisfaction" (
    "id_reponse" UUID NOT NULL,
    "id_inscription" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "commentaire" VARCHAR(1000),
    "date_reponse" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reponse_satisfaction_pkey" PRIMARY KEY ("id_reponse")
);

-- CreateTable
CREATE TABLE "consentement" (
    "id_consentement" UUID NOT NULL,
    "id_utilisateur" UUID NOT NULL,
    "finalite" "FinaliteConsentement" NOT NULL,
    "version_mentions" VARCHAR(20) NOT NULL,
    "date_consentement" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_retrait" TIMESTAMPTZ(3),

    CONSTRAINT "consentement_pkey" PRIMARY KEY ("id_consentement")
);

-- CreateTable
CREATE TABLE "demande_rgpd" (
    "id_demande" UUID NOT NULL,
    "numero" SERIAL NOT NULL,
    "id_utilisateur" UUID NOT NULL,
    "type" "TypeDemandeRgpd" NOT NULL,
    "statut" "StatutDemandeRgpd" NOT NULL DEFAULT 'RECUE',
    "message" VARCHAR(1000),
    "reponse" VARCHAR(1000),
    "date_demande" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_traitement" TIMESTAMPTZ(3),
    "id_traitant" UUID,

    CONSTRAINT "demande_rgpd_pkey" PRIMARY KEY ("id_demande")
);

-- CreateTable
CREATE TABLE "journal_action" (
    "id_journal" UUID NOT NULL,
    "id_utilisateur" UUID,
    "action" VARCHAR(50) NOT NULL,
    "type_objet" VARCHAR(50),
    "id_objet" VARCHAR(64),
    "date_action" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" VARCHAR(500),
    "adresse_ip" VARCHAR(45),

    CONSTRAINT "journal_action_pkey" PRIMARY KEY ("id_journal")
);

-- CreateTable
CREATE TABLE "jeton_refresh" (
    "id_jeton" UUID NOT NULL,
    "id_utilisateur" UUID NOT NULL,
    "famille" UUID NOT NULL,
    "empreinte" CHAR(64) NOT NULL,
    "date_expiration" TIMESTAMPTZ(3) NOT NULL,
    "date_revocation" TIMESTAMPTZ(3),
    "date_creation" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jeton_refresh_pkey" PRIMARY KEY ("id_jeton")
);

-- CreateTable
CREATE TABLE "jeton_usage_unique" (
    "id_jeton" UUID NOT NULL,
    "id_utilisateur" UUID NOT NULL,
    "type" "TypeJeton" NOT NULL,
    "empreinte" CHAR(64) NOT NULL,
    "date_expiration" TIMESTAMPTZ(3) NOT NULL,
    "date_utilisation" TIMESTAMPTZ(3),
    "date_creation" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jeton_usage_unique_pkey" PRIMARY KEY ("id_jeton")
);

-- CreateTable
CREATE TABLE "parametre" (
    "cle" VARCHAR(100) NOT NULL,
    "valeur" VARCHAR(500) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "date_modification" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "parametre_pkey" PRIMARY KEY ("cle")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_code_key" ON "role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "entreprise_cliente_siret_key" ON "entreprise_cliente"("siret");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_email_key" ON "utilisateur"("email");

-- CreateIndex
CREATE INDEX "utilisateur_id_role_idx" ON "utilisateur"("id_role");

-- CreateIndex
CREATE INDEX "utilisateur_id_entreprise_idx" ON "utilisateur"("id_entreprise");

-- CreateIndex
CREATE INDEX "utilisateur_statut_compte_idx" ON "utilisateur"("statut_compte");

-- CreateIndex
CREATE INDEX "formation_statut_idx" ON "formation"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "competence_type_referentiel_libelle_key" ON "competence"("type_referentiel", "libelle");

-- CreateIndex
CREATE INDEX "formation_competence_id_competence_idx" ON "formation_competence"("id_competence");

-- CreateIndex
CREATE INDEX "session_id_formation_idx" ON "session"("id_formation");

-- CreateIndex
CREATE INDEX "session_date_debut_date_fin_idx" ON "session"("date_debut", "date_fin");

-- CreateIndex
CREATE INDEX "animation_id_formateur_idx" ON "animation"("id_formateur");

-- CreateIndex
CREATE INDEX "inscription_id_session_statut_idx" ON "inscription"("id_session", "statut");

-- CreateIndex
CREATE INDEX "inscription_statut_idx" ON "inscription"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "inscription_id_apprenant_id_session_key" ON "inscription"("id_apprenant", "id_session");

-- CreateIndex
CREATE INDEX "evaluation_id_competence_idx" ON "evaluation"("id_competence");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_id_inscription_id_competence_key" ON "evaluation"("id_inscription", "id_competence");

-- CreateIndex
CREATE UNIQUE INDEX "document_reference_unique_key" ON "document"("reference_unique");

-- CreateIndex
CREATE INDEX "document_id_inscription_idx" ON "document"("id_inscription");

-- CreateIndex
CREATE UNIQUE INDEX "reponse_satisfaction_id_inscription_key" ON "reponse_satisfaction"("id_inscription");

-- CreateIndex
CREATE INDEX "consentement_id_utilisateur_finalite_idx" ON "consentement"("id_utilisateur", "finalite");

-- CreateIndex
CREATE UNIQUE INDEX "demande_rgpd_numero_key" ON "demande_rgpd"("numero");

-- CreateIndex
CREATE INDEX "demande_rgpd_statut_idx" ON "demande_rgpd"("statut");

-- CreateIndex
CREATE INDEX "demande_rgpd_id_utilisateur_idx" ON "demande_rgpd"("id_utilisateur");

-- CreateIndex
CREATE INDEX "journal_action_date_action_idx" ON "journal_action"("date_action");

-- CreateIndex
CREATE INDEX "journal_action_id_utilisateur_date_action_idx" ON "journal_action"("id_utilisateur", "date_action");

-- CreateIndex
CREATE INDEX "journal_action_action_date_action_idx" ON "journal_action"("action", "date_action");

-- CreateIndex
CREATE UNIQUE INDEX "jeton_refresh_empreinte_key" ON "jeton_refresh"("empreinte");

-- CreateIndex
CREATE INDEX "jeton_refresh_id_utilisateur_idx" ON "jeton_refresh"("id_utilisateur");

-- CreateIndex
CREATE INDEX "jeton_refresh_famille_idx" ON "jeton_refresh"("famille");

-- CreateIndex
CREATE UNIQUE INDEX "jeton_usage_unique_empreinte_key" ON "jeton_usage_unique"("empreinte");

-- CreateIndex
CREATE INDEX "jeton_usage_unique_id_utilisateur_type_idx" ON "jeton_usage_unique"("id_utilisateur", "type");

-- AddForeignKey
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_id_role_fkey" FOREIGN KEY ("id_role") REFERENCES "role"("id_role") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_id_entreprise_fkey" FOREIGN KEY ("id_entreprise") REFERENCES "entreprise_cliente"("id_entreprise") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formation_competence" ADD CONSTRAINT "formation_competence_id_formation_fkey" FOREIGN KEY ("id_formation") REFERENCES "formation"("id_formation") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formation_competence" ADD CONSTRAINT "formation_competence_id_competence_fkey" FOREIGN KEY ("id_competence") REFERENCES "competence"("id_competence") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_id_formation_fkey" FOREIGN KEY ("id_formation") REFERENCES "formation"("id_formation") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animation" ADD CONSTRAINT "animation_id_session_fkey" FOREIGN KEY ("id_session") REFERENCES "session"("id_session") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animation" ADD CONSTRAINT "animation_id_formateur_fkey" FOREIGN KEY ("id_formateur") REFERENCES "utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscription" ADD CONSTRAINT "inscription_id_apprenant_fkey" FOREIGN KEY ("id_apprenant") REFERENCES "utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscription" ADD CONSTRAINT "inscription_id_session_fkey" FOREIGN KEY ("id_session") REFERENCES "session"("id_session") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_id_inscription_fkey" FOREIGN KEY ("id_inscription") REFERENCES "inscription"("id_inscription") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_id_competence_fkey" FOREIGN KEY ("id_competence") REFERENCES "competence"("id_competence") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_id_formateur_fkey" FOREIGN KEY ("id_formateur") REFERENCES "utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_id_inscription_fkey" FOREIGN KEY ("id_inscription") REFERENCES "inscription"("id_inscription") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_id_emetteur_fkey" FOREIGN KEY ("id_emetteur") REFERENCES "utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponse_satisfaction" ADD CONSTRAINT "reponse_satisfaction_id_inscription_fkey" FOREIGN KEY ("id_inscription") REFERENCES "inscription"("id_inscription") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentement" ADD CONSTRAINT "consentement_id_utilisateur_fkey" FOREIGN KEY ("id_utilisateur") REFERENCES "utilisateur"("id_utilisateur") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demande_rgpd" ADD CONSTRAINT "demande_rgpd_id_utilisateur_fkey" FOREIGN KEY ("id_utilisateur") REFERENCES "utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demande_rgpd" ADD CONSTRAINT "demande_rgpd_id_traitant_fkey" FOREIGN KEY ("id_traitant") REFERENCES "utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_action" ADD CONSTRAINT "journal_action_id_utilisateur_fkey" FOREIGN KEY ("id_utilisateur") REFERENCES "utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jeton_refresh" ADD CONSTRAINT "jeton_refresh_id_utilisateur_fkey" FOREIGN KEY ("id_utilisateur") REFERENCES "utilisateur"("id_utilisateur") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jeton_usage_unique" ADD CONSTRAINT "jeton_usage_unique_id_utilisateur_fkey" FOREIGN KEY ("id_utilisateur") REFERENCES "utilisateur"("id_utilisateur") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- Contraintes de gestion portées par la base (dossier de conception, ch. 6 et 8)
-- Ajoutées manuellement : non exprimables dans le schéma Prisma.
-- =============================================================================

-- RG-SESS-01 : date de fin postérieure ou égale à la date de début
ALTER TABLE "session" ADD CONSTRAINT "session_dates_coherentes_chk" CHECK ("date_fin" >= "date_debut");
-- RG-SESS-03 : capacité strictement positive lorsqu'elle est définie
ALTER TABLE "session" ADD CONSTRAINT "session_capacite_positive_chk" CHECK ("capacite_max" IS NULL OR "capacite_max" > 0);

-- RG-FORM-01 : durée strictement positive ; seuil d'acquisition sur 20 (RG-EVAL-02)
ALTER TABLE "formation" ADD CONSTRAINT "formation_duree_positive_chk" CHECK ("duree_heures" > 0);
ALTER TABLE "formation" ADD CONSTRAINT "formation_seuil_borne_chk" CHECK ("seuil_acquisition" >= 0 AND "seuil_acquisition" <= 20);
ALTER TABLE "formation" ADD CONSTRAINT "formation_prerequis_non_vide_chk" CHECK (length(trim("prerequis")) > 0);

-- RG-COMP-01 : code RNCP obligatoire pour une compétence du référentiel RNCP
ALTER TABLE "competence" ADD CONSTRAINT "competence_code_rncp_chk" CHECK ("type_referentiel" <> 'RNCP' OR "code_rncp" IS NOT NULL);

-- Dictionnaire de données : note décimale entre 0 et 20
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_note_bornee_chk" CHECK ("note" >= 0 AND "note" <= 20);

-- Dictionnaire de données : score de satisfaction de 1 à 5
ALTER TABLE "reponse_satisfaction" ADD CONSTRAINT "reponse_score_borne_chk" CHECK ("score" BETWEEN 1 AND 5);

-- Unicité de l'email insensible à la casse (identifiant de connexion)
CREATE UNIQUE INDEX "utilisateur_email_lower_key" ON "utilisateur" (lower("email"));

-- =============================================================================
-- RG-LOG-01 / chapitre 10 : journal des actions sensibles en ÉCRITURE SEULE.
-- - UPDATE interdit en toutes circonstances ;
-- - DELETE autorisé uniquement pour les entrées de plus de 6 mois (purge de la
--   politique de conservation, RG-RGPD-04 : 12 mois par défaut, jamais < 6 mois).
-- Même un compte applicatif compromis ne peut donc pas effacer des traces récentes.
-- =============================================================================
CREATE OR REPLACE FUNCTION journal_action_protection() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'journal_action est en écriture seule (RG-LOG-01)' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'DELETE' AND OLD."date_action" > now() - interval '6 months' THEN
    RAISE EXCEPTION 'suppression d''une entrée de journal non échue interdite (RG-RGPD-04)' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_action_ecriture_seule"
  BEFORE UPDATE OR DELETE ON "journal_action"
  FOR EACH ROW EXECUTE FUNCTION journal_action_protection();
