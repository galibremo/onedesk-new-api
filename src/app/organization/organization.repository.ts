import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../../core/database/connection';
import schema from '../../core/database/schema';
import type {
	OrganizationMemberSchemaType,
	OrganizationSchemaType,
	UserSchemaType,
} from '../../core/database/types';
import type { MemberFilterQuery, MemberWithUserRow, OrgRoleEnum } from './organization.types';

export type OrgDatabase = NodePgDatabase<typeof schema>;
export type OrgDbClient = Pick<OrgDatabase, 'query' | 'insert' | 'update' | 'delete'>;

@Injectable()
export class OrganizationRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: OrgDatabase,
	) {}

	transaction<T>(handler: (tx: OrgDbClient) => Promise<T>): Promise<T> {
		return this.db.transaction(handler);
	}

	findByPublicId(publicId: string): Promise<OrganizationSchemaType | undefined> {
		return this.db.query.organizations.findFirst({
			where: eq(schema.organizations.publicId, publicId),
		});
	}

	findById(id: number): Promise<OrganizationSchemaType | undefined> {
		return this.db.query.organizations.findFirst({
			where: eq(schema.organizations.id, id),
		});
	}

	async findOwnedOrgs(ownerId: number): Promise<OrganizationSchemaType[]> {
		return this.db.query.organizations.findMany({
			where: eq(schema.organizations.ownerId, ownerId),
		});
	}

	async findInvitedOrgs(userId: number): Promise<
		{
			org: OrganizationSchemaType;
			member: OrganizationMemberSchemaType;
		}[]
	> {
		const rows = await this.db
			.select({
				org: schema.organizations,
				member: schema.organizationMembers,
			})
			.from(schema.organizationMembers)
			.innerJoin(
				schema.organizations,
				eq(schema.organizationMembers.organizationId, schema.organizations.id),
			)
			.where(
				and(
					eq(schema.organizationMembers.userId, userId),
					ne(schema.organizationMembers.status, 'INACTIVE'),
				),
			);
		return rows;
	}

	async slugExists(slug: string): Promise<boolean> {
		const row = await this.db.query.organizations.findFirst({
			where: eq(schema.organizations.slug, slug),
		});
		return !!row;
	}

	async findByNameAndOwner(
		name: string,
		ownerId: number,
		excludeId?: number,
	): Promise<OrganizationSchemaType | undefined> {
		const conditions = [
			eq(schema.organizations.name, name),
			eq(schema.organizations.ownerId, ownerId),
		];
		if (excludeId !== undefined) {
			conditions.push(ne(schema.organizations.id, excludeId));
		}
		return this.db.query.organizations.findFirst({
			where: and(...conditions),
		});
	}

	async create(
		data: {
			name: string;
			slug: string;
			ownerId: number;
			description?: string;
			industry?: string;
		},
		db: OrgDbClient = this.db,
	): Promise<OrganizationSchemaType> {
		return db
			.insert(schema.organizations)
			.values(data)
			.returning()
			.then(rows => rows[0]);
	}

	async update(
		id: number,
		data: Partial<{
			name: string;
			description: string | null;
			industry: string | null;
		}>,
		db: OrgDbClient = this.db,
	): Promise<OrganizationSchemaType | undefined> {
		return db
			.update(schema.organizations)
			.set(data)
			.where(eq(schema.organizations.id, id))
			.returning()
			.then(rows => rows[0]);
	}

	async updateLogo(id: number, logo: string, logoPublicId: string): Promise<void> {
		await this.db
			.update(schema.organizations)
			.set({ logo, logoPublicId })
			.where(eq(schema.organizations.id, id));
	}

	findMember(
		orgId: number,
		userId: number,
	): Promise<OrganizationMemberSchemaType | undefined> {
		return this.db.query.organizationMembers.findFirst({
			where: and(
				eq(schema.organizationMembers.organizationId, orgId),
				eq(schema.organizationMembers.userId, userId),
			),
		});
	}

	async findAllMembers(orgId: number): Promise<MemberWithUserRow[]> {
		const rows = await this.db
			.select({
				memberId: schema.organizationMembers.id,
				memberPublicId: schema.organizationMembers.publicId,
				role: schema.organizationMembers.role,
				status: schema.organizationMembers.status,
				joinedAt: schema.organizationMembers.createdAt,
				userId: schema.users.id,
				userPublicId: schema.users.publicId,
				userName: schema.users.name,
				userEmail: schema.users.email,
				userImage: schema.users.image,
				emailVerified: schema.users.emailVerified,
			})
			.from(schema.organizationMembers)
			.innerJoin(schema.users, eq(schema.organizationMembers.userId, schema.users.id))
			.where(eq(schema.organizationMembers.organizationId, orgId))
			.orderBy(asc(schema.users.name));
		return rows;
	}

	async findMembersPaginated(
		orgId: number,
		filter: MemberFilterQuery,
	): Promise<{ rows: MemberWithUserRow[]; total: number }> {
		const page = filter.page ?? 1;
		const limit = filter.limit ?? 20;
		const offset = (page - 1) * limit;

		const conditions = [eq(schema.organizationMembers.organizationId, orgId)];

		if (filter.search) {
			conditions.push(
				or(
					ilike(schema.users.name, `%${filter.search}%`),
					ilike(schema.users.email, `%${filter.search}%`),
				)!,
			);
		}

		if (filter.roleQuery) {
			const roles = filter.roleQuery.split(',').map(r => r.trim()) as OrgRoleEnum[];
			conditions.push(inArray(schema.organizationMembers.role, roles));
		}

		const whereClause = and(...conditions);

		const orderColumn =
			filter.sortBy === 'email'
				? schema.users.email
				: filter.sortBy === 'joinedDate'
					? schema.organizationMembers.createdAt
					: schema.users.name;

		const orderDirection = filter.sortOrder === 'DESC' ? desc(orderColumn) : asc(orderColumn);

		const [rows, totalRows] = await Promise.all([
			this.db
				.select({
					memberId: schema.organizationMembers.id,
					memberPublicId: schema.organizationMembers.publicId,
					role: schema.organizationMembers.role,
					status: schema.organizationMembers.status,
					joinedAt: schema.organizationMembers.createdAt,
					userId: schema.users.id,
					userPublicId: schema.users.publicId,
					userName: schema.users.name,
					userEmail: schema.users.email,
					userImage: schema.users.image,
					emailVerified: schema.users.emailVerified,
				})
				.from(schema.organizationMembers)
				.innerJoin(schema.users, eq(schema.organizationMembers.userId, schema.users.id))
				.where(whereClause)
				.orderBy(orderDirection)
				.limit(limit)
				.offset(offset),
			this.db
				.select({ value: count() })
				.from(schema.organizationMembers)
				.innerJoin(schema.users, eq(schema.organizationMembers.userId, schema.users.id))
				.where(whereClause),
		]);

		return { rows, total: Number(totalRows[0]?.value ?? 0) };
	}

	async upsertMember(
		data: { userId: number; organizationId: number; role: OrgRoleEnum },
		db: OrgDbClient = this.db,
	): Promise<OrganizationMemberSchemaType> {
		return db
			.insert(schema.organizationMembers)
			.values({ ...data, status: 'INVITED' })
			.onConflictDoUpdate({
				target: [schema.organizationMembers.userId, schema.organizationMembers.organizationId],
				set: {
					role: sql`excluded.role`,
					status: 'INVITED',
					updatedAt: new Date(),
				},
			})
			.returning()
			.then(rows => rows[0]);
	}

	async updateMemberRole(orgId: number, userId: number, role: OrgRoleEnum): Promise<void> {
		await this.db
			.update(schema.organizationMembers)
			.set({ role })
			.where(
				and(
					eq(schema.organizationMembers.organizationId, orgId),
					eq(schema.organizationMembers.userId, userId),
				),
			);
	}

	async removeMembers(orgId: number, userIds: number[]): Promise<void> {
		await this.db
			.delete(schema.organizationMembers)
			.where(
				and(
					eq(schema.organizationMembers.organizationId, orgId),
					inArray(schema.organizationMembers.userId, userIds),
				),
			);
	}

	getMemberCount(orgId: number): Promise<number> {
		return this.db
			.select({ value: count() })
			.from(schema.organizationMembers)
			.where(
				and(
					eq(schema.organizationMembers.organizationId, orgId),
					ne(schema.organizationMembers.status, 'INACTIVE'),
				),
			)
			.then(rows => Number(rows[0]?.value ?? 0));
	}

	findUserByEmail(email: string): Promise<UserSchemaType | undefined> {
		return this.db.query.users.findFirst({
			where: eq(schema.users.email, email.toLowerCase()),
		});
	}

	findUserByPublicId(publicId: string): Promise<UserSchemaType | undefined> {
		return this.db.query.users.findFirst({
			where: eq(schema.users.publicId, publicId),
		});
	}

	async createStubUser(email: string, db: OrgDbClient = this.db): Promise<UserSchemaType> {
		return db
			.insert(schema.users)
			.values({
				email: email.toLowerCase(),
				name: null,
				password: null,
				emailVerified: false,
				image: null,
				imageInformation: null,
				phone: null,
				role: 'USER',
				isApproved: true,
			})
			.returning()
			.then(rows => rows[0]);
	}
}
