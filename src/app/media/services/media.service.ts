import { Inject, Injectable } from '@nestjs/common';

import { notFoundError, unprocessableError } from '../../../core/errors/domain-error';
import { PaginatedResponse } from '../../../common/interceptors/api-response.interceptor';
import type { MediaDataType, MediaResponseType } from '../media.types';
import { mapMediaDeleteResponse, mapMediaResponse, mapUploadToMediaData } from '../media.mapper';
import { MEDIA_CLOUDINARY_SERVICE } from '../media.providers';
import { MediaPolicy } from '../media.policy';
import { MediaRepository } from '../media.repository';
import { type MediaDto, type MediaListQueryDto } from '../media.schema';
import { CloudinaryImageService } from './cloudinary.service';

@Injectable()
export class MediaService {
	constructor(
		private readonly mediaRepository: MediaRepository,
		@Inject(MEDIA_CLOUDINARY_SERVICE)
		private readonly cloudinaryImageService: CloudinaryImageService,
	) {}

	async uploadFile(userId: number, file: Express.Multer.File): Promise<boolean> {
		await this.restrictMediaUpload(userId);

		const result = await this.cloudinaryImageService.uploadFromBuffer(file.buffer);

		if (!result.success || !result.data) {
			throw unprocessableError('media_upload_failed', result.error ?? 'Media upload failed');
		}

		return this.uploadMedia(mapUploadToMediaData(file, result.data, userId));
	}

	async uploadMedia(data: MediaDataType): Promise<boolean> {
		const createdMedia = await this.mediaRepository.create(data);

		if (!createdMedia)
			throw unprocessableError('media_create_failed', 'Media could not be created');

		return !!createdMedia;
	}

	async getAllMedia(
		userId: number,
		query: MediaListQueryDto,
	): Promise<PaginatedResponse<MediaResponseType>> {
		const { rows, total } = await this.mediaRepository.listByUserIdPaginated(userId, query);

		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 10;
		const totalPages = Math.ceil(total / pageSize);

		return {
			data: rows.map(mapMediaResponse),
			pagination: {
				totalItems: total,
				limit: pageSize,
				offset: (page - 1) * pageSize,
				currentPage: page,
				totalPages,
				hasPrevPage: page > 1,
				hasNextPage: page < totalPages,
				prevPage: page > 1 ? page - 1 : null,
				nextPage: page < totalPages ? page + 1 : null,
			},
		};
	}

	async getMediaByPublicId(userId: number, publicId: string): Promise<MediaResponseType> {
		const mediaItem = await this.mediaRepository.findByPublicIdForUser(userId, publicId);

		if (!mediaItem) throw notFoundError('media_not_found', 'Media not found');

		return mapMediaResponse(mediaItem);
	}

	async updateMediaData(userId: number, publicId: string, data: MediaDto): Promise<boolean> {
		const updatedMedia = await this.mediaRepository.updateForUser(userId, publicId, data);

		if (!updatedMedia) throw notFoundError('media_not_found', 'Media not found');

		return !!updatedMedia;
	}

	async deleteMedia(userId: number, publicId: string): Promise<boolean> {
		const deletedMedia = await this.mediaRepository.deleteForUser(userId, publicId);

		if (!deletedMedia) throw notFoundError('media_not_found', 'Media not found');

		const media = mapMediaDeleteResponse(deletedMedia);
		await this.cloudinaryImageService.deleteMedia(media.storageKey);

		return true;
	}

	async restrictMediaUpload(userId: number): Promise<boolean> {
		const mediaCount = await this.mediaRepository.countByUserId(userId);

		MediaPolicy.assertCanUpload(mediaCount);

		return true;
	}
}
