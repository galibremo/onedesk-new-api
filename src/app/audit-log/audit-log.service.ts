import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';

import type { RoleTypeEnum } from '../../core/database/types';
import type { UserWithoutPassword } from '../auth/auth.types';
import { type AuditLogFilterOptionsResponse, type AuditLogListResponse, mapAuditLogResponse } from './audit-log.mapper';
import { AuditLogRepository } from './audit-log.repository';
import type { AuditLogListQueryDto } from './audit-log.schema';

type AuditActor = Pick<UserWithoutPassword, 'id' | 'role' | 'name' | 'email'>;

export interface LogAuditActionParams {
	actor?: AuditActor | null;
	actorId?: number | null;
	actorRole?: RoleTypeEnum | null;
	action: string;
	targetType: string;
	targetId: string;
	metadata?: Record<string, unknown>;
	request?: Request;
	ipAddress?: string | null;
	userAgent?: string | null;
}

@Injectable()
export class AuditLogService {
	private readonly logger = new Logger(AuditLogService.name);
	private readonly sensitiveFields = new Set([
		'authorization',
		'cookie',
		'password',
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
		'recoverycodes',
		'recovery_codes',
	]);

	constructor(private readonly auditLogRepository: AuditLogRepository) {}

	async logAction(params: LogAuditActionParams): Promise<void> {
		try {
			const context = this.getRequestContext(params.request);
			const actorId = params.actor ? params.actor.id : (params.actorId ?? null);
			const actorRole = params.actor ? params.actor.role : (params.actorRole ?? null);
			const actorName = params.actor ? params.actor.name : null;
			const actorEmail = params.actor ? params.actor.email : null;

			await this.auditLogRepository.create({
				actorId,
				actorRole,
				actorName,
				actorEmail,
				action: params.action,
				targetType: params.targetType,
				targetId: params.targetId,
				metadata: this.redactSensitiveData(params.metadata ?? {}) as Record<string, unknown>,
				ipAddress: params.ipAddress ?? context.ipAddress,
				userAgent: params.userAgent ?? context.userAgent,
			});
		} catch (error) {
			this.logger.warn(`Failed to write audit log: ${this.getErrorMessage(error)}`);
		}
	}

	async listAuditLogs(query: AuditLogListQueryDto): Promise<AuditLogListResponse> {
		const logs = await this.auditLogRepository.list(query);

		return {
			rows: logs.rows.map(mapAuditLogResponse),
			total: logs.total,
			page: logs.page,
			pageSize: logs.pageSize,
		};
	}

	async getFilterOptions(): Promise<AuditLogFilterOptionsResponse> {
		const [actions, targetTypes] = await Promise.all([
			this.auditLogRepository.getDistinctActions(),
			this.auditLogRepository.getDistinctTargetTypes(),
		]);

		return { actions, targetTypes };
	}

	private getRequestContext(request?: Request): {
		ipAddress: string | null;
		userAgent: string | null;
	} {
		if (!request) {
			return {
				ipAddress: null,
				userAgent: null,
			};
		}

		const forwardedFor = this.getKnownValue(request.get('x-forwarded-for'));
		const forwardedIp = forwardedFor?.split(',')[0]?.trim();
		const ipAddress =
			this.getKnownValue(forwardedIp) ??
			this.getKnownValue(request.get('x-real-ip')) ??
			this.getKnownValue(request.ip) ??
			this.getKnownValue(request.socket.remoteAddress);

		const userAgent =
			this.getKnownValue(request.get('x-client-user-agent')) ??
			this.getKnownValue(request.get('x-original-user-agent')) ??
			this.getKnownValue(request.get('x-forwarded-user-agent')) ??
			this.getKnownValue(request.get('user-agent'));

		return {
			ipAddress: ipAddress ?? null,
			userAgent: userAgent ?? null,
		};
	}

	private redactSensitiveData(value: unknown): unknown {
		if (Array.isArray(value)) {
			return value.map(item => this.redactSensitiveData(item));
		}

		if (!this.isRecord(value)) return value;

		return Object.fromEntries(
			Object.entries(value).map(([key, entryValue]) => [
				key,
				this.isSensitiveField(key) ? '[redacted]' : this.redactSensitiveData(entryValue),
			]),
		);
	}

	private isSensitiveField(key: string): boolean {
		return this.sensitiveFields.has(key.toLowerCase());
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

	private getErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : 'Unknown error';
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}
}
