import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../../core/database/connection';
import schema from '../../core/database/schema';
import type { SystemSettingsSchemaType } from '../../core/database/types';

export type SystemDatabase = NodePgDatabase<typeof schema>;
export type SystemDbClient = Pick<SystemDatabase, 'query' | 'insert' | 'update' | 'delete'>;

@Injectable()
export class SystemRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: SystemDatabase,
	) {}

	async initializeSchema(): Promise<void> {
		// 1. Create access_model_type enum if not exists
		await this.db.execute(sql`
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_model_type') THEN
					CREATE TYPE access_model_type AS ENUM ('OPEN', 'APPROVAL_BASED', 'CLOSED');
				END IF;
			END
			$$;
		`);

		// 2. Add is_approved column to users if not exists
		await this.db.execute(sql`
			ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE NOT NULL;
		`);

		// 3. Create system_settings table if not exists
		await this.db.execute(sql`
			CREATE TABLE IF NOT EXISTS system_settings (
				id SERIAL PRIMARY KEY,
				access_model access_model_type DEFAULT 'OPEN' NOT NULL,
				allowed_roles TEXT[] DEFAULT ARRAY['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'] NOT NULL,
				created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
				updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
			);
		`);
	}

	async getSettings(db: SystemDbClient = this.db): Promise<SystemSettingsSchemaType | undefined> {
		return db.query.systemSettings.findFirst({
			orderBy: (table, { asc }) => asc(table.id),
		});
	}

	async createSettings(
		data: typeof schema.systemSettings.$inferInsert,
		db: SystemDbClient = this.db,
	): Promise<SystemSettingsSchemaType> {
		return db
			.insert(schema.systemSettings)
			.values(data)
			.returning()
			.then(rows => rows[0]);
	}

	async updateSettings(
		id: number,
		data: Partial<typeof schema.systemSettings.$inferInsert>,
		db: SystemDbClient = this.db,
	): Promise<SystemSettingsSchemaType> {
		return db
			.update(schema.systemSettings)
			.set(data)
			.where(eq(schema.systemSettings.id, id))
			.returning()
			.then(rows => rows[0]);
	}
}
