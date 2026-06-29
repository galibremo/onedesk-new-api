import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EnvType } from '../../core/validators/env';
import { CloudinaryImageService } from '../media/services/cloudinary.service';

export const ORG_CLOUDINARY_SERVICE = Symbol('ORG_CLOUDINARY_SERVICE');

export const orgCloudinaryProvider: Provider = {
	provide: ORG_CLOUDINARY_SERVICE,
	inject: [ConfigService],
	useFactory: (configService: ConfigService<EnvType, true>) =>
		new CloudinaryImageService({
			cloudName: configService.get('CLOUDINARY_CLOUD_NAME') ?? '',
			apiKey: configService.get('CLOUDINARY_API_KEY') ?? '',
			apiSecret: configService.get('CLOUDINARY_API_SECRET') ?? '',
			folder: 'organization_logos',
		}),
};
