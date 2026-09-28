import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ErreurApi } from '../../api/client';
import type { FinaliteConsentement, TypeDemandeRgpd } from '../../api/types';
import { useAuth, useUtilisateur } from '../../auth/ContexteAuth';
import { usePage } from '../../components/layout/ContextePage';
import {
  Alerte,
  AlerteErreur,
  Badge,
  BadgeStatut,
  Bouton,
  Carte,
  ChampTexte,
  ChampZoneTexte,
  Chargement,
  Dialogue,
  EnTetePage,
  messageErreur,
  Tableau,
  useNotifier,
} from '../../components/ui';
import { formaterDate, formaterDateHeure } from '../../utils/formatage';
import {
  FINALITES_CONSENTEMENT,
  ROLES,
  STATUTS_DEMANDE_RGPD,
  TYPES_DEMANDE_RGPD,
} from '../../utils/libelles';
import { clesRgpd, rgpdApi, type Consentement, type MesDonnees } from './api';

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/**
 * Écran Figma 04 — Mes données personnelles (UC-13, US-28..30, RG-RGPD-01/02) : droit d'accès et
 * portabilité, rectification en libre-service, consentements, demandes (dont la suppression).
 */
export default function PageMesDonnees() {
  usePage('Mes données (RGPD)');
  const requete = useQuery({ queryKey: clesRgpd.mesDonnees, queryFn: rgpdApi.mesDonnees });

  return (
    <>
      <EnTetePage
        titre="Mes données personnelles"
        sousTitre="Conformément au RGPD : consultez, corrigez ou demandez la suppression de vos données."
      />
      {requete.error && <AlerteErreur erreur={requete.error} />}
      {requete.isPending && <Chargement />}
      {requete.data && <Contenu d={requete.data} />}
    </>
  );
}

