import { ValidateBy, type ValidationOptions } from 'class-validator';
import { dateIsoValide, MESSAGE_DATE } from '../utils/dates';

/** Date calendaire « AAAA-MM-JJ » réellement existante (colonnes DATE, filtres de période). */
export function EstDateIso(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'estDateIso',
      validator: {
        validate: (valeur: unknown) => typeof valeur === 'string' && dateIsoValide(valeur),
        defaultMessage: () => MESSAGE_DATE,
      },
    },
    options,
  );
}
