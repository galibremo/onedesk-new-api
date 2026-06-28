import * as Handlebars from 'handlebars';

import type { EmailTemplateSchemaType } from '../../core/database/types';

export interface CompiledEmailTemplate {
	key: string;
	version: number;
	subject: Handlebars.TemplateDelegate;
	html: Handlebars.TemplateDelegate;
	text?: Handlebars.TemplateDelegate;
}

export interface RenderedEmailTemplate {
	subject: string;
	html: string;
	text?: string;
	version: number;
}

export function compileEmailTemplate(template: EmailTemplateSchemaType): CompiledEmailTemplate {
	return {
		key: template.key,
		version: template.version,
		subject: Handlebars.compile(template.subject),
		html: Handlebars.compile(template.html),
		text: template.text ? Handlebars.compile(template.text) : undefined,
	};
}

export function renderEmailTemplate(
	template: CompiledEmailTemplate,
	params: Record<string, unknown>,
): RenderedEmailTemplate {
	return {
		subject: template.subject(params),
		html: template.html(params),
		text: template.text ? template.text(params) : undefined,
		version: template.version,
	};
}