function Contenu({ d }: { d: MesDonnees }) {
  const client = useQueryClient();
  const notifier = useNotifier();
  const { mettreAJourUtilisateur } = useAuth();
  const moi = useUtilisateur();
  const [rectification, setRectification] = useState(false);
  const [suppression, setSuppression] = useState(false);
  // Formulaires vierges à chaque ouverture ; la clé ne change pas à la fermeture pour que la
  // fenêtre rende le focus à son déclencheur (RGAA 7.1).
  const [ouvertures, setOuvertures] = useState(0);
  const [export_, setExport] = useState(false);
  const ouvrir = (dialogue: (ouvert: boolean) => void) => {
    setOuvertures((n) => n + 1);
    dialogue(true);
  };

  const mettreAJour = (maj: MesDonnees) => client.setQueryData(clesRgpd.mesDonnees, maj);
  const consentement = useMutation({
    mutationFn: (p: { finalite: FinaliteConsentement; donner: boolean }) =>
      p.donner ? rgpdApi.donnerConsentement(p.finalite) : rgpdApi.retirerConsentement(p.finalite),
    onSuccess: (maj, p) => {
      mettreAJour(maj);
      notifier.succes(p.donner ? 'Votre accord est enregistré.' : 'Votre accord est retiré.');
    },
    onError: (e) => notifier.erreur(messageErreur(e)),
  });

  const telecharger = async () => {
    setExport(true);
    try {
      await rgpdApi.exporter();
    } catch (e) {
      notifier.erreur(messageErreur(e));
    } finally {
      setExport(false);
    }
  };

  const { compte } = d;
  const actif = (f: FinaliteConsentement) =>
    d.consentements.some((c) => c.finalite === f && c.dateRetrait === null);
  const suppressionOuverte = d.demandes.find(
    (x) => x.type === 'SUPPRESSION' && (x.statut === 'RECUE' || x.statut === 'EN_COURS'),
  );

  return (
    <div className="pile">
      <div className="grille grille--2">
        <Carte titre="Données de mon compte (droit d’accès)">
          <dl className="definitions">
            <div>
              <dt>Nom / Prénom</dt>
              <dd>
                {compte.nom} {compte.prenom}
              </dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{compte.email}</dd>
            </div>
            <div>
              <dt>Rôle</dt>
              <dd>{ROLES[compte.role]}</dd>
            </div>
            {compte.entreprise && (
              <div>
                <dt>Entreprise de rattachement</dt>
                <dd>{compte.entreprise.raisonSociale}</dd>
              </div>
            )}
            <div>
              <dt>Dernière connexion</dt>
              <dd>{formaterDateHeure(compte.dateDerniereConnexion)}</dd>
            </div>
            <div>
              <dt>Données de parcours</dt>
              <dd>
                {pluriel(d.inscriptions.length, 'inscription')},{' '}
                {pluriel(d.evaluations.length, 'note')}, {pluriel(d.documents.length, 'document')},{' '}
                {pluriel(d.satisfaction.length, 'avis')}
              </dd>
            </div>
          </dl>
          <div className="rangee">
            <Bouton variante="secondaire" onClick={() => ouvrir(setRectification)}>
              Corriger mes informations
            </Bouton>
            <Bouton variante="secondaire" chargement={export_} onClick={() => void telecharger()}>
              Télécharger mes données
            </Bouton>
          </div>
          <p className="note">
            Le fichier téléchargé (JSON) contient l’ensemble des données vous concernant.
          </p>
        </Carte>

        <div className="pile">
          <Carte titre="Consentements">
            <Tableau
              legende="Historique des consentements"
              lignes={d.consentements}
              cleLigne={(c) => c.id}
              colonnes={[
                {
                  cle: 'finalite',
                  entete: 'Finalité',
                  enteteLigne: true,
                  rendu: (c: Consentement) => FINALITES_CONSENTEMENT[c.finalite],
                },
                { cle: 'version', entete: 'Version', rendu: (c) => c.versionMentions },
                { cle: 'date', entete: 'Date', rendu: (c) => formaterDate(c.dateConsentement) },
                {
                  cle: 'statut',
                  entete: 'Statut',
                  rendu: (c) =>
                    c.dateRetrait ? (
                      <Badge variante="neutre">Retiré le {formaterDate(c.dateRetrait)}</Badge>
                    ) : (
                      <Badge variante="succes">Donné</Badge>
                    ),
                },
              ]}
            />
            <div className="rangee" style={{ marginTop: 'var(--espace-3)' }}>
              <Bouton
                variante="secondaire"
                petit
                chargement={consentement.isPending}
                onClick={() =>
                  consentement.mutate({
                    finalite: 'QUESTIONNAIRES_SATISFACTION',
                    donner: !actif('QUESTIONNAIRES_SATISFACTION'),
                  })
                }
              >
                {actif('QUESTIONNAIRES_SATISFACTION')
                  ? 'Retirer mon accord aux questionnaires de satisfaction'
                  : 'Accepter les questionnaires de satisfaction'}
              </Bouton>
            </div>
            <p className="note">
              Le consentement à la gestion du compte est nécessaire à son existence : pour y
              renoncer, demandez la suppression de votre compte.
            </p>
          </Carte>

          <Carte titre="Demande de suppression">
            <p>
              Votre demande sera traitée par un administrateur. Les données statistiques sont
              anonymisées, vos données personnelles sont effacées.
            </p>
            {suppressionOuverte ? (
              <Alerte type="info">
                <p>
                  Votre demande {suppressionOuverte.numero} est en cours de traitement (reçue le{' '}
                  {formaterDate(suppressionOuverte.dateDemande)}).
                </p>
              </Alerte>
            ) : (
              <Bouton variante="danger" onClick={() => ouvrir(setSuppression)}>
                Demander la suppression de mon compte
              </Bouton>
            )}
          </Carte>
        </div>
      </div>

      <MesDemandes d={d} />

      <DialogueRectification
        key={`rectification-${ouvertures}`}
        ouvert={rectification}
        compte={compte}
        surFermeture={() => setRectification(false)}
        surSucces={(maj) => {
          mettreAJour(maj);
          mettreAJourUtilisateur({ ...moi, nom: maj.compte.nom, prenom: maj.compte.prenom });
          notifier.succes('Vos informations ont été corrigées.');
        }}
      />
      <DialogueDemande
        key={`suppression-${ouvertures}`}
        ouvert={suppression}
        type="SUPPRESSION"
        surFermeture={() => setSuppression(false)}
      />
    </div>
  );
}

function MesDemandes({ d }: { d: MesDonnees }) {
  const [type, setType] = useState<TypeDemandeRgpd>('ACCES');
  const [ouvert, setOuvert] = useState(false);
  const [ouvertures, setOuvertures] = useState(0);
  const ouvrir = (t: TypeDemandeRgpd) => {
    setType(t);
    setOuvertures((n) => n + 1);
    setOuvert(true);
  };
  return (
    <Carte
      titre="Mes demandes"
      actions={
        <div className="rangee">
          <Bouton variante="secondaire" petit onClick={() => ouvrir('ACCES')}>
            Demande d’accès
          </Bouton>
          <Bouton variante="secondaire" petit onClick={() => ouvrir('RECTIFICATION')}>
            Demande de rectification
          </Bouton>
        </div>
      }
    >
      <Tableau
        legende="Historique de mes demandes RGPD"
        legendeMasquee
        lignes={d.demandes}
        cleLigne={(x) => x.id}
        vide="Aucune demande déposée."
        colonnes={[
          { cle: 'numero', entete: 'N°', enteteLigne: true, rendu: (x) => x.numero },
          { cle: 'type', entete: 'Type', rendu: (x) => TYPES_DEMANDE_RGPD[x.type] },
          { cle: 'date', entete: 'Reçue le', rendu: (x) => formaterDate(x.dateDemande) },
          {
            cle: 'statut',
            entete: 'Statut',
            rendu: (x) => <BadgeStatut statut={x.statut} libelles={STATUTS_DEMANDE_RGPD} />,
          },
          { cle: 'reponse', entete: 'Réponse', rendu: (x) => x.reponse ?? '—' },
        ]}
      />
      <p className="note">
        Une rectification des données non modifiables par vous-même (email, notes) est transmise à
        l’administration.
      </p>
      <DialogueDemande
        key={ouvertures}
        ouvert={ouvert}
        type={type}
        surFermeture={() => setOuvert(false)}
      />
    </Carte>
  );
}

