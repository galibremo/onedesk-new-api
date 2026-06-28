import { forwardRef, Module } from '@nestjs/common';

import { CryptoModule } from '../../core/crypto/crypto.module';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { EmailTemplateModule } from '../email-template/email-template.module';
import { EmailLogsModule } from '../email-logs/email-logs.module';
import { EmailDispatcherService } from './services/email-dispatcher.service';
import { SmtpProvidersController } from './smtp-providers.controller';
import { SmtpProvidersRepository } from './smtp-providers.repository';
import { SmtpProvidersService } from './services/smtp-providers.service';

@Module({
	imports: [DatabaseModule, CryptoModule, EmailTemplateModule, AuditLogModule, forwardRef(() => EmailLogsModule)],
	controllers: [SmtpProvidersController],
	providers: [
		SmtpProvidersRepository,
		SmtpProvidersService,
		EmailDispatcherService,
	],
	exports: [EmailDispatcherService, SmtpProvidersRepository],
})
export class SmtpModule {}
