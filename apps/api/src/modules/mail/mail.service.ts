import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Environnement } from '../../config/environnement';

export interface MessageEmail {
  destinataire: string;
  sujet: string;
  texte: string;
  html: string;
}

/**
 * Service de messagerie (acteur secondaire du chapitre 5) : liens de récupération de mot de
 * passe et d'activation de compte.
 *
 * - En TEST (`MAIL_TRANSPORT=memoire`), les messages sont conservés en mémoire et lus par les
 *   tests d'intégration : aucun envoi réel.
 * - Les liens sont construits depuis WEB_URL (configuration), jamais depuis l'en-tête Host de la
 *   requête : protection contre l'empoisonnement des liens de réinitialisation.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly expediteur: string;
  readonly urlWeb: string;

  /** Boîte d'envoi du mode mémoire (tests). */
  static readonly boiteDEnvoi: MessageEmail[] = [];

  constructor(config: ConfigService<Environnement, true>) {
    this.expediteur = config.get('MAIL_FROM', { infer: true });
    this.urlWeb = config.get('WEB_URL', { infer: true }).replace(/\/$/, '');
    if (config.get('MAIL_TRANSPORT', { infer: true }) === 'memoire') {
      this.transport = null;
    } else {
      const utilisateur = config.get('SMTP_USER', { infer: true });
      this.transport = nodemailer.createTransport({
        host: config.get('SMTP_HOST', { infer: true }),
        port: config.get('SMTP_PORT', { infer: true }),
        secure: config.get('SMTP_SECURE', { infer: true }),
        auth: utilisateur
          ? { user: utilisateur, pass: config.get('SMTP_PASSWORD', { infer: true }) }
          : undefined,
        // Pas de lecture de fichiers locaux ni d'URL distantes dans les messages (OWASP A10).
        disableFileAccess: true,
        disableUrlAccess: true,
      });
    }
  }

  async envoyer(message: MessageEmail): Promise<void> {
    if (!this.transport) {
      MailService.boiteDEnvoi.push(message);
      return;
    }
    await this.transport.sendMail({
      from: this.expediteur,
      to: message.destinataire,
      subject: message.sujet,
      text: message.texte,
      html: message.html,
    });
  }

  /** Envoi sans bloquer la réponse HTTP (temps de réponse identique que le compte existe ou non). */
  envoyerEnArrierePlan(message: MessageEmail): void {
    this.envoyer(message).catch((erreur: unknown) =>
      this.logger.error(`Échec d'envoi de l'email « ${message.sujet} » : ${String(erreur)}`),
    );
  }

  messageReinitialisation(destinataire: string, prenom: string, jeton: string): MessageEmail {
    const lien = `${this.urlWeb}/reinitialisation?jeton=${encodeURIComponent(jeton)}`;
    return gabarit({
      destinataire,
      sujet: 'FORMACTIV — Réinitialisation de votre mot de passe',
      salutation: `Bonjour ${prenom},`,
      paragraphes: [
        'Une demande de réinitialisation du mot de passe de votre compte FORMACTIV a été effectuée.',
        'Ce lien est valable 30 minutes et ne peut être utilisé qu’une seule fois.',
      ],
      action: { libelle: 'Choisir un nouveau mot de passe', lien },
      pied: 'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.',
    });
  }

  messageActivation(destinataire: string, prenom: string, jeton: string): MessageEmail {
    const lien = `${this.urlWeb}/activation?jeton=${encodeURIComponent(jeton)}`;
    return gabarit({
      destinataire,
      sujet: 'FORMACTIV — Activez votre compte',
      salutation: `Bonjour ${prenom},`,
      paragraphes: [
        'Un compte vient d’être créé pour vous sur la plateforme de formation FORMACTIV.',
        'Pour l’activer, choisissez votre mot de passe et prenez connaissance de l’utilisation de vos données. Ce lien est valable 72 heures.',
      ],
      action: { libelle: 'Activer mon compte', lien },
      pied: 'Si vous n’attendiez pas ce message, contactez votre responsable formation.',
    });
  }
}

function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function gabarit(contenu: {
  destinataire: string;
  sujet: string;
  salutation: string;
  paragraphes: string[];
  action: { libelle: string; lien: string };
  pied: string;
}): MessageEmail {
  const texte = [
    contenu.salutation,
    '',
    ...contenu.paragraphes,
    '',
    `${contenu.action.libelle} : ${contenu.action.lien}`,
    '',
    contenu.pied,
  ].join('\n');
  const html = `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#1f2937">
<p>${echapperHtml(contenu.salutation)}</p>
${contenu.paragraphes.map((p) => `<p>${echapperHtml(p)}</p>`).join('\n')}
<p><a href="${echapperHtml(contenu.action.lien)}" style="background:#2b4c8c;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none">${echapperHtml(contenu.action.libelle)}</a></p>
<p style="color:#4b5563;font-size:13px">${echapperHtml(contenu.pied)}</p>
</body></html>`;
  return { destinataire: contenu.destinataire, sujet: contenu.sujet, texte, html };
}
