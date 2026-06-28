import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const REQUEST_ID_REGEX = /^[a-zA-Z0-9-]+$/;
const MAX_REQUEST_ID_LENGTH = 64;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
	const header = req.headers['x-request-id'];
	let requestId: string;

	if (
		typeof header === 'string' &&
		header.length <= MAX_REQUEST_ID_LENGTH &&
		REQUEST_ID_REGEX.test(header)
	) {
		requestId = header;
	} else {
		requestId = randomUUID();
	}

	req.requestId = requestId;
	res.setHeader('X-Request-Id', requestId);
	next();
}
