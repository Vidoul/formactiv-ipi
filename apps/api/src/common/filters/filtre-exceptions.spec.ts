import { BadRequestException, ForbiddenException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RegleMetierException } from '../exceptions/regle-metier.exception';
import { normaliserException } from './filtre-exceptions';

describe('normaliserException', () => {
  it('conserve le code métier des violations de règles de gestion', () => {
    const corps = normaliserException(
      new RegleMetierException('INSCRIPTION_EXISTANTE', 'Déjà inscrit (RG-INSC-01)'),
    );
    expect(corps).toEqual({
      statusCode: 409,
      code: 'INSCRIPTION_EXISTANTE',
      message: 'Déjà inscrit (RG-INSC-01)',
    });
  });

  it('associe un code générique aux exceptions HTTP standard', () => {
    expect(normaliserException(new ForbiddenException()).code).toBe('ACCES_REFUSE');
    expect(normaliserException(new BadRequestException(['a', 'b'])).message).toBe('a ; b');
  });

  it("traduit les erreurs d'unicité Prisma en 409 sans exposer la requête", () => {
    const erreur = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on email', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const corps = normaliserException(erreur);
    expect(corps.statusCode).toBe(HttpStatus.CONFLICT);
    expect(corps.code).toBe('CONFLIT_UNICITE');
    expect(corps.message).not.toMatch(/email/);
  });

  it('masque le détail des erreurs inattendues (OWASP A05)', () => {
    const corps = normaliserException(new Error('connexion refusée à 10.0.0.12:5432'));
    expect(corps).toEqual({
      statusCode: 500,
      code: 'ERREUR_INTERNE',
      message: 'Une erreur interne est survenue.',
    });
  });
});
