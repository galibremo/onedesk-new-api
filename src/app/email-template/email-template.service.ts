import { Injectable } from '@nestjs/common';

import type { EmailTemplateSchemaType } from '../../core/database/types';
import type { EmailTemplateListQueryDto } from './schemas/email-template-list.schema';
import { notFoundError } from '../../core/errors/domain-error';
import {
	compileEmailTemplate,
	type CompiledEmailTemplate,
	renderEmailTemplate,
	type RenderedEmailTemplate,
} from './email-template.mapper';
import { EmailTemplateRepository } from './email-template.repository';

@Injectable()
export class EmailTemplateService {
	private readonly cache = new Map<string, CompiledEmailTemplate>();

	constructor(private readonly templateRepository: EmailTemplateRepository) {}

	async getActiveTemplateCompiled(templateKey: string): Promise<CompiledEmailTemplate> {
		const cached = this.cache.get(templateKey);
		if (cached) return cached;

		const template = await this.templateRepository.findActiveByKey(templateKey);

		if (!template) {
			throw notFoundError(
				'email_template_not_found',
				`No active email template found for key="${templateKey}"`,
			);
		}

		const compiled = compileEmailTemplate(template);
		this.cache.set(templateKey, compiled);

		return compiled;
	}

	invalidate(templateKey: string): boolean {
		return this.cache.delete(templateKey);
	}

	async render(
		templateKey: string,
		params: Record<string, unknown>,
	): Promise<RenderedEmailTemplate> {
		const template = await this.getActiveTemplateCompiled(templateKey);

		return renderEmailTemplate(template, params);
	}

	async getActiveTemplates(query: EmailTemplateListQueryDto): Promise<{
		rows: EmailTemplateSchemaType[];
		total: number;
		page: number;
		pageSize: number;
	}> {
		return this.templateRepository.findAll(query);
	}

	async getByPublicId(publicId: string): Promise<EmailTemplateSchemaType> {
		const template = await this.templateRepository.findByPublicId(publicId);

		if (!template) {
			throw notFoundError(
				'email_template_not_found',
				`Email template with publicId=${publicId} not found`,
			);
		}

		return template;
	}

	async updateTemplate(
		publicId: string,
		data: { subject?: string; html?: string; text?: string; isActive?: boolean },
	): Promise<EmailTemplateSchemaType> {
		const existing = await this.templateRepository.findByPublicId(publicId);

		if (!existing) {
			throw notFoundError(
				'email_template_not_found',
				`Email template with publicId=${publicId} not found`,
			);
		}

		// Deactivate the current version
		await this.templateRepository.deactivateByKeyAndVersion(existing.key, existing.version);

		// Create new version with incremented version number
		const newVersion = existing.version + 1;
		const newTemplate = await this.templateRepository.create({
			key: existing.key,
			subject: data.subject ?? existing.subject,
			html: data.html ?? existing.html,
			text: data.text !== undefined ? data.text : existing.text ?? undefined,
			variables: existing.variables,
			isActive: data.isActive ?? true,
			version: newVersion,
		});

		// Invalidate cache for this template key
		this.invalidate(existing.key);

		return newTemplate;
	}
}
