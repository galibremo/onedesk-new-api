import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import type { EnvType } from '../../core/validators/env';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SOCIAL_PROVIDER_FACEBOOK } from './facebook/constants/facebook.constants';
import { SOCIAL_PROVIDER_INSTAGRAM } from './instagram/constants/instagram.constants';
import { SOCIAL_PROVIDER_WHATSAPP } from './whatsapp/constants/whatsapp.constants';
import { FacebookGraphProvider } from './facebook/providers/facebook-graph.provider';
import { InstagramGraphProvider } from './instagram/providers/instagram-graph.provider';
import { WhatsAppGraphProvider } from './whatsapp/providers/whatsapp-graph.provider';
import { ChannelsController } from './channels.controller';
import { FacebookController } from './facebook/facebook.controller';
import { InstagramController } from './instagram/instagram.controller';
import { WhatsAppController } from './whatsapp/whatsapp.controller';
import { ChannelsRepository } from './channels.repository';
import { ChannelsService } from './channels.service';
import { FacebookRepository } from './facebook/facebook.repository';
import { InstagramRepository } from './instagram/instagram.repository';
import { WhatsAppRepository } from './whatsapp/whatsapp.repository';
import { FacebookService } from './facebook/facebook.service';
import { InstagramService } from './instagram/instagram.service';
import { WhatsAppService } from './whatsapp/whatsapp.service';

@Module({
	imports: [
		AuditLogModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService<EnvType, true>) => ({
				secret: configService.get('AUTH_SECRET', { infer: true }),
			}),
		}),
	],
	controllers: [ChannelsController, FacebookController, InstagramController, WhatsAppController],
	providers: [
		ChannelsService,
		ChannelsRepository,
		{ provide: SOCIAL_PROVIDER_FACEBOOK, useClass: FacebookGraphProvider },
		{ provide: SOCIAL_PROVIDER_INSTAGRAM, useClass: InstagramGraphProvider },
		{ provide: SOCIAL_PROVIDER_WHATSAPP, useClass: WhatsAppGraphProvider },
		FacebookService,
		FacebookRepository,
		InstagramService,
		InstagramRepository,
		WhatsAppService,
		WhatsAppRepository,
	],
	exports: [ChannelsService, ChannelsRepository],
})
export class ChannelsModule {}
