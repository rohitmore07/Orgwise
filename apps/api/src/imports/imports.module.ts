import { Module } from '@nestjs/common';
import { CsvService } from './csv.service';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

/** CSV bulk import — upload, validation, history and error reports. */
@Module({
  controllers: [ImportsController],
  providers: [ImportsService, CsvService],
  // Exported so the AI Copilot can surface import history / data quality.
  exports: [ImportsService],
})
export class ImportsModule {}
