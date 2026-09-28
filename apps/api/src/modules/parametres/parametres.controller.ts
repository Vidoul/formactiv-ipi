import { Body, Controller, Get, HttpStatus, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { CodeRole } from '@prisma/client';
import { IsString, MaxLength } from 'class-validator';
import { RegleMetierException } from '../../common/exceptions/regle-metier.exception';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';
import { CATALOGUE_PARAMETRES, type CleParametre } from './catalogue-parametres';
import { ParametresService } from './parametres.service';

class ModificationParametreDto {
  @ApiProperty({ example: '12' })
  @IsString()
  @MaxLength(500)
  valeur!: string;
}

/** Valide une valeur selon la définition du catalogue ; retourne la valeur normalisée. */
export function validerValeurParametre(cle: CleParametre, valeur: string): string {
  const definition = CATALOGUE_PARAMETRES[cle];
  const refus = (message: string) =>
    new RegleMetierException('PARAMETRE_INVALIDE', message, HttpStatus.BAD_REQUEST, [
      { champ: 'valeur', messages: [message] },
    ]);
  switch (definition.type) {
    case 'entier': {
      const n = Number(valeur);
      if (!Number.isInteger(n) || n < definition.min || n > definition.max) {
        throw refus(`Valeur entière attendue entre ${definition.min} et ${definition.max}.`);
      }
      return String(n);
    }
    case 'roles': {
      const roles = valeur
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      const valides = new Set<string>(Object.values(CodeRole));
      if (roles.some((r) => !valides.has(r))) throw refus('Liste de rôles invalide.');
      return [...new Set(roles)].join(',');
    }
    case 'texte':
      if (!definition.motif.test(valeur)) throw refus('Format de valeur invalide.');
      return valeur;
  }
}

/** Paramètres de la plateforme (matrice RBAC : Administrateur uniquement). */
@ApiTags('Paramètres plateforme')
@ApiBearerAuth('jwt')
@Roles(CodeRole.ADMIN)
@Controller('parametres')
export class ParametresController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametres: ParametresService,
    private readonly journal: JournalService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liste des paramètres et de leurs contraintes' })
  async lister() {
    const enBase = new Map((await this.prisma.parametre.findMany()).map((p) => [p.cle, p]));
    return Object.entries(CATALOGUE_PARAMETRES).map(([cle, d]) => ({
      cle,
      valeur:
        enBase.get(cle)?.valeur ?? (d.type === 'roles' ? d.defaut.join(',') : String(d.defaut)),
      description: d.description,
      type: d.type,
      ...(d.type === 'entier' ? { min: d.min, max: d.max } : {}),
      dateModification: enBase.get(cle)?.dateModification ?? null,
    }));
  }

  @Patch(':cle')
  @ApiOperation({ summary: 'Modification d’un paramètre (valeur contrôlée, action journalisée)' })
  async modifier(@Param('cle') cle: string, @Body() dto: ModificationParametreDto) {
    if (!(cle in CATALOGUE_PARAMETRES)) {
      throw new RegleMetierException(
        'PARAMETRE_INCONNU',
        'Paramètre inconnu.',
        HttpStatus.NOT_FOUND,
      );
    }
    const definition = CATALOGUE_PARAMETRES[cle as CleParametre];
    const valeur = validerValeurParametre(cle as CleParametre, dto.valeur.trim());
    const avant = await this.prisma.parametre.findUnique({ where: { cle } });
    await this.prisma.$transaction(async (tx) => {
      await tx.parametre.upsert({
        where: { cle },
        update: { valeur },
        create: { cle, valeur, description: definition.description },
      });
      await this.journal.enregistrer(
        {
          action: ActionJournal.MODIFICATION_PARAMETRE,
          typeObjet: 'parametre',
          idObjet: cle,
          details: `${avant?.valeur ?? '(défaut)'} → ${valeur}`,
        },
        tx,
      );
    });
    this.parametres.invaliderCache();
    return { cle, valeur };
  }
}
