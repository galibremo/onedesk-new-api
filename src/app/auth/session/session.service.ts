import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { UAParser } from 'ua-parser-js';

import { notFoundError, unauthorizedError } from '../../../core/errors/domain-error';
import { sessionRenewalThreshold, sessionTimeout } from '../../../common/helpers/constant.helper';
import type { SessionSchemaType } from '../../../core/database/types';
import { mapSessionResponse } from './session.mapper';
import { SessionRepository } from './session.repository';
import type { SessionListQueryDto } from './session.schema';
import type { SessionDataType, SessionListResponse } from './session.types';

const clientUserAgentHeaders = [
	'x-client-user-agent',
	'x-original-user-agent',
	'x-forwarded-user-agent',
	'user-agent',
] as const;

@Injectable()
export class SessionService {
	constructor(private readonly sessionRepository: SessionRepository) {}

	getSessionInfo(request: Request) {
		const rawUserAgent = this.getClientUserAgent(request);
		const parser = new UAParser(rawUserAgent ?? '');

		const device = parser.getDevice();
		const os = parser.getOS();
		const browser = parser.getBrowser();

		const browserName = this.getKnownValue(browser.name) ?? 'Unknown Client';
		const browserVersion = this.getKnownValue(browser.version);
		const osName = this.getKnownValue(os.name) ?? 'Unknown OS';
		const osVersion = this.getKnownValue(os.version);
		const hasParsedClient = !!this.getKnownValue(browser.name) || !!this.getKnownValue(os.name);
		const deviceType = this.getKnownValue(device.type) ?? (hasParsedClient ? 'desktop' : 'Unknown');

		const deviceName = `${this.joinKnownValues(osName, osVersion, ' ')} - ${browserName}`;

		const ipAddress = this.getClientIpAddress(request) ?? request.socket.remoteAddress ?? 'Unknown';

		return {
			userAgent: this.joinKnownValues(browserName, browserVersion, ' - '),
			deviceType,
			deviceName,
			ipAddress,
		};
	}

	private getClientUserAgent(request: Request): string | undefined {
		for (const header of clientUserAgentHeaders) {
			const value = this.getKnownValue(request.get(header));
			if (value) return value;
		}

		return undefined;
	}

	private getClientIpAddress(request: Request): string | undefined {
		const forwardedFor = this.getKnownValue(request.get('x-forwarded-for'));
		const forwardedIp = forwardedFor?.split(',')[0]?.trim();

		return this.getKnownValue(forwardedIp) ?? this.getKnownValue(request.get('x-real-ip'));
	}

	private getKnownValue(value: string | undefined): string | undefined {
		const trimmed = value?.trim();
		if (!trimmed) return undefined;

		const normalized = trimmed.toLowerCase();
		if (normalized === 'undefined' || normalized === 'null' || normalized === 'unknown') {
			return undefined;
		}

		return trimmed;
	}

	private joinKnownValues(
		requiredValue: string,
		optionalValue: string | undefined,
		separator: string,
	): string {
		return optionalValue ? `${requiredValue}${separator}${optionalValue}` : requiredValue;
	}

	async createSession(data: SessionDataType): Promise<string> {
		const session = await this.sessionRepository.createSession(data);

		return session.token;
	}

	async validateSession(
		userId: number,
		sessionKeyOrId: string | number,
	): Promise<SessionSchemaType> {
		const session = await this.sessionRepository.findSession(userId, sessionKeyOrId);

		if (!session) throw unauthorizedError('Invalid session token');

		if (session.isRevoked) throw unauthorizedError('Session has been revoked');

		if (session.expiresAt < new Date()) throw unauthorizedError('Session has expired');

		return session;
	}

	shouldExtendSession(
		session: Pick<SessionSchemaType, 'expiresAt'>,
		now: Date = new Date(),
	): boolean {
		return session.expiresAt.getTime() - now.getTime() <= sessionRenewalThreshold;
	}

	async extendSession(
		sessionId: number,
		expiresAt: Date = new Date(Date.now() + sessionTimeout),
	): Promise<SessionSchemaType> {
		const session = await this.sessionRepository.extendSession(sessionId, expiresAt);

		if (!session) throw unauthorizedError('Invalid session token');

		return session;
	}

	async markTwoFactorVerified(sessionId: number): Promise<SessionSchemaType> {
		const session = await this.sessionRepository.markTwoFactorVerified(sessionId);

		if (!session) throw unauthorizedError('Invalid session token');

		return session;
	}

	async updateTwoFactorFailureState(
		sessionId: number,
		data: Pick<Partial<SessionSchemaType>, 'twoFactorFailedAttempts' | 'twoFactorLockedUntil'>,
	): Promise<SessionSchemaType> {
		const session = await this.sessionRepository.updateTwoFactorFailureState(sessionId, data);

		if (!session) throw unauthorizedError('Invalid session token');

		return session;
	}

	async revokeSession(userId: number, sessionKeyOrId: string | number): Promise<boolean> {
		await this.validateSession(userId, sessionKeyOrId);
		await this.sessionRepository.revokeSession(userId, sessionKeyOrId);

		return true;
	}

	async revokeUserSession(userId: number, sessionPublicId: string): Promise<SessionSchemaType> {
		const session = await this.sessionRepository.revokeSessionByPublicIdForUser(
			userId,
			sessionPublicId,
		);

		if (!session) throw notFoundError('session_not_found', 'Session not found');

		return session;
	}

	revokeOtherUserSessions(userId: number, currentSessionToken: string): Promise<number> {
		return this.sessionRepository.revokeOtherActiveUserSessions(userId, currentSessionToken);
	}

	revokeAllUserSessions(userId: number): Promise<number> {
		return this.sessionRepository.revokeAllUserSessions(userId);
	}

	listOfUserSessions(userId: number): Promise<SessionSchemaType[]> {
		return this.sessionRepository.listUserSessions(userId);
	}

	async listUserSessions(
		userId: number,
		query: SessionListQueryDto,
		currentSessionToken: string,
	): Promise<SessionListResponse> {
		const result = await this.sessionRepository.listUserSessionsPaginated(
			userId,
			query,
			currentSessionToken,
		);

		return {
			rows: result.rows.map(session => mapSessionResponse(session, currentSessionToken)),
			total: result.total,
			page: query.page ?? 1,
			pageSize: query.pageSize ?? 10,
			activeOtherSessionCount: result.activeOtherSessionCount,
		};
	}
}
