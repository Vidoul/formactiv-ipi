import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Sonde de disponibilité (chapitre 12, « Supervision ») utilisée par l'hébergeur et le
 * docker-compose de production. N'expose aucune information sensible.
 */
@ApiTags('Supervision')
@Controller('sante')
export class SanteController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: "État de l'API et de la base de données" })
  @ApiOkResponse({ schema: { example: { statut: 'ok', base: 'ok' } } })
  async verifier(@Res({ passthrough: true }) res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { statut: 'ok', base: 'ok', horodatage: new Date().toISOString() };
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { statut: 'degrade', base: 'indisponible', horodatage: new Date().toISOString() };
    }
  }
}
