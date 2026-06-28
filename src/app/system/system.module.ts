import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { SystemController } from './system.controller';
import { SystemRepository } from './system.repository';
import { SystemService } from './system.service';

@Module({
	imports: [DatabaseModule],
	controllers: [SystemController],
	providers: [SystemRepository, SystemService],
	exports: [SystemService],
})
export class SystemModule {}
