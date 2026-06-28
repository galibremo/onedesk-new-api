import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import schema from './schema';
import { seedEmailTemplates } from './seeds/email-template.seed';

async function main(): Promise<void> {
	const connectionString = process.env.DATABASE_URL;

	if (!connectionString) {
		throw new Error('DATABASE_URL is required to run database seeders.');
	}

	const pool = new Pool({ connectionString });
	const db = drizzle(pool, { schema });

	try {
		await seedEmailTemplates(db);
		console.log('Database seed completed successfully.');
	} finally {
		await pool.end();
	}
}

main().catch(error => {
	console.error('Database seed failed:', error);
	process.exit(1);
});
