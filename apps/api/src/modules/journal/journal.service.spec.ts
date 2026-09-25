import { contexteRequete } from '../../common/context/contexte-requete';
import type { PrismaService } from '../../prisma/prisma.service';
import { ActionJournal } from './actions-journal';
import { JournalService, assainirDetails } from './journal.service';

describe('assainirDetails (RG-LOG-01 : jamais de donnée sensible)', () => {
  it('masque les hash, jetons JWT et mots de passe', () => {
    const texte =
      'hash=$argon2id$v=19$m=19456 jwt eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl mot de passe: Secret123!';
    const resultat = assainirDetails(texte)!;
    expect(resultat).not.toContain('argon2id');
    expect(resultat).not.toContain('eyJhbGciOi');
    expect(resultat).not.toContain('Secret123!');
  });

  it('tronque les détails à 500 caractères', () => {
    expect(assainirDetails('a'.repeat(600))).toHaveLength(500);
  });
});

describe('JournalService', () => {
  it("renseigne l'auteur et l'adresse IP depuis le contexte de requête", async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new JournalService({ journalAction: { create } } as unknown as PrismaService);

    await contexteRequete.executer(
      { idRequete: 'r1', ip: '192.0.2.10', utilisateurId: 'u-1', role: 'ADMIN' },
      () => service.enregistrer({ action: ActionJournal.EXPORT_CSV, typeObjet: 'inscriptions' }),
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'EXPORT_CSV',
        typeObjet: 'inscriptions',
        utilisateurId: 'u-1',
        adresseIp: '192.0.2.10',
      }),
    });
  });

  it("permet d'imputer explicitement une action au système (utilisateurId null)", async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new JournalService({ journalAction: { create } } as unknown as PrismaService);
    await service.enregistrer({ action: ActionJournal.PURGE_CONSERVATION, utilisateurId: null });
    expect(create.mock.calls[0][0].data.utilisateurId).toBeNull();
  });
});
