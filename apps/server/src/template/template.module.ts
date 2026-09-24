import { Module } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';
import { ContentSafetyService } from '../common/services/content-safety.service';

@Module({
  controllers: [TemplateController],
  providers: [TemplateService, ContentSafetyService],
  exports: [TemplateService, ContentSafetyService],
})
export class TemplateModule {}
