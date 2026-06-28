import { ArgumentMetadata, Inject, Injectable, Optional, PipeTransform } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { z } from 'zod';

import { validationFailed } from '../../core/errors/domain-error';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
	constructor(
		@Optional() private readonly schema?: z.ZodTypeAny,
		@Optional() @Inject(Reflector) private readonly reflector?: Reflector,
	) {}

	transform(value: unknown, metadata: ArgumentMetadata): unknown {
		// 1. Use constructor-supplied schema first (for manual parameter decorator instantiation)
		let schemaToUse = this.schema;

		// 2. Fallback: retrieve static schema from the parameter metatype (DTO class)
		if (!schemaToUse && metadata.metatype) {
			schemaToUse = (metadata.metatype as { schema?: z.ZodTypeAny }).schema;
		}

		// If no schema could be resolved, bypass validation
		if (!schemaToUse) {
			return value;
		}

		const parsed = schemaToUse.safeParse(value);

		if (!parsed.success) {
			const message =
				parsed.error.issues.map(issue => issue.message).join(', ') || 'Validation failed';

			throw validationFailed(message);
		}

		return parsed.data;
	}
}
