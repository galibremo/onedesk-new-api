import { unprocessableError } from '../../core/errors/domain-error';

export class MediaPolicy {
	private static readonly maxMediaPerUser = 5;

	static assertCanUpload(mediaCount: number): void {
		if (mediaCount >= this.maxMediaPerUser) {
			throw unprocessableError(
				'media_upload_limit_reached',
				`Media upload limit reached. Maximum allowed is ${this.maxMediaPerUser} items.`,
			);
		}
	}
}
