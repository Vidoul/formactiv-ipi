import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CodeRole } from '@prisma/client';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { Roles } from '../../common/decorators/roles.decorator';
import { UtilisateurConnecte } from '../../common/decorators/utilisateur-connecte.decorator';
import {
  CreationEntrepriseDto,
  EntrepriseDto,
  ListeEntreprisesQueryDto,
  ModificationEntrepriseDto,
} from './dto/entreprises.dto';
import { EntreprisesService } from './entreprises.service';

@ApiTags('Entreprises clientes')
@ApiBearerAuth('jwt')
@Controller('entreprises')
export class EntreprisesController {
  constructor(private readonly entreprises: EntreprisesService) {}

  @Get()
  @Roles(CodeRole.ADMIN, CodeRole.RESP_FORMATION, CodeRole.CLIENT_ENTREPRISE)
  @ApiOperation({ summary: 'Liste des entreprises clientes (REQ-FUNC-018)' })
  lister(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Query() q: ListeEntreprisesQueryDto,
  ) {
    return this.entreprises.lister(acteur, q);
  }

  @Get(':id')
  @Roles(CodeRole.ADMIN, CodeRole.RESP_FORMATION, CodeRole.CLIENT_ENTREPRISE)
  @ApiOkResponse({ type: EntrepriseDto })
  detail(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.entreprises.detail(acteur, id);
  }

  @Post()
  @Roles(CodeRole.ADMIN, CodeRole.RESP_FORMATION)
  @ApiOperation({ summary: 'Création d’une entreprise cliente' })
  @ApiOkResponse({ type: EntrepriseDto })
  creer(@Body() dto: CreationEntrepriseDto) {
    return this.entreprises.creer(dto);
  }

  @Patch(':id')
  @Roles(CodeRole.ADMIN, CodeRole.RESP_FORMATION)
  @ApiOkResponse({ type: EntrepriseDto })
  modifier(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ModificationEntrepriseDto) {
    return this.entreprises.modifier(id, dto);
  }

  @Delete(':id')
  @Roles(CodeRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suppression (uniquement sans compte rattaché)' })
  supprimer(@Param('id', ParseUUIDPipe) id: string) {
    return this.entreprises.supprimer(id);
  }
}
