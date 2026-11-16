import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthModule } from '../auth/auth.module';
import {
  SessionGuard,
  AdminGuard,
  CsrfGuard,
  type AuthRequest,
} from '../auth/guards';
import { parseDto } from '../auth/dto';
import { AdminService } from './admin.service';
import {
  EntryDto,
  ResetPasswordDto,
  RulesDto,
  SeasonCreateDto,
  SeasonEditDto,
  TeamCreateDto,
  TeamEditDto,
  UserCreateDto,
  UserEditDto,
  VersionDto,
} from './dto';
import { Module } from '@nestjs/common';
const uuid = new ParseUUIDPipe({ version: '4' });
@Controller('api/v1')
@UseGuards(SessionGuard, AdminGuard, CsrfGuard)
export class AdminController {
  constructor(@Inject(AdminService) private service: AdminService) {}
  @Get('seasons') seasons(@Req() r: AuthRequest) {
    return this.service.seasons(r.query);
  }
  @Post('seasons') createSeason(@Req() r: AuthRequest) {
    return this.service.createSeason(
      r.principal,
      parseDto(SeasonCreateDto, r.body),
    );
  }
  @Patch('seasons/:id') editSeason(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.editSeason(
      r.principal,
      id,
      parseDto(SeasonEditDto, r.body),
    );
  }
  @Post('seasons/:id/activate') activate(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.activateSeason(
      r.principal,
      id,
      parseDto(VersionDto, r.body).expectedVersion,
    );
  }
  @Post('seasons/:id/archive') archiveSeason(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.archiveSeason(
      r.principal,
      id,
      parseDto(VersionDto, r.body).expectedVersion,
    );
  }
  @Get('seasons/:id/competitions') competitions(@Param('id', uuid) id: string) {
    return this.service.competitions(id);
  }
  @Patch('competitions/:id') rules(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.rules(r.principal, id, parseDto(RulesDto, r.body));
  }
  @Get('teams') teams(@Req() r: AuthRequest) {
    return this.service.teams(r.query);
  }
  @Post('teams') createTeam(@Req() r: AuthRequest) {
    return this.service.createTeam(
      r.principal,
      parseDto(TeamCreateDto, r.body).name,
    );
  }
  @Patch('teams/:id') editTeam(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    const d = parseDto(TeamEditDto, r.body);
    return this.service.editTeam(r.principal, id, d.name, d.expectedVersion);
  }
  @Post('teams/:id/archive') archiveTeam(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.archiveTeam(
      r.principal,
      id,
      parseDto(VersionDto, r.body).expectedVersion,
    );
  }
  @Get('competitions/:id/entries') entries(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.entries(id, r.query);
  }
  @Post('competitions/:id/entries') createEntry(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.createEntry(
      r.principal,
      id,
      parseDto(EntryDto, r.body).teamId,
    );
  }
  @Get('users') users(@Req() r: AuthRequest) {
    return this.service.users(r.query);
  }
  @Post('users') createUser(@Req() r: AuthRequest) {
    return this.service.createUser(
      r.principal,
      parseDto(UserCreateDto, r.body),
    );
  }
  @Patch('users/:id') editUser(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.editUser(
      r.principal,
      id,
      parseDto(UserEditDto, r.body),
    );
  }
  @Post('users/:id/reset-password') resetPassword(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    const d = parseDto(ResetPasswordDto, r.body);
    return this.service.resetPassword(
      r.principal,
      id,
      d.password,
      d.expectedVersion,
    );
  }
  @Get('audit') audit(@Req() r: AuthRequest) {
    return this.service.auditLog(r.query);
  }
}
@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
