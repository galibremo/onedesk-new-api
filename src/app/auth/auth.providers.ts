import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EnvType } from '../../core/validators/env';
import { CloudinaryImageService } from '../media/services/cloudinary.service';

export const AUTH_CLOUDINARY_SERVICE = Symbol('AUTH_CLOUDINARY_SERVICE');

export const authCloudinaryProvider: Provider = {
	provide: AUTH_CLOUDINARY_SERVICE,
	inject: [ConfigService],
	useFactory: (configService: ConfigService<EnvType, true>) =>
		new CloudinaryImageService({
			cloudName: configService.get('CLOUDINARY_CLOUD_NAME'),
			apiKey: configService.get('CLOUDINARY_API_KEY'),
			apiSecret: configService.get('CLOUDINARY_API_SECRET'),
			folder: 'user_profiles',
		}),
};
