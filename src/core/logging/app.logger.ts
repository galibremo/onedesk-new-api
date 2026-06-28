import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { networkInterfaces } from 'os';
import pino from 'pino';
import pinoHttp, { type HttpLogger } from 'pino-http';

function getNetworkAddress(): string {
	const interfaces = networkInterfaces();

	for (const name of Object.keys(interfaces)) {
		for (const iface of interfaces[name] || []) {
			// Skip internal (loopback) and non-IPv4 addresses
			if (!iface.internal && iface.family === 'IPv4') {
				return iface.address;
			}
		}
	}

	return 'localhost';
}

export function displayStartupInfo(port: number | string): void {
	const logger = new Logger('NestApplication');
	const networkAddress = getNetworkAddress();
	const environment = process.env.NODE_ENV || 'development';

	console.log('\n');
	logger.log('\x1b[32m✓\x1b[0m Server started successfully');
	console.log('\n\x1b[1m\x1b[36m  App running at:\x1b[0m');
	console.log(
		`  \x1b[2m-\x1b[0m \x1b[1mLocal:\x1b[0m      \x1b[36mhttp://localhost:${port}\x1b[0m`,
	);
	console.log(
		`  \x1b[2m-\x1b[0m \x1b[1mNetwork:\x1b[0m    \x1b[36mhttp://${networkAddress}:${port}\x1b[0m`,
	);
	console.log(`  \x1b[2m-\x1b[0m \x1b[1mEnvironment:\x1b[0m \x1b[33m${environment}\x1b[0m`);
	console.log('\n');
}

const REQUEST_ID_REGEX = /^[a-zA-Z0-9-]+$/;
const MAX_REQUEST_ID_LENGTH = 64;

function getRequestId(req: Request): string {
	const header = req.headers['x-request-id'];
	if (
		typeof header === 'string' &&
		header.length <= MAX_REQUEST_ID_LENGTH &&
		REQUEST_ID_REGEX.test(header.trim())
	) {
		return header.trim();
	}
	if (Array.isArray(header) && header[0]) {
		const first = header[0];
		if (first.length <= MAX_REQUEST_ID_LENGTH && REQUEST_ID_REGEX.test(first.trim())) {
			return first.trim();
		}
	}

	return req.requestId || randomUUID();
}

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
	level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
	transport: isProduction
		? undefined
		: {
				target: 'pino-pretty',
				options: {
					colorize: true,
					ignore: 'pid,hostname',
					singleLine: true,
					translateTime: 'SYS:standard',
					messageFormat: '{method} {url} {statusCode} in {responseTime}ms',
				},
			},
	redact: {
		paths: ['req.headers.authorization', 'req.headers.cookie'],
		censor: '[redacted]',
	},
});

export const appLogger: HttpLogger<Request, Response> = pinoHttp<Request, Response>({
	logger,
	quietReqLogger: true,
	serializers: {
		req: () => undefined,
		res: () => undefined,
	},
	genReqId(req) {
		const requestId = req.requestId || getRequestId(req);
		req.requestId = requestId;
		return requestId;
	},
	customLogLevel(_req, res, error) {
		if (error || res.statusCode >= 500) return 'error';
		if (res.statusCode >= 400) return 'warn';
		return 'info';
	},
	customSuccessObject(req, res, value) {
		const logValue = getLogValue(value);

		return {
			...logValue,
			requestId: req.requestId ?? req.id,
			userId: req.user?.id ?? null,
			method: req.method,
			url: req.originalUrl || req.url,
			statusCode: res.statusCode,
		};
	},
	customErrorObject(req, res, error, value) {
		const logValue = getLogValue(value);

		return {
			...logValue,
			requestId: req.requestId ?? req.id,
			userId: req.user?.id ?? null,
			method: req.method,
			url: req.originalUrl || req.url,
			statusCode: res.statusCode,
			errorName: error.name,
		};
	},
});

function getLogValue(value: unknown): Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}
