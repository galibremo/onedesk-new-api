import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import type { EnvType } from '../../core/validators/env';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SOCIAL_PROVIDER_FACEBOOK } from './constants/facebook.constants';
import { SOCIAL_PROVIDER_INSTAGRAM } from './constants/instagram.constants';
import { SOCIAL_PROVIDER_WHATSAPP } from './constants/whatsapp.constants';
import { FacebookGraphProvider } from './providers/facebook-graph.provider';
import { InstagramGraphProvider } from './providers/instagram-graph.provider';
import { WhatsAppGraphProvider } from './providers/whatsapp-graph.provider';
import { ChannelsController } from './channels.controller';
import { ChannelsRepository } from './channels.repository';
import { ChannelsService } from './channels.service';

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
	controllers: [ChannelsController],
	providers: [
		ChannelsService,
		ChannelsRepository,
		{ provide: SOCIAL_PROVIDER_FACEBOOK, useClass: FacebookGraphProvider },
		{ provide: SOCIAL_PROVIDER_INSTAGRAM, useClass: InstagramGraphProvider },
		{ provide: SOCIAL_PROVIDER_WHATSAPP, useClass: WhatsAppGraphProvider },
	],
	exports: [ChannelsService, ChannelsRepository],
})
export class ChannelsModule {}
