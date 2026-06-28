import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { sessionTimeout } from '../../common/helpers/constant.helper';
import { EnvType } from '../../core/validators/env';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SmtpModule } from '../smtp/smtp.module';
import { SystemModule } from '../system/system.module';
import { AuthController } from './auth.controller';
import { AuthPolicy } from './auth.policy';
import { AUTH_CLOUDINARY_SERVICE, authCloudinaryProvider } from './auth.providers';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { ApprovalEmail } from './emails/approval.email';
import { InvitationEmail } from './emails/invitation.email';
import { MagicLinkEmail } from './emails/magic-link.email';
import { TwoFactorAlertEmail } from './emails/two-factor-alert.email';
import { WelcomeEmail } from './emails/welcome.email';
import { SessionRepository } from './session/session.repository';
import { SessionService } from './session/session.service';
import { JwtPartialStrategy } from './strategies/jwt-partial.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TwoFactorRepository } from './two-factor/two-factor.repository';
import { TwoFactorService } from './two-factor/two-factor.service';

@Module({
	imports: [
		PassportModule,
		AuditLogModule,
		SmtpModule,
		SystemModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService<EnvType>) => ({
				secret: configService.get('AUTH_SECRET', { infer: true }),
				signOptions: { expiresIn: sessionTimeout / 1000 }, // Convert ms to seconds
			}),
		}),
	],
	providers: [
		AuthService,
		AuthPolicy,
		AuthRepository,
		JwtStrategy,
		JwtPartialStrategy,
		SessionService,
		SessionRepository,
		TwoFactorService,
		TwoFactorRepository,
		ApprovalEmail,
		InvitationEmail,
		MagicLinkEmail,
		TwoFactorAlertEmail,
		WelcomeEmail,
		authCloudinaryProvider,
	],
	controllers: [AuthController],
	exports: [
		AuthService,
		TwoFactorService,
		ApprovalEmail,
		InvitationEmail,
		TwoFactorAlertEmail,
		AUTH_CLOUDINARY_SERVICE,
	],
})
export class AuthModule {}
