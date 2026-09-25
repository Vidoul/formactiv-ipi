import { Link } from 'react-router';
import { PagePublique } from '../components/layout/PagePublique';

export default function PageIntrouvable() {
  return (
    <PagePublique titre="Page introuvable">
      <p>La page demandée n’existe pas ou a été déplacée.</p>
      <p>
        <Link to="/">Revenir à l’accueil</Link>
      </p>
    </PagePublique>
  );
}
