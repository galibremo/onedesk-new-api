import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { unauthorizedError } from '../../core/errors/domain-error';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
	const request = ctx.switchToHttp().getRequest<Request>();

	if (!request.user) {
		throw unauthorizedError('Authentication is required');
	}

	return request.user;
});
