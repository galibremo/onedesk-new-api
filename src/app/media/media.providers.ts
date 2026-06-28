import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EnvType } from '../../core/validators/env';
import { CloudinaryImageService } from './services/cloudinary.service';

export const MEDIA_CLOUDINARY_SERVICE = Symbol('MEDIA_CLOUDINARY_SERVICE');

export const mediaCloudinaryProvider: Provider = {
	provide: MEDIA_CLOUDINARY_SERVICE,
	inject: [ConfigService],
	useFactory: (configService: ConfigService<EnvType, true>) =>
		new CloudinaryImageService({
			cloudName: configService.get('CLOUDINARY_CLOUD_NAME'),
			apiKey: configService.get('CLOUDINARY_API_KEY'),
			apiSecret: configService.get('CLOUDINARY_API_SECRET'),
			folder: 'test-media-upload',
		}),
};
