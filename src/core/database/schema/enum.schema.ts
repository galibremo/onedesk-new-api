import { pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const roleTypeEnum = pgEnum('role_type', ['ADMIN', 'MANAGER', 'USER', 'SUPER_ADMIN']);
export const accessModelEnum = pgEnum('access_model_type', ['OPEN', 'APPROVAL_BASED', 'CLOSED']);
