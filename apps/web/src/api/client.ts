/**
 * Client HTTP de l'API FORMACTIV.
 *
 * Sécurité (chapitre 10) :
 * - l'access token est conservé EN MÉMOIRE uniquement (jamais localStorage/sessionStorage) :
 *   un script injecté ne peut pas le lire à froid (protection XSS) ;
 * - le refresh token voyage dans un cookie httpOnly SameSite=Strict géré par le navigateur ;
 * - sur un 401, une seule tentative de rafraîchissement est faite (mutualisée entre requêtes
 *   concurrentes), puis la session est déclarée expirée.
 *
 * Rappel : le front n'est jamais une barrière de sécurité, tout contrôle est refait côté API.
 */

export const BASE_API = '/api/v1';

export interface CorpsErreurApi {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export interface ErreurChamp {
  champ: string;
  messages: string[];
}

export class ErreurApi extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ErreurApi';
  }

  /**
   * Erreurs par champ pour l'affichage en ligne : validation (400 VALIDATION) ou règle de gestion
   * rattachée à un champ (ex. 409 EMAIL_DEJA_UTILISE), qui partagent le format { champ, messages }.
   */
  get erreursChamps(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(
      (this.details as Partial<ErreurChamp>[])
        .filter((e): e is ErreurChamp => typeof e.champ === 'string' && Array.isArray(e.messages))
        .map((e) => [e.champ, e.messages.join(' ')]),
    );
  }
}

type Methode = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export type Parametres = Record<string, string | number | boolean | null | undefined>;

export interface OptionsRequete {
  methode?: Methode;
  corps?: unknown;
  params?: Parametres;
  signal?: AbortSignal;
  /** Ne pas tenter de rafraîchir la session sur 401 (routes d'authentification). */
  sansRafraichissement?: boolean;
  format?: 'json' | 'blob';
}

let jetonAcces: string | null = null;
let rafraichisseur: (() => Promise<boolean>) | null = null;
let surSessionExpiree: (() => void) | null = null;
let rafraichissementEnCours: Promise<boolean> | null = null;

export const sessionApi = {
  definirJeton(jeton: string | null): void {
    jetonAcces = jeton;
  },
  obtenirJeton(): string | null {
    return jetonAcces;
  },
  /** Fonction appelée sur 401 pour obtenir un nouvel access token (fournie par l'AuthProvider). */
  definirRafraichisseur(fn: (() => Promise<boolean>) | null): void {
    rafraichisseur = fn;
  },
  definirGestionnaireExpiration(fn: (() => void) | null): void {
    surSessionExpiree = fn;
  },
};

export function construireUrl(chemin: string, params?: Parametres): string {
  const recherche = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(params ?? {})) {
    if (valeur !== undefined && valeur !== null && valeur !== '') {
      recherche.set(cle, String(valeur));
    }
  }
  const qs = recherche.toString();
  return `${BASE_API}${chemin}${qs ? `?${qs}` : ''}`;
}

async function envoyer(chemin: string, options: OptionsRequete): Promise<Response> {
  const entetes: Record<string, string> = { Accept: 'application/json' };
  if (options.corps !== undefined) entetes['Content-Type'] = 'application/json';
  if (jetonAcces) entetes.Authorization = `Bearer ${jetonAcces}`;

  return fetch(construireUrl(chemin, options.params), {
    method: options.methode ?? 'GET',
    headers: entetes,
    body: options.corps !== undefined ? JSON.stringify(options.corps) : undefined,
    credentials: 'same-origin',
    signal: options.signal,
  });
}

async function lireErreur(reponse: Response): Promise<ErreurApi> {
  try {
    const corps = (await reponse.json()) as Partial<CorpsErreurApi>;
    return new ErreurApi(
      reponse.status,
      corps.code ?? 'ERREUR',
      corps.message ?? 'Une erreur est survenue.',
      corps.details,
    );
  } catch {
    return new ErreurApi(reponse.status, 'ERREUR', 'Le serveur est momentanément indisponible.');
  }
}

async function rafraichirUneFois(): Promise<boolean> {
  if (!rafraichisseur) return false;
  rafraichissementEnCours ??= rafraichisseur().finally(() => {
    rafraichissementEnCours = null;
  });
  return rafraichissementEnCours;
}

export async function requeteApi<T>(chemin: string, options: OptionsRequete = {}): Promise<T> {
  let reponse = await envoyer(chemin, options);

  if (reponse.status === 401 && !options.sansRafraichissement) {
    const renouvele = await rafraichirUneFois();
    if (renouvele) {
      reponse = await envoyer(chemin, options);
    } else {
      surSessionExpiree?.();
    }
  }

  if (!reponse.ok) throw await lireErreur(reponse);
  if (reponse.status === 204) return undefined as T;
  if (options.format === 'blob') return (await reponse.blob()) as T;
  const texte = await reponse.text();
  return (texte ? JSON.parse(texte) : undefined) as T;
}

export const api = {
  get: <T>(chemin: string, params?: Parametres, signal?: AbortSignal) =>
    requeteApi<T>(chemin, { params, signal }),
  post: <T>(chemin: string, corps?: unknown) =>
    requeteApi<T>(chemin, { methode: 'POST', corps: corps ?? {} }),
  patch: <T>(chemin: string, corps: unknown) => requeteApi<T>(chemin, { methode: 'PATCH', corps }),
  put: <T>(chemin: string, corps: unknown) => requeteApi<T>(chemin, { methode: 'PUT', corps }),
  delete: <T = void>(chemin: string) => requeteApi<T>(chemin, { methode: 'DELETE' }),

  /** Télécharge un fichier (PDF, CSV) en conservant le nom proposé par l'API. */
  async telecharger(chemin: string, params?: Parametres, nomParDefaut = 'export'): Promise<void> {
    let reponse = await envoyer(chemin, { params });
    if (reponse.status === 401 && (await rafraichirUneFois())) {
      reponse = await envoyer(chemin, { params });
    }
    if (!reponse.ok) throw await lireErreur(reponse);
    const nom = nomFichierDepuisEntete(reponse.headers.get('Content-Disposition')) ?? nomParDefaut;
    enregistrerFichier(await reponse.blob(), nom);
  },
};

export function nomFichierDepuisEntete(entete: string | null): string | undefined {
  if (!entete) return undefined;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(entete);
  if (utf8) return decodeURIComponent(utf8[1]);
  const simple = /filename="?([^";]+)"?/i.exec(entete);
  return simple?.[1];
}

export function enregistrerFichier(contenu: Blob, nom: string): void {
  const url = URL.createObjectURL(contenu);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
