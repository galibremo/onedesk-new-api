import { Inject, Injectable } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE_CONNECTION } from '../../core/database/connection';
import { orderByColumn } from '../../core/database/helpers';
import schema from '../../core/database/schema';
import type {
	TeamMemberStatusEnum,
	TeamRoleEnum,
	TeamSchemaType,
	UserSchemaType,
} from '../../core/database/types';
import type { TeamListQueryDto, TeamMemberListQueryDto } from './team.schema';
import type { TeamManagementRow, TeamMemberRow } from './team.types';

export type TeamDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class TeamRepository {
	constructor(
		@Inject(DATABASE_CONNECTION)
		private readonly db: TeamDatabase,
	) {}

	findTeamByPublicId(publicId: string): Promise<TeamSchemaType | undefined> {
		return this.db.query.team.findFirst({
			where: eq(schema.team.publicId, publicId),
		});
	}

	findTeamByName(
		name: string,
		ownerId: number,
		excludeTeamId?: number,
	): Promise<TeamSchemaType | undefined> {
		return this.db.query.team.findFirst({
			where: and(
				eq(schema.team.ownerId, ownerId),
				eq(schema.team.name, name),
				isNull(schema.team.deletedAt),
				excludeTeamId ? sql`${schema.team.id} != ${excludeTeamId}` : undefined,
			),
		});
	}

	async findUsersByPublicIds(publicIds: string[]): Promise<UserSchemaType[]> {
		if (publicIds.length === 0) return [];

		return this.db.query.users.findMany({
			where: inArray(schema.users.publicId, publicIds),
		});
	}

	async listTeams(query: TeamListQueryDto): Promise<{
		rows: TeamManagementRow[];
		total: number;
		page: number;
		pageSize: number;
	}> {
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 10;
		const offset = (page - 1) * pageSize;
		const memberCountSql = this.memberCountSql();
		const whereClause = this.getListTeamsWhere(query);
		const orderBy = this.getTeamsOrderBy(query.sort, query.dir, memberCountSql);

		const [rows, totalRows] = await Promise.all([
			this.db
				.select(this.teamManagementSelection(memberCountSql))
				.from(schema.team)
				.leftJoin(schema.users, eq(schema.team.ownerId, schema.users.id))
				.leftJoin(schema.teamMembers, eq(schema.teamMembers.teamId, schema.team.id))
				.where(whereClause)
				.groupBy(
					schema.team.id,
					schema.team.publicId,
					schema.team.name,
					schema.team.status,
					schema.team.ownerId,
					schema.team.deletedAt,
					schema.team.createdAt,
					schema.team.updatedAt,
					schema.users.id,
					schema.users.publicId,
					schema.users.name,
					schema.users.email,
				)
				.orderBy(orderBy ?? desc(schema.team.createdAt))
				.limit(pageSize)
				.offset(offset),
			this.db.select({ value: count() }).from(schema.team).where(whereClause),
		]);

		return { rows, total: Number(totalRows[0]?.value ?? 0), page, pageSize };
	}

	async createTeam(
		data: Omit<typeof schema.team.$inferInsert, 'id' | 'publicId' | 'createdAt' | 'updatedAt'>,
	): Promise<TeamSchemaType | undefined> {
		return this.db
			.insert(schema.team)
			.values(data)
			.returning()
			.then(rows => rows[0]);
	}

	async createTeamMembers(
		members: Array<{
			teamId: number;
			userId: number;
			role: TeamRoleEnum;
			status: TeamMemberStatusEnum;
		}>,
	): Promise<number> {
		if (members.length === 0) return 0;

		const result = await this.db
			.insert(schema.teamMembers)
			.values(members)
			.onConflictDoNothing()
			.returning();

		return result.length;
	}

	async findTeamMembersByTeamId(
		teamId: number,
	): Promise<Array<{ userId: number; role: TeamRoleEnum }>> {
		return this.db
			.select({ userId: schema.teamMembers.userId, role: schema.teamMembers.role })
			.from(schema.teamMembers)
			.where(eq(schema.teamMembers.teamId, teamId));
	}

	async updateTeam(
		teamId: number,
		data: Partial<Pick<typeof schema.team.$inferInsert, 'name' | 'status'>>,
	): Promise<TeamSchemaType | undefined> {
		return this.db
			.update(schema.team)
			.set(data)
			.where(eq(schema.team.id, teamId))
			.returning()
			.then(rows => rows[0]);
	}

	async archiveTeam(teamId: number, archivedName: string): Promise<TeamSchemaType | undefined> {
		return this.db
			.update(schema.team)
			.set({ deletedAt: new Date(), name: archivedName })
			.where(eq(schema.team.id, teamId))
			.returning()
			.then(rows => rows[0]);
	}

	async listTeamMembers(
		teamId: number,
		query: TeamMemberListQueryDto,
	): Promise<{ rows: TeamMemberRow[]; total: number; page: number; pageSize: number }> {
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 10;
		const offset = (page - 1) * pageSize;
		const whereClause = this.getListMembersWhere(teamId, query);
		const orderBy = this.getMembersOrderBy(query.sort, query.dir);

		const selection = {
			userId: schema.users.id,
			userPublicId: schema.users.publicId,
			userName: schema.users.name,
			userEmail: schema.users.email,
			userImage: schema.users.image,
			role: schema.teamMembers.role,
			status: schema.teamMembers.status,
		};

		const [rows, totalRows] = await Promise.all([
			this.db
				.select(selection)
				.from(schema.teamMembers)
				.innerJoin(schema.users, eq(schema.teamMembers.userId, schema.users.id))
				.where(whereClause)
				.orderBy(orderBy ?? asc(schema.users.name))
				.limit(pageSize)
				.offset(offset),
			this.db
				.select({ value: count() })
				.from(schema.teamMembers)
				.innerJoin(schema.users, eq(schema.teamMembers.userId, schema.users.id))
				.where(whereClause),
		]);

		return { rows, total: Number(totalRows[0]?.value ?? 0), page, pageSize };
	}

	async updateTeamMemberRole(teamId: number, userId: number, role: TeamRoleEnum): Promise<void> {
		await this.db
			.update(schema.teamMembers)
			.set({ role })
			.where(and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, userId)));
	}

	async removeTeamMembers(teamId: number, userIds: number[]): Promise<number> {
		if (userIds.length === 0) return 0;

		const result = await this.db
			.delete(schema.teamMembers)
			.where(
				and(eq(schema.teamMembers.teamId, teamId), inArray(schema.teamMembers.userId, userIds)),
			)
			.returning();

		return result.length;
	}

	async findTeamMember(
		teamId: number,
		userId: number,
	): Promise<{ role: TeamRoleEnum } | undefined> {
		return this.db.query.teamMembers.findFirst({
			where: and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, userId)),
			columns: { role: true },
		});
	}

	async findTeamManagementRow(teamId: number): Promise<TeamManagementRow | undefined> {
		const memberCountSql = this.memberCountSql();

		return this.db
			.select(this.teamManagementSelection(memberCountSql))
			.from(schema.team)
			.leftJoin(schema.users, eq(schema.team.ownerId, schema.users.id))
			.leftJoin(schema.teamMembers, eq(schema.teamMembers.teamId, schema.team.id))
			.where(eq(schema.team.id, teamId))
			.groupBy(
				schema.team.id,
				schema.team.publicId,
				schema.team.name,
				schema.team.status,
				schema.team.ownerId,
				schema.team.deletedAt,
				schema.team.createdAt,
				schema.team.updatedAt,
				schema.users.id,
				schema.users.publicId,
				schema.users.name,
				schema.users.email,
			)
			.then(rows => rows[0]);
	}

	private memberCountSql(): SQL<number> {
		return sql<number>`COALESCE(COUNT(DISTINCT ${schema.teamMembers.userId}), 0)::int`;
	}

	private teamManagementSelection(memberCount: SQL<number>) {
		return {
			id: schema.team.id,
			publicId: schema.team.publicId,
			name: schema.team.name,
			status: schema.team.status,
			deletedAt: schema.team.deletedAt,
			createdAt: schema.team.createdAt,
			updatedAt: schema.team.updatedAt,
			memberCount,
			ownerId: schema.users.id,
			ownerPublicId: schema.users.publicId,
			ownerName: schema.users.name,
			ownerEmail: schema.users.email,
		};
	}

	private getListTeamsWhere(query: TeamListQueryDto): SQL<unknown> | undefined {
		const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
		const toDate = query.toDate ? new Date(query.toDate) : undefined;

		if (toDate) {
			toDate.setHours(23, 59, 59, 999);
		}

		const q = query.search ? `%${query.search}%` : undefined;
		const searchExists = q ? ilike(schema.team.name, q) : undefined;

		const conditions = [
			isNull(schema.team.deletedAt),
			searchExists,
			query.status?.length ? inArray(schema.team.status, query.status) : undefined,
			fromDate ? gte(schema.team.createdAt, fromDate) : undefined,
			toDate ? lte(schema.team.createdAt, toDate) : undefined,
		].filter(Boolean) as SQL<unknown>[];

		return conditions.length > 0 ? and(...conditions) : isNull(schema.team.deletedAt);
	}

	private getTeamsOrderBy(
		sort: string | undefined,
		dir: 'asc' | 'desc' | undefined,
		memberCountSql: SQL<number>,
	): SQL<unknown> | undefined {
		const direction = dir ?? 'desc';

		if (sort === 'memberCount') {
			return direction === 'desc' ? desc(memberCountSql) : asc(memberCountSql);
		}

		return orderByColumn(schema.team, sort, direction);
	}

	private getListMembersWhere(
		teamId: number,
		query: TeamMemberListQueryDto,
	): SQL<unknown> | undefined {
		const q = query.search ? `%${query.search}%` : undefined;
		const searchExists = q
			? or(ilike(schema.users.name, q), ilike(schema.users.email, q))
			: undefined;

		const conditions = [
			eq(schema.teamMembers.teamId, teamId),
			searchExists,
			query.role?.length ? inArray(schema.teamMembers.role, query.role) : undefined,
		].filter(Boolean) as SQL<unknown>[];

		return conditions.length > 0 ? and(...conditions) : eq(schema.teamMembers.teamId, teamId);
	}

	private getMembersOrderBy(
		sort: string | undefined,
		dir: 'asc' | 'desc' | undefined,
	): SQL<unknown> | undefined {
		const direction = dir ?? 'asc';

		if (!sort) return undefined;

		if (sort === 'role') {
			return direction === 'desc' ? desc(schema.teamMembers.role) : asc(schema.teamMembers.role);
		}

		if (sort === 'status') {
			return direction === 'desc'
				? desc(schema.teamMembers.status)
				: asc(schema.teamMembers.status);
		}

		return orderByColumn(schema.users, sort, direction);
	}
}
