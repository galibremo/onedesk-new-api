import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger,
} from '@nestjs/common';
import { STATUS_CODES } from 'http';
import { Request, Response } from 'express';

type ExceptionResponse = Record<string, unknown>;

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger(GlobalExceptionFilter.name);
	private readonly sensitiveFields = new Set([
		'authorization',
		'cookie',
		'password',
		'currentpassword',
		'newpassword',
		'confirmpassword',
		'token',
		'accesstoken',
		'access_token',
		'refreshtoken',
		'refresh_token',
		'csrftoken',
		'csrf_token',
		'twofactorsecret',
		'two_factor_secret',
		'twofactorsecretencrypted',
	]);

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();
		const status = this.getStatus(exception);
		const exceptionResponse = this.getExceptionResponse(exception);
		const normalizedResponse =
			typeof exceptionResponse === 'object' && exceptionResponse !== null ? exceptionResponse : {};
		const requestId = this.getRequestId(request);
		const error = this.getErrorTitle(status, normalizedResponse);
		const message = this.getMessage(exception, normalizedResponse);
		const meta = this.getMeta(normalizedResponse);

		const responsePayload = {
			statusCode: status,
			code: this.getCode(status, normalizedResponse),
			error,
			message,
			meta,
			timestamp: new Date().toISOString(),
			path: request.url,
			requestId,
		};

		this.logException(exception, request, responsePayload);

		response.status(status).json(responsePayload);
	}

	private getRequestId(request: Request): string {
		if (request.requestId) {
			return request.requestId;
		}

		const header = request.headers?.['x-request-id'];
		if (Array.isArray(header)) {
			return header[0] ?? '';
		}

		return header || '';
	}

	private getStatus(exception: unknown): number {
		if (exception instanceof HttpException) {
			return exception.getStatus();
		}

		return HttpStatus.INTERNAL_SERVER_ERROR;
	}

	private getExceptionResponse(exception: unknown): ExceptionResponse {
		if (exception instanceof HttpException) {
			const response = exception.getResponse();

			if (this.isRecord(response)) {
				return response;
			}

			return {
				message: response,
			};
		}

		return {};
	}

	private getErrorTitle(status: number, response: object): string {
		if ('error' in response && typeof response.error === 'string') {
			return response.error;
		}

		return STATUS_CODES[status] ?? 'Error';
	}

	private getMessage(exception: unknown, response: object): string {
		if ('message' in response) {
			if (Array.isArray(response.message)) {
				return response.message.join(', ');
			}

			if (typeof response.message === 'string') {
				return response.message;
			}
		}

		if (exception instanceof HttpException && exception.message) {
			return exception.message;
		}

		return 'Internal server error';
	}

	private getMeta(response: object): Record<string, unknown> {
		if ('meta' in response && this.isRecord(response.meta)) {
			return response.meta;
		}

		const meta: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(response)) {
			if (!['statusCode', 'code', 'error', 'message', 'meta'].includes(key)) {
				meta[key] = value;
			}
		}

		return meta;
	}

	private getCode(status: number, response: object): string {
		if ('code' in response && typeof response.code === 'string') {
			return response.code;
		}

		const statusCodeMap: Record<number, string> = {
			[HttpStatus.BAD_REQUEST]: 'bad_request',
			[HttpStatus.UNAUTHORIZED]: 'unauthorized',
			[HttpStatus.FORBIDDEN]: 'forbidden',
			[HttpStatus.NOT_FOUND]: 'not_found',
			[HttpStatus.CONFLICT]: 'conflict',
			[HttpStatus.UNPROCESSABLE_ENTITY]: 'validation_failed',
			[HttpStatus.INTERNAL_SERVER_ERROR]: 'internal_error',
		};

		return statusCodeMap[status] ?? 'http_error';
	}

	private logException(
		exception: unknown,
		request: Request,
		responsePayload: {
			statusCode: number;
			code: string;
			error: string;
			message: string;
			meta: Record<string, unknown>;
			timestamp: string;
			path: string;
			requestId: string;
		},
	): void {
		const logPayload = {
			requestId: responsePayload.requestId || 'not-provided',
			statusCode: responsePayload.statusCode,
			code: responsePayload.code,
			error: responsePayload.error,
			clientMessage: responsePayload.message,
			exceptionName: exception instanceof Error ? exception.name : typeof exception,
			exceptionMessage: this.getExceptionMessage(exception),
			method: request.method,
			path: request.originalUrl || request.url,
			params: this.redactSensitiveData(request.params),
			query: this.redactSensitiveData(request.query),
			body: this.redactSensitiveData(request.body),
			meta: this.redactSensitiveData(responsePayload.meta),
		};
		const stack = exception instanceof Error ? exception.stack : undefined;
		const details = `HTTP exception details: ${JSON.stringify(logPayload, null, 2)}`;

		if (responsePayload.statusCode >= 500) {
			this.logger.error(details, stack);
			return;
		}

		this.logger.warn(details);
	}

	private redactSensitiveData(value: unknown): unknown {
		if (Array.isArray(value)) {
			return value.map(item => this.redactSensitiveData(item));
		}

		if (!this.isRecord(value)) {
			return value;
		}

		return Object.fromEntries(
			Object.entries(value).map(([key, entryValue]) => [
				key,
				this.isSensitiveField(key) ? '[redacted]' : this.redactSensitiveData(entryValue),
			]),
		);
	}

	private getExceptionMessage(exception: unknown): string {
		if (exception instanceof Error && exception.message) {
			return exception.message;
		}

		if (typeof exception === 'string') {
			return exception;
		}

		return 'No exception message available';
	}

	private isSensitiveField(key: string): boolean {
		return this.sensitiveFields.has(key.toLowerCase());
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}
}
