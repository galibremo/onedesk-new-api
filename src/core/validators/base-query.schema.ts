import { z } from 'zod';

import { validateDate, validateEnum, validatePositiveInteger, validateString } from './common.schema';

export type SortableField = { name: string; queryName: string };

export const baseQuerySchema = (sortableFields: readonly SortableField[]) => {
	const sortValues = sortableFields.map(field => field.name) as [string, ...string[]];

	const getSortField = (sort?: string) => {
		if (!sort) return undefined;
		return sortableFields.find(field => field.name === sort)?.queryName;
	};

	return z
		.object({
			page: validatePositiveInteger('Page').optional(),
			pageSize: validatePositiveInteger('Page Size')
				.max(500, 'Page Size must not exceed 500')
				.optional(),
			sort: validateEnum('Sort By', sortValues)
				.optional()
				.transform((val: string | undefined) => getSortField(val)), // Transform directly here
			dir: validateEnum('Sort Order', ['asc', 'desc']).optional(),
			search: validateString('Search').optional(),
			fromDate: validateDate('From Date').optional(),
			toDate: validateDate('To Date').optional(),
		})
		.refine(data => !data.fromDate || !data.toDate || data.fromDate <= data.toDate, {
			message: 'fromDate must be less than or equal to toDate',
			path: ['toDate'],
		});
};
