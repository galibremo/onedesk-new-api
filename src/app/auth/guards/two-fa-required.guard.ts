import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { badRequestError } from '../../../core/errors/domain-error';

@Injectable()
export class TwoFaRequiredGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<Request>();
		const user = request.user;

		if (!user) {
			throw badRequestError('Authentication required');
		}

		if (!user.is2faEnabled) {
			throw badRequestError('Two-factor authentication must be enabled before setting a password', {
				code: '2fa_required',
			});
		}

		return true;
	}
}
