export interface TwoFactorStatusResponse {
	enabled: boolean;
	recoveryCodeCount: number;
}

export interface TwoFactorSetupStartResponse {
	otpauthUrl: string;
	qrCodeDataUrl: string;
	manualEntryKey: string;
	expiresAt: Date;
}

export interface TwoFactorRecoveryCodesResponse {
	recoveryCodes: string[];
}

export interface TwoFactorVerifyResponse {
	verified: boolean;
}

export interface TwoFactorDisableResponse {
	disabled: boolean;
	revokedOtherSessionCount: number;
	passwordRemoved: boolean;
}
