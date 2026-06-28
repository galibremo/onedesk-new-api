import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DomainError, unauthorizedError } from '../../core/errors/domain-error';
import { EnvType } from '../../core/validators/env';
import { SystemService } from '../system/system.service';
import type {
	DashboardAccessRestriction,
	DashboardAccessRestrictionCode,
	UserWithoutPassword,
} from './auth.types';
import { dashboardAccessRestrictionCodes } from './auth.types';

const dashboardAccessRestrictionMessages: Record<DashboardAccessRestrictionCode, string> = {
	account_pending_approval: 'Your account is pending approval by an administrator.',
	dashboard_role_not_allowed: 'Your role is not allowed to access the dashboard.',
};

@Injectable()
export class AuthPolicy {
	constructor(
		private readonly systemService: SystemService,
		private readonly configService: ConfigService<EnvType, true>,
	) {}

	async getDashboardAccessRestriction(
		user: Pick<UserWithoutPassword, 'isApproved' | 'role'>,
	): Promise<DashboardAccessRestriction | null> {
		if (!user.isApproved) {
			return this.createDashboardAccessRestriction('account_pending_approval');
		}

		if (user.role === 'SUPER_ADMIN') return null;

		const settings = await this.systemService.getSettings();
		if (!settings.allowedRoles.includes(user.role)) {
			return this.createDashboardAccessRestriction('dashboard_role_not_allowed');
		}

		return null;
	}

	async assertCanAccessDashboard(
		user: Pick<UserWithoutPassword, 'isApproved' | 'role'>,
	): Promise<void> {
		const restriction = await this.getDashboardAccessRestriction(user);

		if (!restriction) return;

		throw unauthorizedError(restriction.message, { reason: restriction.code });
	}

	getDashboardAccessRestrictionFromError(error: unknown): DashboardAccessRestriction | null {
		if (!(error instanceof DomainError)) return null;

		const reason = error.meta.reason;
		if (!this.isDashboardAccessRestrictionCode(reason)) return null;

		return {
			code: reason,
			message: this.getDomainErrorMessage(error) ?? dashboardAccessRestrictionMessages[reason],
		};
	}

	getDashboardAccessRestrictionLoginUrl(restriction: DashboardAccessRestriction): string {
		const appUrl = this.configService.get('APP_URL', { infer: true });
		const url = new URL('/login', appUrl);

		url.searchParams.set('error', restriction.code);
		url.searchParams.set('message', restriction.message);

		return url.toString();
	}

	private createDashboardAccessRestriction(
		code: DashboardAccessRestrictionCode,
	): DashboardAccessRestriction {
		return {
			code,
			message: dashboardAccessRestrictionMessages[code],
		};
	}

	private getDomainErrorMessage(error: DomainError): string | null {
		const response = error.getResponse();

		if (
			typeof response === 'object' &&
			response !== null &&
			'message' in response &&
			typeof response.message === 'string'
		) {
			return response.message;
		}

		return error.message || null;
	}

	private isDashboardAccessRestrictionCode(
		value: unknown,
	): value is DashboardAccessRestrictionCode {
		return (
			typeof value === 'string' &&
			dashboardAccessRestrictionCodes.includes(value as DashboardAccessRestrictionCode)
		);
	}
}
