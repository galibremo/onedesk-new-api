import type { PageInfo } from './interfaces/facebook-provider.interface';
import type { FacebookPageInfoResponse } from './facebook.types';

export function mapPageInfoToResponse(page: PageInfo): FacebookPageInfoResponse {
	return {
		facebookPageId: page.pageId,
		pageName: page.pageName,
		pageCategory: page.pageCategory,
		profilePicture: page.profilePicture,
	};
}
