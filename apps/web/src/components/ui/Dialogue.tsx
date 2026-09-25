import * as RadixDialog from '@radix-ui/react-dialog';
import { useRef, type ReactNode } from 'react';
import { Bouton } from './Bouton';

interface DialogueProps {
  ouvert: boolean;
  surChangement: (ouvert: boolean) => void;
  titre: string;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  large?: boolean;
}

/**
 * Fenêtre modale conforme au motif ARIA « dialog » (Radix UI) : piège du focus, fermeture par
 * Échap, retour du focus sur l'élément déclencheur, titre et description annoncés (RGAA 7.1).
 */
export function Dialogue({
  ouvert,
  surChangement,
  titre,
  description,
  children,
  actions,
  large = false,
}: DialogueProps) {
  // Élément ayant ouvert le dialogue : le focus y revient à la fermeture (RGAA 7.1, 12.8),
  // y compris lorsque l'ouverture est pilotée par l'état et non par un Dialog.Trigger.
  const declencheur = useRef<HTMLElement | null>(null);
  return (
    <RadixDialog.Root open={ouvert} onOpenChange={surChangement}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialogue__voile" />
        <RadixDialog.Content
          className={`dialogue${large ? ' dialogue--large' : ''}`}
          onOpenAutoFocus={() => {
            declencheur.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(evenement) => {
            evenement.preventDefault();
            declencheur.current?.focus();
          }}
          // Sans description, on l'indique explicitement à Radix (pas d'aria-describedby vide).
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <RadixDialog.Title className="dialogue__titre">{titre}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="dialogue__description">
              {description}
            </RadixDialog.Description>
          ) : null}
          {children}
          {actions && <div className="dialogue__actions">{actions}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

interface ConfirmationProps {
  ouvert: boolean;
  surChangement: (ouvert: boolean) => void;
  titre: string;
  message: ReactNode;
  libelleConfirmation: string;
  surConfirmation: () => void;
  danger?: boolean;
  chargement?: boolean;
}

/** Confirmation explicite des actions destructrices (principe UX du chapitre 11). */
export function DialogueConfirmation({
  ouvert,
  surChangement,
  titre,
  message,
  libelleConfirmation,
  surConfirmation,
  danger = false,
  chargement = false,
}: ConfirmationProps) {
  return (
    <Dialogue
      ouvert={ouvert}
      surChangement={surChangement}
      titre={titre}
      description={message}
      actions={
        <>
          <Bouton variante="secondaire" onClick={() => surChangement(false)}>
            Annuler
          </Bouton>
          <Bouton
            variante={danger ? 'danger' : 'primaire'}
            onClick={surConfirmation}
            chargement={chargement}
          >
            {libelleConfirmation}
          </Bouton>
        </>
      }
    />
  );
}
