import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { rendre, utilisateurTest } from '../../test/rendu';
import { usePage } from './ContextePage';
import { Gabarit } from './Gabarit';

function PageExemple() {
  usePage('Planifier une session', [{ libelle: 'Sessions', chemin: '/sessions' }]);
  return <h1>Planifier une session</h1>;
}

function rendreGabarit(role = utilisateurTest().role, surDeconnexion = vi.fn()) {
  return rendre(
    <Routes>
      <Route
        element={
          <Gabarit utilisateur={utilisateurTest({ role })} surDeconnexion={surDeconnexion} />
        }
      >
        <Route path="/sessions" element={<PageExemple />} />
      </Route>
    </Routes>,
    { route: '/sessions' },
  );
}

describe('Gabarit général (écran Figma 03)', () => {
  it('propose un lien d’évitement vers le contenu principal (RGAA 12.7)', () => {
    rendreGabarit();
    const lien = screen.getByRole('link', { name: 'Aller au contenu' });
    expect(lien).toHaveAttribute('href', '#contenu');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenu');
  });

  it('affiche le menu du rôle et signale la page courante', () => {
    rendreGabarit();
    const navigation = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(navigation).toHaveTextContent('Formations');
    expect(within(navigation).getByRole('link', { name: 'Sessions' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('adapte la navigation au profil (Apprenant)', () => {
    rendreGabarit('APPRENANT');
    expect(screen.getByRole('link', { name: 'Mon parcours' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Formations' })).not.toBeInTheDocument();
  });

  it('met à jour le titre du document et le fil d’Ariane (RGAA 8.6)', () => {
    rendreGabarit();
    expect(document.title).toBe('Planifier une session — FORMACTIV');
    const ariane = screen.getByRole('navigation', { name: "Fil d'Ariane" });
    const elements = within(ariane)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(elements).toEqual([
      'Accueil',
      'Responsable formation',
      'Sessions',
      'Planifier une session',
    ]);
    expect(within(ariane).getByText('Planifier une session')).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('donne un accès permanent à Mes données (RGPD) et à la déconnexion', async () => {
    const surDeconnexion = vi.fn();
    rendreGabarit('FORMATEUR', surDeconnexion);
    expect(screen.getAllByRole('link', { name: 'Mes données (RGPD)' })[0]).toHaveAttribute(
      'href',
      '/rgpd/mes-donnees',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Déconnexion' }));
    expect(surDeconnexion).toHaveBeenCalledOnce();
  });

  it('ouvre et ferme le menu du compte au clavier', async () => {
    const u = userEvent.setup();
    rendreGabarit();
    const bouton = screen.getByRole('button', { name: /Nadia Rey — menu du compte/ });
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    await u.click(bouton);
    expect(bouton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Sécurité du compte' })).toBeInTheDocument();
    await u.keyboard('{Escape}');
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
  });
});
