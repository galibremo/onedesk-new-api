import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Query,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse, createApiResponse } from '../../common/interceptors/api-response.interceptor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { UserWithoutPassword } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MediaResponseType } from './media.types';
import { FILE_SIZE_LIMIT, singleFileSchema, ZodFileValidationPipe } from './media.pipe';
import {
	type MediaDto,
	mediaSchema,
	type MediaListQueryDto,
	mediaListQuerySchema,
} from './media.schema';
import { MediaService } from './services/media.service';

@Controller('media')
export class MediaController {
	constructor(private readonly mediaService: MediaService) {}

	@UseGuards(JwtAuthGuard)
	@Post('/')
	@HttpCode(HttpStatus.OK)
	@UseInterceptors(
		FileInterceptor('file', {
			storage: memoryStorage(),
			// Multer-level hard limit (fast fail before Zod, still validate in Zod too)
			limits: { fileSize: FILE_SIZE_LIMIT },
		}),
	)
	async uploadMedia(
		@UploadedFile(new ZodFileValidationPipe(singleFileSchema))
		file: Express.Multer.File,
		@CurrentUser() user: UserWithoutPassword,
	): Promise<ApiResponse<boolean>> {
		const response = await this.mediaService.uploadFile(user.id, file);

		return createApiResponse(HttpStatus.OK, 'Media uploaded successfully', response);
	}

	@UseGuards(JwtAuthGuard)
	@Get('/')
	async getAllMedia(
		@CurrentUser() user: UserWithoutPassword,
		@Query(new ZodValidationPipe(mediaListQuerySchema)) query: MediaListQueryDto,
	): Promise<ApiResponse<MediaResponseType[]>> {
		const { data, pagination } = await this.mediaService.getAllMedia(user.id, query);

		return createApiResponse(HttpStatus.OK, 'Media fetched successfully', data, pagination);
	}

	@UseGuards(JwtAuthGuard)
	@Put('/:id')
	async updateMedia(
		@CurrentUser() user: UserWithoutPassword,
		@Body(new ZodValidationPipe(mediaSchema)) body: MediaDto,
		@Param('id', ParseUUIDPipe) id: string,
	): Promise<ApiResponse<boolean>> {
		const response = await this.mediaService.updateMediaData(user.id, id, body);

		return createApiResponse(HttpStatus.OK, 'Media updated successfully', response);
	}

	@UseGuards(JwtAuthGuard)
	@Delete('/:id')
	async deleteMedia(
		@CurrentUser() user: UserWithoutPassword,
		@Param('id', ParseUUIDPipe) id: string,
	): Promise<ApiResponse<boolean>> {
		await this.mediaService.deleteMedia(user.id, id);

		return createApiResponse(HttpStatus.OK, 'Media deleted successfully', true);
	}
}
