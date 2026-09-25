import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { RegleMetierException } from '../../common/exceptions/regle-metier.exception';
import type { Environnement } from '../../config/environnement';
import {
  MESSAGES_POLITIQUE,
  verifierPolitique,
  type IdentiteUtilisateur,
} from './regles/politique-mot-de-passe';

/** Service unique (fixe, liste blanche — OWASP A10) interrogé pour les mots de passe compromis. */
const URL_PWNED = 'https://api.pwnedpasswords.com/range/';

/**
 * Application de la politique RG-AUTH-01 lors de toute définition de mot de passe (activation,
 * réinitialisation, changement). Le mot de passe n'est jamais journalisé ni renvoyé.
 */
@Injectable()
export class MotDePasseService {
  private readonly logger = new Logger(MotDePasseService.name);

  constructor(private readonly config: ConfigService<Environnement, true>) {}

  async valider(motDePasse: string, identite: IdentiteUtilisateur): Promise<void> {
    const erreurs = verifierPolitique(motDePasse, identite);
    if (
      erreurs.length === 0 &&
      this.config.get('PASSWORD_PWNED_CHECK', { infer: true }) &&
      (await this.figureDansUneFuite(motDePasse))
    ) {
      erreurs.push('TROP_PREVISIBLE');
    }
    if (erreurs.length > 0) {
      throw new RegleMetierException(
        'MOT_DE_PASSE_NON_CONFORME',
        'Le mot de passe ne respecte pas la politique de sécurité.',
        HttpStatus.BAD_REQUEST,
        [{ champ: 'motDePasse', messages: erreurs.map((e) => MESSAGES_POLITIQUE[e]) }],
      );
    }
  }

  /**
   * Vérification k-anonymat (Have I Been Pwned) : seuls les 5 premiers caractères de l'empreinte
   * SHA-1 sont transmis. En cas d'indisponibilité, la liste locale seule s'applique.
   */
  private async figureDansUneFuite(motDePasse: string): Promise<boolean> {
    const sha1 = createHash('sha1').update(motDePasse).digest('hex').toUpperCase();
    const [prefixe, suffixe] = [sha1.slice(0, 5), sha1.slice(5)];
    try {
      const reponse = await fetch(`${URL_PWNED}${prefixe}`, {
        headers: { 'Add-Padding': 'true', 'User-Agent': 'FORMACTIV-API' },
        signal: AbortSignal.timeout(2000),
      });
      if (!reponse.ok) return false;
      return (await reponse.text())
        .split('\n')
        .some((ligne) => ligne.startsWith(suffixe) && !ligne.trim().endsWith(':0'));
    } catch (erreur) {
      this.logger.warn(`Service de mots de passe compromis indisponible : ${String(erreur)}`);
      return false;
    }
  }
}
