import { Module, type OnModuleInit } from '@nestjs/common';
import { AnonymisationService } from '../utilisateurs/anonymisation.service';
import { UtilisateursModule } from '../utilisateurs/utilisateurs.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { ParcoursService } from './parcours.service';
import { fournisseurStockage } from './stockage/stockage.provider';

/** Module E5 — attestations, certificats et historique du parcours (US-19, US-20, US-21). */
@Module({
  imports: [UtilisateursModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, ParcoursService, fournisseurStockage],
  exports: [DocumentsService, fournisseurStockage],
})
export class DocumentsModule implements OnModuleInit {
  constructor(
    private readonly anonymisation: AnonymisationService,
    private readonly documents: DocumentsService,
  ) {}

  /** RG-CPT-02 : les PDF nominatifs sont anonymisés avec le compte de l'apprenant. */
  onModuleInit(): void {
    this.anonymisation.enregistrerNettoyeur((id, tx) => this.documents.anonymiserDocuments(id, tx));
  }
}
