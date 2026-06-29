import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { badRequestError } from '../../core/errors/domain-error';

export const CurrentOrgId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
	const request = ctx.switchToHttp().getRequest<Request>();
	const orgId = request.headers['x-organization-id'] as string | undefined;

	if (!orgId) {
		throw badRequestError('x-organization-id header is required for this endpoint.');
	}

	return orgId;
});
