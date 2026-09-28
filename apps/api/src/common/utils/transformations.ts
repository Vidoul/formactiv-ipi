import { Transform } from 'class-transformer';

/** Supprime les espaces superflus d'une chaîne reçue (les autres types sont laissés intacts). */
export const Nettoyer = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Normalise une adresse email (identifiant de connexion insensible à la casse). */
export const NormaliserEmail = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

/** Paramètre de requête booléen (« true » / « false »). */
export const BooleenRequete = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  );
