import { Global, Module } from '@nestjs/common';
import { ParametresService } from './parametres.service';

@Global()
@Module({
  providers: [ParametresService],
  exports: [ParametresService],
})
export class ParametresModule {}
