export interface EmailLogResponse {
	id: string;
	smtpProviderId: string | null;
	toEmail: string;
	toName: string | null;
	subject: string;
	templateKey: string | null;
	status: 'sent' | 'failed';
	errorMessage: string | null;
	metadata: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export interface EmailLogListResponse {
	rows: EmailLogResponse[];
	total: number;
	page: number;
	pageSize: number;
}
