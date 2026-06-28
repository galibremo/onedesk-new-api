import { HttpException, HttpStatus } from '@nestjs/common';

export type DomainErrorMeta = Record<string, unknown>;

export class DomainError extends HttpException {
	constructor(
		public readonly code: string,
		message: string,
		status: HttpStatus = HttpStatus.BAD_REQUEST,
		public readonly meta: DomainErrorMeta = {},
	) {
		super(
			{
				code,
				message,
				meta,
			},
			status,
		);
	}
}

export const validationFailed = (message: string, meta?: DomainErrorMeta): DomainError =>
	new DomainError('validation_failed', message, HttpStatus.UNPROCESSABLE_ENTITY, meta);

export const badRequestError = (message: string, meta?: DomainErrorMeta): DomainError =>
	new DomainError('bad_request', message, HttpStatus.BAD_REQUEST, meta);

export const unauthorizedError = (message: string, meta?: DomainErrorMeta): DomainError =>
	new DomainError('unauthorized', message, HttpStatus.UNAUTHORIZED, meta);

export const twoFactorRequiredError = (message: string, meta?: DomainErrorMeta): DomainError =>
	new DomainError('two_factor_required', message, HttpStatus.UNAUTHORIZED, meta);

export const badGatewayError = (
	code: string,
	message: string,
	meta?: DomainErrorMeta,
): DomainError => new DomainError(code, message, HttpStatus.BAD_GATEWAY, meta);

export const unprocessableError = (
	code: string,
	message: string,
	meta?: DomainErrorMeta,
): DomainError => new DomainError(code, message, HttpStatus.UNPROCESSABLE_ENTITY, meta);

export const conflictError = (code: string, message: string, meta?: DomainErrorMeta): DomainError =>
	new DomainError(code, message, HttpStatus.CONFLICT, meta);

export const forbiddenError = (
	code: string,
	message: string,
	meta?: DomainErrorMeta,
): DomainError => new DomainError(code, message, HttpStatus.FORBIDDEN, meta);

export const notFoundError = (code: string, message: string, meta?: DomainErrorMeta): DomainError =>
	new DomainError(code, message, HttpStatus.NOT_FOUND, meta);

export const isDatabaseUniqueViolation = (error: unknown): boolean =>
	typeof error === 'object' &&
	error !== null &&
	'code' in error &&
	(error as { code?: unknown }).code === '23505';
