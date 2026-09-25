import { chiffrer, dechiffrer } from './chiffrement';
import { hacherMotDePasse, verifierMotDePasse } from './hachage';
import { egaliteConstante, empreinte, genererJeton, signer } from './jetons';

const CLE = 'ab'.repeat(32);

describe('chiffrement AES-256-GCM (secrets MFA)', () => {
  it('chiffre de façon non déterministe et déchiffre à l’identique', () => {
    const a = chiffrer('JBSWY3DPEHPK3PXP', CLE);
    const b = chiffrer('JBSWY3DPEHPK3PXP', CLE);
    expect(a).not.toBe(b);
    expect(a.startsWith('v1.')).toBe(true);
    expect(dechiffrer(a, CLE)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('refuse une donnée altérée (chiffrement authentifié)', () => {
    const [v, iv, tag, chiffre] = chiffrer('secret', CLE).split('.');
    const altere = [v, iv, tag, Buffer.from('autre').toString('base64url') + chiffre].join('.');
    expect(() => dechiffrer(altere, CLE)).toThrow();
  });

  it('refuse le déchiffrement avec une autre clé', () => {
    expect(() => dechiffrer(chiffrer('secret', CLE), 'cd'.repeat(32))).toThrow();
  });
});

describe('jetons opaques', () => {
  it('génère des jetons de 256 bits distincts et ne stocke que leur empreinte', () => {
    const j1 = genererJeton();
    expect(j1).toHaveLength(43);
    expect(genererJeton()).not.toBe(j1);
    expect(empreinte(j1)).toMatch(/^[0-9a-f]{64}$/);
    expect(empreinte(j1)).not.toContain(j1);
  });

  it('compare les signatures en temps constant', () => {
    const s = signer('document:1:1700000000', 'secret');
    expect(egaliteConstante(s, signer('document:1:1700000000', 'secret'))).toBe(true);
    expect(egaliteConstante(s, signer('document:2:1700000000', 'secret'))).toBe(false);
    expect(egaliteConstante(s, 'court')).toBe(false);
  });
});

describe('hachage Argon2id (REQ-SEC-001)', () => {
  it('produit un hash argon2id salé et vérifiable', async () => {
    const hash = await hacherMotDePasse('Formactiv#2026');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('Formactiv#2026');
    await expect(verifierMotDePasse(hash, 'Formactiv#2026')).resolves.toBe(true);
    await expect(verifierMotDePasse(hash, 'formactiv#2026')).resolves.toBe(false);
    await expect(verifierMotDePasse('hash-invalide', 'x')).resolves.toBe(false);
  });
});
