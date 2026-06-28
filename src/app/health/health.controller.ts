import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

import { EnvType } from '../../core/validators/env';
import { DrizzleHealthIndicator } from './drizzle-health.indicator';

@SkipThrottle()
@Controller('health')
export class HealthController {
	constructor(
		private readonly health: HealthCheckService,
		private readonly drizzleHealth: DrizzleHealthIndicator,
		private readonly memory: MemoryHealthIndicator,
		private readonly config: ConfigService<EnvType, true>,
	) {}

	@Get()
	@HealthCheck()
	check() {
		const heapLimitMb = this.config.get('HEALTH_HEAP_LIMIT_MB', { infer: true });
		const rssLimitMb = this.config.get('HEALTH_RSS_LIMIT_MB', { infer: true });

		return this.health.check([
			() => this.drizzleHealth.pingCheck('database'),
			() => this.memory.checkHeap('memory_heap', heapLimitMb * 1024 * 1024),
			() => this.memory.checkRSS('memory_rss', rssLimitMb * 1024 * 1024),
		]);
	}
}
