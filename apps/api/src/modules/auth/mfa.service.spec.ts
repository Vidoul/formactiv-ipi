import type { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { dechiffrer } from '../../common/securite/chiffrement';
import type { Environnement } from '../../config/environnement';
import { MfaService } from './mfa.service';

const CLE = '3c'.repeat(32);
const config = { get: () => CLE } as unknown as ConfigService<Environnement, true>;

describe('MfaService (RG-AUTH-03, US-04)', () => {
  const service = new MfaService(config);

  it('prépare un enrôlement : secret chiffré, URI otpauth et QR code', async () => {
    const e = await service.preparerEnrolement('nadia.rey@formactiv.fr');
    expect(e.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(e.secretChiffre).not.toContain(e.secret);
    expect(dechiffrer(e.secretChiffre, CLE)).toBe(e.secret);
    expect(e.uri).toContain('otpauth://totp/FORMACTIV:nadia.rey%40formactiv.fr');
    expect(e.qrCode.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('accepte le code courant et refuse un code erroné ou mal formé', async () => {
    const e = await service.preparerEnrolement('a@b.fr');
    const code = authenticator.generate(e.secret);
    expect(service.verifierCode(e.secretChiffre, code, null)).toEqual(expect.any(Number));
    const faux = code === '000000' ? '111111' : '000000';
    expect(service.verifierCode(e.secretChiffre, faux, null)).toBeNull();
    expect(service.verifierCode(e.secretChiffre, '12ab56', null)).toBeNull();
  });

  it('refuse le rejeu d’un code déjà utilisé', async () => {
    const e = await service.preparerEnrolement('a@b.fr');
    const code = authenticator.generate(e.secret);
    const pas = service.verifierCode(e.secretChiffre, code, null);
    expect(pas).not.toBeNull();
    expect(service.verifierCode(e.secretChiffre, code, pas)).toBeNull();
  });
});
