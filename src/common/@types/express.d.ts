import { UserSchemaType } from '../../core/database/types';

declare global {
	namespace Express {
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface User extends Omit<UserSchemaType, 'password' | 'twoFactorSecretEncrypted'> {}

		interface Request {
			user?: User;
			requestId?: string;
		}
	}
}
