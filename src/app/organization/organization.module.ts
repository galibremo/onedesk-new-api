import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationController } from './organization.controller';
import { OrgRolesGuard } from './guards/org-roles.guard';
import { OrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';
import { orgCloudinaryProvider, ORG_CLOUDINARY_SERVICE } from './organization.providers';

@Module({
	imports: [AuthModule],
	controllers: [OrganizationController],
	providers: [
		OrganizationService,
		OrganizationRepository,
		OrgRolesGuard,
		orgCloudinaryProvider,
	],
	exports: [OrganizationService, OrganizationRepository, ORG_CLOUDINARY_SERVICE],
})
export class OrganizationModule {}
