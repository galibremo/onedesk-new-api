import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
	protected override async getTracker(req: Request): Promise<string> {
		const rawIp = req.ip || req.connection?.remoteAddress || '';
		const ip = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : String(rawIp);
		return await Promise.resolve(ip);
	}
}
