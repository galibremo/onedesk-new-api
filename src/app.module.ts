import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditLogModule } from './app/audit-log/audit-log.module';
import { AuthModule } from './app/auth/auth.module';
import { CsrfModule } from './app/csrf/csrf.module';
import { HealthModule } from './app/health/health.module';
import { MediaModule } from './app/media/media.module';
import { UsersModule } from './app/users/users.module';
import { SystemModule } from './app/system/system.module';
import { SmtpModule } from './app/smtp/smtp.module';
import { StatusModule } from './app/status/status.module';
import { ChannelsModule } from './app/channels/channels.module';
import { ConfigurableThrottlerGuard } from './common/guards/configurable-throttler.guard';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { validateEnv } from './core/validators/env';
import { CryptoModule } from './core/crypto/crypto.module';
import { DatabaseModule } from './core/database/database.module';
import { SecurityStoreModule } from './core/security-store/security-store.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			validate: validateEnv,
		}),
		// ThrottlerModule is kept for @Throttle() and @SkipThrottle() decorator metadata.
		// The actual rate limiting logic is handled by ConfigurableThrottlerGuard using
		// the configurable security store (memory/postgres/redis).
		ThrottlerModule.forRoot([
			{
				name: 'short',
				ttl: 1000,
				limit: 10,
			},
			{
				name: 'long',
				ttl: 60000,
				limit: 100,
			},
		]),
		DiscoveryModule,
		CryptoModule,
		CsrfModule,
		DatabaseModule,
		SecurityStoreModule.forRoot(),
		AuditLogModule,
		AuthModule,
		MediaModule,
		UsersModule,
		SystemModule,
		SmtpModule,
		HealthModule,
		StatusModule,
		ChannelsModule,
	],
	providers: [
		{
			provide: APP_GUARD,
			useClass: ConfigurableThrottlerGuard,
		},
		{
			provide: APP_PIPE,
			useClass: ZodValidationPipe,
		},
	],
})
export class AppModule {}
