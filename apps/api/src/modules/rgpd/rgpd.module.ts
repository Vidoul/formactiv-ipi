import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { UtilisateursModule } from '../utilisateurs/utilisateurs.module';
import { ConservationService } from './conservation.service';
import { RgpdController } from './rgpd.controller';
import { RgpdService } from './rgpd.service';

/** Module E7 — droits des personnes, consentements et conservation (UC-13, UC-14, RG-RGPD). */
@Module({
  imports: [UtilisateursModule, DocumentsModule],
  controllers: [RgpdController],
  providers: [RgpdService, ConservationService],
})
export class RgpdModule {}
