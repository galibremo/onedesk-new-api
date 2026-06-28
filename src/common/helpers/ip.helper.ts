import type { Request } from 'express';

export function extractIp(req: Request, trustProxy: boolean): string {
	if (trustProxy) {
		const forwardedFor = req.headers['x-forwarded-for'] as string | undefined;
		const realIp = req.headers['x-real-ip'] as string | undefined;

		if (forwardedFor) {
			return forwardedFor.split(',')[0].trim();
		}

		if (realIp) {
			return realIp.trim();
		}
	}

	const rawIp = req.ip || req.connection?.remoteAddress || '';
	return typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : String(rawIp);
}
