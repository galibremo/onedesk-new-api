import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../../../core/database/connection';
import schema from '../../../core/database/schema';
import type {
	TwoFactorRecoveryCodeSchemaType,
	TwoFactorSetupSchemaType,
	UserSchemaType,
} from '../../../core/database/types';

export type TwoFactorDatabase = NodePgDatabase<typeof schema>;
export type TwoFactorTransaction = Parameters<Parameters<TwoFactorDatabase['transaction']>[0]>[0];
export type TwoFactorDbClient = Pick<TwoFactorDatabase, 'query' | 'insert' | 'update' | 'delete'>;

@Injectable()
export class TwoFactorRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: TwoFactorDatabase,
	) {}

	transaction<T>(handler: (tx: TwoFactorDbClient) => Promise<T>): Promise<T> {
		return this.db.transaction(handler);
	}

	findUserById(
		userId: number,
		db: TwoFactorDbClient = this.db,
	): Promise<UserSchemaType | undefined> {
		return db.query.users.findFirst({
			where: eq(schema.users.id, userId),
		});
	}

	findSetupByUserId(
		userId: number,
		db: TwoFactorDbClient = this.db,
	): Promise<TwoFactorSetupSchemaType | undefined> {
		return db.query.twoFactorSetups.findFirst({
			where: eq(schema.twoFactorSetups.userId, userId),
		});
	}

	async replaceSetup(
		data: { userId: number; secretEncrypted: string; expiresAt: Date },
		db: TwoFactorDbClient = this.db,
	): Promise<TwoFactorSetupSchemaType> {
		await this.deleteSetupByUserId(data.userId, db);

		return db
			.insert(schema.twoFactorSetups)
			.values(data)
			.returning()
			.then(rows => rows[0]);
	}

	async deleteSetupByUserId(userId: number, db: TwoFactorDbClient = this.db): Promise<void> {
		await db.delete(schema.twoFactorSetups).where(eq(schema.twoFactorSetups.userId, userId));
	}

	async enableTwoFactor(
		userId: number,
		secretEncrypted: string,
		db: TwoFactorDbClient = this.db,
	): Promise<UserSchemaType | undefined> {
		return db
			.update(schema.users)
			.set({ is2faEnabled: true, twoFactorSecretEncrypted: secretEncrypted })
			.where(eq(schema.users.id, userId))
			.returning()
			.then(rows => rows[0]);
	}

	async disableTwoFactor(
		userId: number,
		db: TwoFactorDbClient = this.db,
	): Promise<UserSchemaType | undefined> {
		return db
			.update(schema.users)
			.set({ is2faEnabled: false, twoFactorSecretEncrypted: null })
			.where(eq(schema.users.id, userId))
			.returning()
			.then(rows => rows[0]);
	}

	async replaceRecoveryCodes(
		userId: number,
		codeHashes: string[],
		db: TwoFactorDbClient = this.db,
	): Promise<void> {
		await db
			.delete(schema.twoFactorRecoveryCodes)
			.where(eq(schema.twoFactorRecoveryCodes.userId, userId));

		if (codeHashes.length === 0) return;

		await db.insert(schema.twoFactorRecoveryCodes).values(
			codeHashes.map(codeHash => ({
				userId,
				codeHash,
			})),
		);
	}

	async deleteRecoveryCodesByUserId(
		userId: number,
		db: TwoFactorDbClient = this.db,
	): Promise<void> {
		await db
			.delete(schema.twoFactorRecoveryCodes)
			.where(eq(schema.twoFactorRecoveryCodes.userId, userId));
	}

	findUnusedRecoveryCode(
		userId: number,
		codeHash: string,
		db: TwoFactorDbClient = this.db,
	): Promise<TwoFactorRecoveryCodeSchemaType | undefined> {
		return db.query.twoFactorRecoveryCodes.findFirst({
			where: and(
				eq(schema.twoFactorRecoveryCodes.userId, userId),
				eq(schema.twoFactorRecoveryCodes.codeHash, codeHash),
				isNull(schema.twoFactorRecoveryCodes.usedAt),
			),
		});
	}

	async markRecoveryCodeUsed(
		codeId: number,
		db: TwoFactorDbClient = this.db,
	): Promise<TwoFactorRecoveryCodeSchemaType | undefined> {
		return db
			.update(schema.twoFactorRecoveryCodes)
			.set({ usedAt: new Date() })
			.where(
				and(
					eq(schema.twoFactorRecoveryCodes.id, codeId),
					isNull(schema.twoFactorRecoveryCodes.usedAt),
				),
			)
			.returning()
			.then(rows => rows[0]);
	}

	async countUnusedRecoveryCodes(userId: number): Promise<number> {
		const codes = await this.db.query.twoFactorRecoveryCodes.findMany({
			where: and(
				eq(schema.twoFactorRecoveryCodes.userId, userId),
				isNull(schema.twoFactorRecoveryCodes.usedAt),
			),
			columns: { id: true },
		});

		return codes.length;
	}
}
