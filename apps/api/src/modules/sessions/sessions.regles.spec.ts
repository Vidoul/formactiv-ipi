import { StatutInscription } from '@prisma/client';
import { aujourdhui } from '../../common/utils/dates';
import {
  aDesPrerequis,
  capaciteAtteinte,
  controlerTransition,
} from '../inscriptions/inscriptions.regles';
import {
  alerteSansFormateur,
  chevauchent,
  controlerDates,
  notesManquantes,
  premierJourCommun,
  statutTemporel,
} from './sessions.regles';

describe('Règles des sessions (UC-05)', () => {
  it('RG-SESS-01 : refuse une fin antérieure au début, accepte une session d’un jour', () => {
    expect(controlerDates('2026-09-18', '2026-09-14')).toMatch(/RG-SESS-01/);
    expect(controlerDates('2026-09-14', '2026-09-14')).toBeNull();
  });

  it('calcule le statut temporel d’une session', () => {
    expect(statutTemporel('2026-09-14', '2026-09-18', '2026-09-10')).toBe('A_VENIR');
    expect(statutTemporel('2026-09-14', '2026-09-18', '2026-09-14')).toBe('EN_COURS');
    expect(statutTemporel('2026-09-14', '2026-09-18', '2026-09-19')).toBe('TERMINEE');
  });

  it('détecte les conflits d’agenda d’un formateur et leur premier jour', () => {
    const a = { debut: '2026-09-14', fin: '2026-09-18' };
    const b = { debut: '2026-09-15', fin: '2026-09-16' };
    expect(chevauchent(a, b)).toBe(true);
    expect(premierJourCommun(a, b)).toBe('2026-09-15');
    expect(chevauchent(a, { debut: '2026-09-19', fin: '2026-09-20' })).toBe(false);
  });

  it('RG-SESS-02 : alerte si aucun formateur à moins de N jours du début', () => {
    expect(alerteSansFormateur(0, '2026-09-20', '2026-09-10', 14)).toBe(true);
    expect(alerteSansFormateur(0, '2026-10-30', '2026-09-10', 14)).toBe(false);
    expect(alerteSansFormateur(1, '2026-09-20', '2026-09-10', 14)).toBe(false);
    expect(alerteSansFormateur(0, '2026-09-01', '2026-09-10', 14)).toBe(false);
  });

  it('compte les notes manquantes (apprenants évaluables × compétences − notes)', () => {
    expect(notesManquantes(6, 2, 10)).toBe(2);
    expect(notesManquantes(3, 3, 9)).toBe(0);
  });

  it("évalue « aujourd'hui » dans le fuseau de Paris", () => {
    // 23 h UTC le 25/09 = 1 h du matin le 26/09 à Paris (heure d'été).
    expect(aujourdhui(new Date('2026-09-25T23:00:00Z'))).toBe('2026-09-26');
  });
});

describe('Règles des inscriptions (UC-06)', () => {
  const ctx = { sessionTerminee: false, prerequisRequis: false, prerequisVerifies: false };

  it('RG-INSC-02 : suit le cycle en attente → validée → terminée / annulée', () => {
    expect(controlerTransition('EN_ATTENTE', 'VALIDEE', ctx)).toBeNull();
    expect(controlerTransition('VALIDEE', 'ANNULEE', ctx)).toBeNull();
    expect(controlerTransition('EN_ATTENTE', 'TERMINEE', ctx)?.code).toBe(
      'TRANSITION_STATUT_INVALIDE',
    );
    expect(controlerTransition('ANNULEE', 'VALIDEE', ctx)?.code).toBe('TRANSITION_STATUT_INVALIDE');
  });

  it('RG-INSC-03 : exige la vérification des prérequis pour valider', () => {
    const avecPrerequis = { ...ctx, prerequisRequis: true };
    expect(controlerTransition('EN_ATTENTE', 'VALIDEE', avecPrerequis)?.code).toBe(
      'PREREQUIS_A_VERIFIER',
    );
    expect(
      controlerTransition('EN_ATTENTE', 'VALIDEE', { ...avecPrerequis, prerequisVerifies: true }),
    ).toBeNull();
  });

  it('ne termine une inscription qu’après la fin de la session', () => {
    expect(controlerTransition(StatutInscription.VALIDEE, 'TERMINEE', ctx)?.code).toBe(
      'SESSION_NON_TERMINEE',
    );
    expect(
      controlerTransition('VALIDEE', 'TERMINEE', { ...ctx, sessionTerminee: true }),
    ).toBeNull();
  });

  it('RG-SESS-03 : refuse au-delà de la capacité maximale, illimité sinon', () => {
    expect(capaciteAtteinte(12, 12)).toBe(true);
    expect(capaciteAtteinte(12, 11)).toBe(false);
    expect(capaciteAtteinte(null, 500)).toBe(false);
  });

  it('reconnaît l’absence de prérequis', () => {
    expect(aDesPrerequis('Aucun')).toBe(false);
    expect(aDesPrerequis(' néant ')).toBe(false);
    expect(aDesPrerequis('Bases en informatique')).toBe(true);
  });
});
