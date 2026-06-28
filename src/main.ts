import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

import { CsrfGuard } from './app/csrf/csrf.guard';
import { CsrfService } from './app/csrf/csrf.service';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { appLogger, displayStartupInfo } from './core/logging/app.logger';
import { logAllRoutes } from './core/logging/route.logger';
import { requestIdMiddleware } from './common/middlewares/request-id.middleware';
import { createSecurityHeadersMiddleware } from './common/middlewares/security-headers.middleware';
import { EnvType } from './core/validators/env';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// Get ConfigService instance
	const configService = app.get(ConfigService<EnvType, true>);

	// Get configuration values
	const originUrls = configService.get<string>('ORIGIN_URL', { infer: true }).split(',');
	const port = configService.get<number>('PORT', 3000);

	// Apply security headers (Helmet) — must be before other middleware
	if (configService.get('HELMET_ENABLED', { infer: true }) === 'true') {
		app.use(createSecurityHeadersMiddleware(configService));
	}

	app.enableCors({
		origin: function (
			origin: string | undefined,
			callback: (err: Error | null, allow?: boolean) => void,
		) {
			if (!origin || originUrls.includes(origin)) {
				callback(null, true);
			} else {
				callback(new Error('Not allowed by CORS'));
			}
		},
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'ngrok-skip-browser-warning'],
		maxAge: 3600,
	});

	// Apply request ID middleware
	app.use(requestIdMiddleware);

	// Enable cookie parsing for CSRF tokens
	app.use(cookieParser());

	// Add request logging middleware
	app.use(appLogger);

	// Apply global exception filter for custom error responses
	app.useGlobalFilters(new GlobalExceptionFilter());

	// Apply global response interceptor for consistent response format
	app.useGlobalInterceptors(new ApiResponseInterceptor());

	// Apply CSRF guard globally
	const reflector = app.get(Reflector);
	const csrfService = app.get(CsrfService);
	app.useGlobalGuards(new CsrfGuard(csrfService, reflector));

	// Initialize and start the server
	await app.init();
	await app.listen(port);

	// Display startup information
	displayStartupInfo(port);

	// Log all routes (only in development mode)
	await logAllRoutes(app, {
		saveToFile: true,
		logToConsole: false,
	});
}
bootstrap().catch(err => {
	const logger = new Logger('Bootstrap');
	logger.error('Failed to start application', err);
	process.exit(1);
});
