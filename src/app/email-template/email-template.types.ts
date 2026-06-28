import type { TemplateVariableDescriptor } from './email-template.registry';

export interface EmailTemplateResponse {
	publicId: string;
	key: string;
	subject: string;
	html: string;
	text: string | null;
	variables: TemplateVariableDescriptor[];
	version: number;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface EmailTemplateListResponse {
	rows: EmailTemplateResponse[];
	total: number;
	page: number;
	pageSize: number;
}

export interface UpdateEmailTemplateDto {
	subject?: string;
	html?: string;
	text?: string;
	isActive?: boolean;
}
