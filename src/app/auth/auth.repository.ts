import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../../core/database/connection';
import schema from '../../core/database/schema';
import type { AccountSchemaType, UserSchemaType } from '../../core/database/types';
import type { UpdateProfileDto } from './schemas/auth.schema';
import type { CreateUser } from './auth.types';

export type AuthDatabase = NodePgDatabase<typeof schema>;
export type AuthTransaction = Parameters<Parameters<AuthDatabase['transaction']>[0]>[0];
export type AuthDbClient = Pick<AuthDatabase, 'query' | 'insert' | 'update' | 'delete'>;
export type AuthCreateUserData = Omit<CreateUser, 'password' | 'imageInformation'> & {
	password?: string | null;
	imageInformation?: UserSchemaType['imageInformation'];
};

@Injectable()
export class AuthRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: AuthDatabase,
	) {}

	transaction<T>(handler: (tx: AuthDbClient) => Promise<T>): Promise<T> {
		return this.db.transaction(handler);
	}

	findUserById(id: number, db: AuthDbClient = this.db): Promise<UserSchemaType | undefined> {
		return db.query.users.findFirst({
			where: eq(schema.users.id, id),
		});
	}

	findUserByPublicId(
		publicId: string,
		db: AuthDbClient = this.db,
	): Promise<UserSchemaType | undefined> {
		return db.query.users.findFirst({
			where: eq(schema.users.publicId, publicId),
		});
	}

	findUserByEmail(email: string, db: AuthDbClient = this.db): Promise<UserSchemaType | undefined> {
		return db.query.users.findFirst({
			where: eq(schema.users.email, email),
		});
	}

	async createUser(data: AuthCreateUserData, db: AuthDbClient = this.db): Promise<UserSchemaType> {
		return db
			.insert(schema.users)
			.values(data)
			.returning()
			.then(rows => rows[0]);
	}

	async createMagicLinkUser(
		email: string,
		isApproved = true,
		db: AuthDbClient = this.db,
	): Promise<UserSchemaType> {
		return db
			.insert(schema.users)
			.values({
				name: null,
				email,
				password: null,
				emailVerified: true,
				image: null,
				imageInformation: null,
				phone: null,
				role: 'USER',
				isApproved,
			})
			.returning()
			.then(rows => rows[0]);
	}

	async updateUser(
		userId: number,
		data: UpdateProfileDto & Pick<Partial<UserSchemaType>, 'imageInformation' | 'password'>,
		db: AuthDbClient = this.db,
	): Promise<UserSchemaType> {
		return db
			.update(schema.users)
			.set(data)
			.where(eq(schema.users.id, userId))
			.returning()
			.then(rows => rows[0]);
	}

	async markUserEmailVerified(
		userId: number,
		db: AuthDbClient = this.db,
	): Promise<UserSchemaType | undefined> {
		return db
			.update(schema.users)
			.set({ emailVerified: true })
			.where(eq(schema.users.id, userId))
			.returning()
			.then(rows => rows[0]);
	}

	async removePassword(userId: number, db: AuthDbClient = this.db): Promise<void> {
		await db.update(schema.users).set({ password: null }).where(eq(schema.users.id, userId));
	}

	findAccountByProvider(
		providerId: string,
		accountId: string,
		db: AuthDbClient = this.db,
	): Promise<AccountSchemaType | undefined> {
		return db.query.accounts.findFirst({
			where: and(
				eq(schema.accounts.providerId, providerId),
				eq(schema.accounts.accountId, accountId),
			),
		});
	}

	async createAccountLink(
		data: { accountId: string; providerId: string; userId: number },
		db: AuthDbClient = this.db,
	): Promise<void> {
		await db.insert(schema.accounts).values(data);
	}

	async deleteVerificationsByIdentifier(
		identifier: string,
		db: AuthDbClient = this.db,
	): Promise<void> {
		await db.delete(schema.verifications).where(eq(schema.verifications.identifier, identifier));
	}

	async deleteVerificationByIdentifierValue(
		identifier: string,
		value: string,
		db: AuthDbClient = this.db,
	): Promise<void> {
		await db
			.delete(schema.verifications)
			.where(
				and(eq(schema.verifications.identifier, identifier), eq(schema.verifications.value, value)),
			);
	}

	async createVerification(
		data: { identifier: string; value: string; expiresAt: Date },
		db: AuthDbClient = this.db,
	): Promise<void> {
		await db.insert(schema.verifications).values(data);
	}

	findVerification(identifier: string, value: string, db: AuthDbClient = this.db) {
		return db.query.verifications.findFirst({
			where: and(
				eq(schema.verifications.identifier, identifier),
				eq(schema.verifications.value, value),
			),
		});
	}
}
