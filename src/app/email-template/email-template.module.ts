import { Module } from '@nestjs/common';
import { EmailTemplatesController } from './email-template.controller';
import { EmailTemplateRepository } from './email-template.repository';
import { EmailTemplateService } from './email-template.service';

@Module({
	controllers: [EmailTemplatesController],
	providers: [EmailTemplateService, EmailTemplateRepository],
	exports: [EmailTemplateService],
})
export class EmailTemplateModule {}
