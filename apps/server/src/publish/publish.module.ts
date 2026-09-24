import { Module } from '@nestjs/common';
import { PublishService } from './publish.service';
import { PublishController } from './publish.controller';
import { ContentSafetyService } from '../common/services/content-safety.service';

@Module({
  controllers: [PublishController],
  providers: [PublishService, ContentSafetyService],
  exports: [PublishService],
})
export class PublishModule {}
