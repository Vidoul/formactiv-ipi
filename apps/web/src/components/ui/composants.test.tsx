import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Badge } from './Badge';
import { Bouton } from './Bouton';
import { CaseACocher, ChampSelection, ChampTexte } from './Champs';
import { DialogueConfirmation } from './Dialogue';
import { GraphiqueBarres } from './GraphiqueBarres';
import { Tableau } from './Tableau';

describe('Champs de formulaire (RGAA 11)', () => {
  it('associe étiquette, indice et erreur au champ', () => {
    render(
      <ChampTexte
        libelle="Mot de passe"
        type="password"
        indice="12 caractères minimum"
        erreur="Le mot de passe est trop court."
        obligatoire
      />,
    );
    const champ = screen.getByLabelText(/Mot de passe/);
    expect(champ).toBeRequired();
    expect(champ).toHaveAttribute('aria-invalid', 'true');
    expect(champ).toHaveAccessibleDescription(
      '12 caractères minimum Le mot de passe est trop court.',
    );
  });

  it("n'expose pas aria-invalid sans erreur", () => {
    render(<ChampSelection libelle="Rôle" options={[{ valeur: 'ADMIN', libelle: 'Admin' }]} />);
    expect(screen.getByLabelText('Rôle')).not.toHaveAttribute('aria-invalid');
  });

  it('rend une case à cocher non pré-cochée et étiquetée (RG-RGPD-01)', () => {
    render(<CaseACocher libelle="J'accepte le traitement de mes données" />);
    expect(screen.getByRole('checkbox', { name: /J'accepte/ })).not.toBeChecked();
  });
});

describe('Tableau de données (RGAA 5)', () => {
  const lignes = [
    { id: '1', nom: 'Léa Martin', note: 15 },
    { id: '2', nom: 'Paul Girard', note: 12 },
  ];

  it('déclare légende et en-têtes de colonnes et de lignes', () => {
    render(
      <Tableau
        legende="Notes de la session"
        lignes={lignes}
        cleLigne={(l) => l.id}
        colonnes={[
          { cle: 'nom', entete: 'Apprenant', rendu: (l) => l.nom, enteteLigne: true },
          { cle: 'note', entete: 'Note', rendu: (l) => l.note, nombre: true },
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Notes de la session' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(2);
    expect(within(table).getByRole('rowheader', { name: 'Léa Martin' })).toBeInTheDocument();
  });

  it('affiche un message explicite lorsque la liste est vide', () => {
    render(
      <Tableau
        legende="Vide"
        lignes={[]}
        cleLigne={() => ''}
        colonnes={[{ cle: 'a', entete: 'A', rendu: () => null }]}
        vide="Aucune session planifiée."
      />,
    );
    expect(screen.getByText('Aucune session planifiée.')).toBeInTheDocument();
  });
});

describe('GraphiqueBarres', () => {
  it('fournit un tableau de valeurs équivalent au graphique (RGAA 1.3)', () => {
    render(
      <GraphiqueBarres
        titre="Connexions par jour"
        serie="Connexions réussies"
        donnees={[
          { libelle: 'Lu', libelleLong: 'Lundi', valeur: 52 },
          { libelle: 'Ma', libelleLong: 'Mardi', valeur: 61 },
        ]}
      />,
    );
    expect(screen.getByRole('figure', { name: 'Connexions par jour' })).toBeInTheDocument();
    const alternative = screen.getByRole('table', { name: /Connexions par jour/ });
    expect(within(alternative).getByRole('rowheader', { name: 'Lundi' })).toBeInTheDocument();
    expect(within(alternative).getByText('61')).toBeInTheDocument();
  });
});

describe('Badge', () => {
  it("porte toujours l'information par un libellé texte", () => {
    render(<Badge variante="succes">Validée</Badge>);
    expect(screen.getByText('Validée')).toHaveClass('badge--succes');
  });
});

describe('Bouton', () => {
  it('signale un traitement en cours et empêche le double envoi', () => {
    render(<Bouton chargement>Enregistrer</Bouton>);
    const bouton = screen.getByRole('button', { name: 'Enregistrer' });
    expect(bouton).toBeDisabled();
    expect(bouton).toHaveAttribute('aria-busy', 'true');
  });
});

describe('DialogueConfirmation', () => {
  function Exemple({ surConfirmation }: { surConfirmation: () => void }) {
    const [ouvert, setOuvert] = useState(false);
    return (
      <>
        <Bouton onClick={() => setOuvert(true)}>Supprimer le compte</Bouton>
        <DialogueConfirmation
          ouvert={ouvert}
          surChangement={setOuvert}
          titre="Supprimer ce compte ?"
          message="Les données personnelles seront effacées (RG-CPT-02)."
          libelleConfirmation="Confirmer la suppression"
          surConfirmation={surConfirmation}
          danger
        />
      </>
    );
  }

  it('demande une confirmation explicite, se ferme par Échap et rend le focus', async () => {
    const utilisateur = userEvent.setup();
    const surConfirmation = vi.fn();
    render(<Exemple surConfirmation={surConfirmation} />);

    const declencheur = screen.getByRole('button', { name: 'Supprimer le compte' });
    await utilisateur.click(declencheur);
    const dialogue = screen.getByRole('dialog', { name: 'Supprimer ce compte ?' });
    expect(dialogue).toHaveAccessibleDescription(/RG-CPT-02/);

    await utilisateur.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(declencheur).toHaveFocus();
    expect(surConfirmation).not.toHaveBeenCalled();

    await utilisateur.click(declencheur);
    await utilisateur.click(screen.getByRole('button', { name: 'Confirmer la suppression' }));
    expect(surConfirmation).toHaveBeenCalledOnce();
  });
});
