import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/**
 * Champs de formulaire accessibles (RGAA 11) :
 * - étiquette `<label>` toujours associée au champ ;
 * - indice et message d'erreur reliés par `aria-describedby` ;
 * - champ en erreur signalé par `aria-invalid` et un message textuel explicite ;
 * - caractère obligatoire indiqué visuellement ET par l'attribut `required`.
 */
interface ProprietesCommunes {
  libelle: ReactNode;
  indice?: ReactNode;
  erreur?: string;
  obligatoire?: boolean;
  className?: string;
}

function useDescriptions(id: string, indice?: ReactNode, erreur?: string) {
  const idIndice = indice ? `${id}-indice` : undefined;
  const idErreur = erreur ? `${id}-erreur` : undefined;
  const decrit = [idIndice, idErreur].filter(Boolean).join(' ') || undefined;
  return { idIndice, idErreur, decrit };
}

function Enveloppe({
  id,
  libelle,
  indice,
  erreur,
  obligatoire,
  className,
  children,
}: ProprietesCommunes & { id: string; children: ReactNode }) {
  const { idIndice, idErreur } = useDescriptions(id, indice, erreur);
  return (
    <div className={['champ', className].filter(Boolean).join(' ')}>
      <label className="champ__libelle" htmlFor={id}>
        {libelle}
        {obligatoire && (
          <span className="champ__obligatoire" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {indice && (
        <p className="champ__indice" id={idIndice}>
          {indice}
        </p>
      )}
      {erreur && (
        <p className="champ__erreur" id={idErreur}>
          {erreur}
        </p>
      )}
    </div>
  );
}

export function ChampTexte({
  libelle,
  indice,
  erreur,
  obligatoire,
  className,
  id: idFourni,
  ...saisie
}: ProprietesCommunes & InputHTMLAttributes<HTMLInputElement>) {
  const idGenere = useId();
  const id = idFourni ?? idGenere;
  const { decrit } = useDescriptions(id, indice, erreur);
  return (
    <Enveloppe {...{ id, libelle, indice, erreur, obligatoire, className }}>
      <input
        id={id}
        className="champ__saisie"
        required={obligatoire}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={decrit}
        {...saisie}
      />
    </Enveloppe>
  );
}

export interface OptionSelection {
  valeur: string;
  libelle: string;
}

export function ChampSelection({
  libelle,
  indice,
  erreur,
  obligatoire,
  className,
  options,
  optionVide,
  id: idFourni,
  ...selection
}: ProprietesCommunes &
  SelectHTMLAttributes<HTMLSelectElement> & { options: OptionSelection[]; optionVide?: string }) {
  const idGenere = useId();
  const id = idFourni ?? idGenere;
  const { decrit } = useDescriptions(id, indice, erreur);
  return (
    <Enveloppe {...{ id, libelle, indice, erreur, obligatoire, className }}>
      <select
        id={id}
        className="champ__saisie"
        required={obligatoire}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={decrit}
        {...selection}
      >
        {optionVide !== undefined && <option value="">{optionVide}</option>}
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </Enveloppe>
  );
}

export function ChampZoneTexte({
  libelle,
  indice,
  erreur,
  obligatoire,
  className,
  id: idFourni,
  ...zone
}: ProprietesCommunes & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const idGenere = useId();
  const id = idFourni ?? idGenere;
  const { decrit } = useDescriptions(id, indice, erreur);
  return (
    <Enveloppe {...{ id, libelle, indice, erreur, obligatoire, className }}>
      <textarea
        id={id}
        className="champ__saisie"
        required={obligatoire}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={decrit}
        {...zone}
      />
    </Enveloppe>
  );
}

export function CaseACocher({
  libelle,
  indice,
  id: idFourni,
  ...saisie
}: { libelle: ReactNode; indice?: ReactNode } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
>) {
  const idGenere = useId();
  const id = idFourni ?? idGenere;
  const idIndice = indice ? `${id}-indice` : undefined;
  return (
    <div className="case">
      <input id={id} type="checkbox" aria-describedby={idIndice} {...saisie} />
      <div>
        <label htmlFor={id}>{libelle}</label>
        {indice && (
          <p className="champ__indice" id={idIndice}>
            {indice}
          </p>
        )}
      </div>
    </div>
  );
}
