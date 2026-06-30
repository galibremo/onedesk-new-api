import { Module } from '@nestjs/common';

import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { TeamController } from './team.controller';
import { TeamRepository } from './team.repository';
import { TeamService } from './team.service';

@Module({
	imports: [AuthModule, AuditLogModule],
	controllers: [TeamController],
	providers: [TeamService, TeamRepository],
	exports: [TeamService],
})
export class TeamModule {}
