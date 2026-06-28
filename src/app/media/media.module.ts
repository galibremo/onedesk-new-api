import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MEDIA_CLOUDINARY_SERVICE, mediaCloudinaryProvider } from './media.providers';
import { MediaRepository } from './media.repository';
import { MediaService } from './services/media.service';

@Module({
	controllers: [MediaController],
	providers: [MediaService, MediaRepository, mediaCloudinaryProvider],
	exports: [MEDIA_CLOUDINARY_SERVICE],
})
export class MediaModule {}
