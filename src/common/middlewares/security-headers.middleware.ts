import type { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import type { EnvType } from '../../core/validators/env';

/**
 * Creates a Helmet middleware instance with environment-aware security headers.
 *
 * Production defaults:
 * - Strict Content Security Policy (self-only, with Cloudinary for images)
 * - HSTS with preload (1 year)
 * - All other Helmet protections enabled
 *
 * Development defaults:
 * - CSP disabled (allows HMR, dev tools, browser extensions)
 * - HSTS disabled
 * - Other protections enabled
 *
 * A custom CSP can be provided via the CSP_POLICY environment variable.
 */
export function createSecurityHeadersMiddleware(
	configService: ConfigService<EnvType, true>,
): ReturnType<typeof helmet> {
	const isProduction = configService.get('NODE_ENV', { infer: true }) === 'production';
	const apiUrl = configService.get('API_URL', { infer: true });
	const customCsp = configService.get('CSP_POLICY', { infer: true });

	// Build CSP directives
	const cspDirectives = buildCspDirectives(isProduction, apiUrl, customCsp);

	return helmet({
		contentSecurityPolicy: cspDirectives ? { directives: cspDirectives } : false,
		crossOriginEmbedderPolicy: true,
		crossOriginOpenerPolicy: true,
		crossOriginResourcePolicy: { policy: 'same-origin' },
		dnsPrefetchControl: true,
		frameguard: { action: 'deny' },
		hsts: isProduction ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
		ieNoOpen: true,
		noSniff: true,
		originAgentCluster: true,
		permittedCrossDomainPolicies: { permittedPolicies: 'none' },
		referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
		xXssProtection: true,
	});
}

function buildCspDirectives(
	isProduction: boolean,
	apiUrl: string,
	customCsp: string | undefined,
): Record<string, string[]> | false {
	// If a custom CSP is provided, use it
	if (customCsp) {
		return parseCspString(customCsp);
	}

	// In development, disable CSP to allow HMR, dev tools, and browser extensions
	if (!isProduction) {
		return false;
	}

	// Production CSP: strict defaults
	return {
		defaultSrc: ["'self'"],
		scriptSrc: ["'self'"],
		styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed by many UI frameworks
		imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
		connectSrc: ["'self'", apiUrl],
		fontSrc: ["'self'", 'data:'],
		objectSrc: ["'none'"],
		frameSrc: ["'none'"],
		baseUri: ["'self'"],
		formAction: ["'self'"],
		upgradeInsecureRequests: [],
	};
}

/**
 * Parses a CSP string like "default-src 'self'; script-src 'self' https://cdn.example.com"
 * into the directives format expected by Helmet.
 */
function parseCspString(csp: string): Record<string, string[]> {
	const directives: Record<string, string[]> = {};
	const parts = csp.split(';');

	for (const part of parts) {
		const trimmed = part.trim();
		if (!trimmed) continue;

		const [directive, ...values] = trimmed.split(/\s+/);
		if (directive) {
			const camelDirective = directive.replace(/-([a-z])/g, (_match: string, char: string) =>
				char.toUpperCase(),
			);
			directives[camelDirective] = values;
		}
	}

	return directives;
}
