export type EmailProviderType = 'brevo' | 'resend' | 'nodemailer' | 'aws-ses';

export interface SendEmailParams {
	to: { email: string; name?: string }[];
	subject: string;
	htmlContent?: string;
	textContent?: string;
	replyTo?: { email: string; name?: string };
	headers?: Record<string, string>;
}

export interface TestConnectionResult {
	success: boolean;
	message: string;
}

export interface EmailProvider {
	readonly type: EmailProviderType;
	send(params: SendEmailParams, config: Record<string, unknown>): Promise<void>;
	testConnection(config: Record<string, unknown>): Promise<TestConnectionResult>;
}
