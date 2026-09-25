import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { chiffrer, dechiffrer } from '../../common/securite/chiffrement';
import type { Environnement } from '../../config/environnement';

const EMETTEUR_TOTP = 'FORMACTIV';
const PAS_SECONDES = 30;

/**
 * Double authentification TOTP (RFC 6238) compatible avec les applications standard
 * (Google Authenticator, FreeOTP, Microsoft Authenticator…) — US-04, RG-AUTH-03.
 */
@Injectable()
export class MfaService {
  constructor(private readonly config: ConfigService<Environnement, true>) {
    // Tolérance d'un pas (±30 s) pour absorber le décalage d'horloge du téléphone.
    authenticator.options = { window: 1, step: PAS_SECONDES, digits: 6 };
  }

  private get cle(): string {
    return this.config.get('MFA_ENCRYPTION_KEY', { infer: true });
  }

  /** Nouveau secret (160 bits) chiffré pour stockage, et éléments d'enrôlement pour l'utilisateur. */
  async preparerEnrolement(email: string): Promise<{
    secretChiffre: string;
    secret: string;
    uri: string;
    qrCode: string;
  }> {
    const secret = authenticator.generateSecret(20);
    const uri = authenticator.keyuri(email, EMETTEUR_TOTP, secret);
    const qrCode = await QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
    });
    return { secretChiffre: chiffrer(secret, this.cle), secret, uri, qrCode };
  }

  /**
   * Vérifie un code et retourne le pas de temps accepté, ou null. Un code déjà utilisé (pas
   * inférieur ou égal au dernier accepté) est refusé : protection contre le rejeu.
   */
  verifierCode(secretChiffre: string, code: string, dernierPas: number | null): number | null {
    if (!/^\d{6}$/.test(code)) return null;
    const secret = dechiffrer(secretChiffre, this.cle);
    const ecart = authenticator.checkDelta(code, secret);
    if (ecart === null) return null;
    const pas = Math.floor(Date.now() / 1000 / PAS_SECONDES) + ecart;
    if (dernierPas !== null && pas <= dernierPas) return null;
    return pas;
  }
}
