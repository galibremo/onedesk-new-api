import type { EmailProviderType } from './email-provider.interface';

export interface SmtpProviderResponse {
	id: string;
	name: string;
	providerType: EmailProviderType;
	config: Record<string, unknown>;
	isDefault: boolean;
	isActive: boolean;
	lastTestedAt: string | null;
	lastTestStatus: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface SmtpProviderListResponse {
	rows: SmtpProviderResponse[];
	total: number;
	page: number;
	pageSize: number;
}

export interface CreateSmtpProviderDto {
	name: string;
	providerType: EmailProviderType;
	config: Record<string, unknown>;
}

export interface UpdateSmtpProviderDto {
	name?: string;
	config?: Record<string, unknown>;
}

export interface TestConnectionResponse {
	success: boolean;
	message: string;
}

export interface BrevoConfig {
	apiKey: string;
	senderEmail: string;
	senderName: string;
}

export interface ResendConfig {
	apiKey: string;
	senderEmail: string;
	senderName: string;
}

export interface NodemailerConfig {
	host: string;
	port: number;
	secure: boolean;
	auth: {
		user: string;
		pass: string;
	};
	senderEmail: string;
	senderName: string;
}

export interface AwsSesConfig {
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	senderEmail: string;
	senderName: string;
}