function DialogueRectification({
  ouvert,
  compte,
  surFermeture,
  surSucces,
}: {
  ouvert: boolean;
  compte: MesDonnees['compte'];
  surFermeture: () => void;
  surSucces: (maj: MesDonnees) => void;
}) {
  const [saisie, setSaisie] = useState({ nom: compte.nom, prenom: compte.prenom });
  const envoyer = useMutation({
    mutationFn: () => rgpdApi.rectifier(saisie),
    onSuccess: (maj) => {
      surSucces(maj);
      surFermeture();
    },
  });
  const erreurs = envoyer.error instanceof ErreurApi ? envoyer.error.erreursChamps : {};
  const surEnvoi = (e: FormEvent) => {
    e.preventDefault();
    envoyer.mutate();
  };
  return (
    <Dialogue
      ouvert={ouvert}
      surChangement={(o) => !o && surFermeture()}
      titre="Corriger mes informations"
      description="Pour modifier votre adresse email, déposez une demande de rectification."
    >
      <form onSubmit={surEnvoi} noValidate aria-label="Rectification de mes informations">
        {envoyer.error && !Object.keys(erreurs).length && <AlerteErreur erreur={envoyer.error} />}
        <ChampTexte
          libelle="Nom"
          obligatoire
          autoComplete="family-name"
          value={saisie.nom}
          onChange={(e) => setSaisie({ ...saisie, nom: e.target.value })}
          erreur={erreurs.nom}
        />
        <ChampTexte
          libelle="Prénom"
          obligatoire
          autoComplete="given-name"
          value={saisie.prenom}
          onChange={(e) => setSaisie({ ...saisie, prenom: e.target.value })}
          erreur={erreurs.prenom}
        />
        <div className="dialogue__actions">
          <Bouton variante="secondaire" onClick={surFermeture}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={envoyer.isPending}>
            Enregistrer
          </Bouton>
        </div>
      </form>
    </Dialogue>
  );
}

const TITRES_DEMANDE: Record<TypeDemandeRgpd, string> = {
  ACCES: 'Demande d’accès à mes données',
  RECTIFICATION: 'Demande de rectification',
  SUPPRESSION: 'Demander la suppression de mon compte',
};

function DialogueDemande({
  ouvert,
  type,
  surFermeture,
}: {
  ouvert: boolean;
  type: TypeDemandeRgpd;
  surFermeture: () => void;
}) {
  const client = useQueryClient();
  const notifier = useNotifier();
  const [message, setMessage] = useState('');
  const envoyer = useMutation({
    mutationFn: () => rgpdApi.demander(type, message.trim() || undefined),
    onSuccess: (d) => {
      void client.invalidateQueries({ queryKey: clesRgpd.mesDonnees });
      notifier.succes(`Votre demande ${d.numero} a été transmise à l’administration.`);
      surFermeture();
    },
  });
  const suppression = type === 'SUPPRESSION';
  return (
    <Dialogue
      ouvert={ouvert}
      surChangement={(o) => !o && surFermeture()}
      titre={TITRES_DEMANDE[type]}
      description={
        suppression
          ? 'Après traitement, votre compte sera fermé : vos données personnelles seront effacées et votre historique anonymisé. Cette action est irréversible.'
          : 'Votre demande est transmise à l’administration, qui vous répondra dans les meilleurs délais.'
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          envoyer.mutate();
        }}
        noValidate
        aria-label={TITRES_DEMANDE[type]}
      >
        {envoyer.error && <AlerteErreur erreur={envoyer.error} />}
        <ChampZoneTexte
          libelle={suppression ? 'Motif (facultatif)' : 'Précisions (facultatif)'}
          indice="1 000 caractères au plus."
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="dialogue__actions">
          <Bouton variante="secondaire" onClick={surFermeture}>
            Annuler
          </Bouton>
          <Bouton
            type="submit"
            variante={suppression ? 'danger' : 'primaire'}
            chargement={envoyer.isPending}
          >
            {suppression ? 'Confirmer la demande de suppression' : 'Envoyer la demande'}
          </Bouton>
        </div>
      </form>
    </Dialogue>
  );
}
