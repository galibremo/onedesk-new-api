import type { UploadApiResponse } from 'cloudinary';

import type { MediaSchemaType } from '../../core/database/types';
import type {
	MediaDataType,
	MediaDeleteResponseType,
	MediaResponseType,
} from './media.types';

export type MediaResponseRow = Pick<
	MediaSchemaType,
	| 'publicId'
	| 'filename'
	| 'mimeType'
	| 'fileSize'
	| 'secureUrl'
	| 'mediaType'
	| 'altText'
	| 'width'
	| 'height'
	| 'tags'
	| 'createdAt'
	| 'updatedAt'
>;

export type MediaDeleteRow = MediaResponseRow & Pick<MediaSchemaType, 'storageKey'>;

export function mapUploadToMediaData(
	file: Express.Multer.File,
	upload: UploadApiResponse,
	uploadedBy: number,
): MediaDataType {
	return {
		altText: null,
		secureUrl: upload.secure_url,
		filename: file.originalname,
		mimeType: file.mimetype,
		fileExtension: file.originalname.split('.').pop() || '',
		fileSize: file.size,
		storageKey: upload.public_id,
		mediaType: file.mimetype.startsWith('image/') ? 'image' : 'other',
		storageMetadata: upload,
		uploadedBy,
		caption: null,
		description: null,
		tags: upload.tags || [],
		duration: typeof upload.duration === 'number' ? String(upload.duration) : null,
		width: typeof upload.width === 'number' ? upload.width : null,
		height: typeof upload.height === 'number' ? upload.height : null,
	};
}

export function mapMediaResponse(row: MediaResponseRow): MediaResponseType {
	return row;
}

export function mapMediaDeleteResponse(row: MediaDeleteRow): MediaDeleteResponseType {
	return row;
}
