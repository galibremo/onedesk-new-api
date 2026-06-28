import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../../core/database/connection';
import schema from '../../core/database/schema';

@Injectable()
export class DrizzleHealthIndicator extends HealthIndicator {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: NodePgDatabase<typeof schema>,
	) {
		super();
	}

	async pingCheck(key: string): Promise<HealthIndicatorResult> {
		try {
			await this.db.execute(sql`SELECT 1`);
			return this.getStatus(key, true);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown database error';
			return this.getStatus(key, false, { message });
		}
	}
}
