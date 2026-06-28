import type { UserSchemaType } from '../../core/database/types';
import type { UserWithoutPassword, UserWithoutPasswordResponse } from './auth.types';

export function stripUserPassword(user: UserSchemaType): UserWithoutPassword {
	const { password, twoFactorSecretEncrypted, ...userWithoutPassword } = user;
	void password;
	void twoFactorSecretEncrypted;

	return {
		...userWithoutPassword,
		hasPassword: !!password,
	};
}

export function mapUserResponse(user: UserWithoutPassword): UserWithoutPasswordResponse {
	return {
		...user,
		id: user.publicId,
		imageInformation: null,
		hasPassword: user.hasPassword,
	};
}
