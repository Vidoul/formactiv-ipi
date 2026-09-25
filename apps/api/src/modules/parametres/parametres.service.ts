import { Injectable, Logger } from '@nestjs/common';
import { CodeRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CATALOGUE_PARAMETRES, CleParametre, valeurParDefaut } from './catalogue-parametres';

const DUREE_CACHE_MS = 30_000;

/**
 * Lecture typée des paramètres de la plateforme, avec cache mémoire court (évite une requête par
 * appel sur les chemins chauds : authentification, gardes). Toute valeur absente ou invalide en
 * base retombe sur la valeur par défaut du catalogue (fonctionnement sûr).
 */
@Injectable()
export class ParametresService {
  private readonly logger = new Logger(ParametresService.name);
  private cache: { valeurs: Map<string, string>; expiration: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  invaliderCache(): void {
    this.cache = null;
  }

  private async valeursBrutes(): Promise<Map<string, string>> {
    if (this.cache && this.cache.expiration > Date.now()) return this.cache.valeurs;
    const lignes = await this.prisma.parametre.findMany();
    const valeurs = new Map(lignes.map((l) => [l.cle, l.valeur]));
    this.cache = { valeurs, expiration: Date.now() + DUREE_CACHE_MS };
    return valeurs;
  }

  private async brut(cle: CleParametre): Promise<string> {
    return (await this.valeursBrutes()).get(cle) ?? valeurParDefaut(cle);
  }

  async entier(cle: CleParametre): Promise<number> {
    const definition = CATALOGUE_PARAMETRES[cle];
    if (definition.type !== 'entier') throw new Error(`${cle} n'est pas un paramètre entier`);
    const valeur = Number.parseInt(await this.brut(cle), 10);
    if (Number.isNaN(valeur) || valeur < definition.min || valeur > definition.max) {
      this.logger.warn(`Paramètre ${cle} invalide en base : valeur par défaut appliquée`);
      return definition.defaut;
    }
    return valeur;
  }

  async roles(cle: CleParametre): Promise<CodeRole[]> {
    const brut = await this.brut(cle);
    const valides = new Set<string>(Object.values(CodeRole));
    return brut
      .split(',')
      .map((r) => r.trim())
      .filter((r): r is CodeRole => valides.has(r));
  }

  async texte(cle: CleParametre): Promise<string> {
    return this.brut(cle);
  }

  /** Rôles soumis à la double authentification obligatoire (RG-AUTH-03). */
  rolesMfaObligatoire(): Promise<CodeRole[]> {
    return this.roles(CleParametre.MFA_ROLES_OBLIGATOIRES);
  }

  async reglesVerrouillage(): Promise<{ tentativesMax: number; dureeMinutes: number }> {
    return {
      tentativesMax: await this.entier(CleParametre.CONNEXION_TENTATIVES_MAX),
      dureeMinutes: await this.entier(CleParametre.CONNEXION_DUREE_VERROUILLAGE_MIN),
    };
  }

  versionMentions(): Promise<string> {
    return this.texte(CleParametre.RGPD_VERSION_MENTIONS);
  }
}
