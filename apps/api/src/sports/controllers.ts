import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  SessionGuard,
  AdminGuard,
  CsrfGuard,
  type AuthRequest,
} from '../auth/guards';
import { parseDto } from '../auth/dto';
import { VersionDto } from '../admin/dto';
import { SportsStore } from './store';
import { CatalogService } from './catalog.service';
import { CompetitionService } from './competition.service';
import { MatchService } from './match.service';
import { PublicSportsService } from './public.service';
import { standingRows } from './queries';
import { standings } from './rules';
import * as D from './dto';
const uuid = new ParseUUIDPipe({ version: '4' });
@Injectable()
class ReadyGuard implements CanActivate {
  canActivate(c: ExecutionContext) {
    if (c.switchToHttp().getRequest<AuthRequest>().principal.mustChangePassword)
      throw new ForbiddenException('Cambia tu contraseña antes de continuar.');
    return true;
  }
}
@Controller('api/v1')
@UseGuards(SessionGuard, AdminGuard, CsrfGuard)
class CatalogController {
  constructor(@Inject(CatalogService) private service: CatalogService) {}
  @Get('players') players(@Req() r: AuthRequest) {
    return this.service.list('players', r.query);
  }
  @Post('players') player(@Req() r: AuthRequest) {
    return this.service.player(r.principal, parseDto(D.PlayerDto, r.body));
  }
  @Patch('players/:id') editPlayer(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.player(
      r.principal,
      parseDto(D.PlayerEditDto, r.body),
      id,
    );
  }
  @Post('players/:id/archive') archivePlayer(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.archive(
      r.principal,
      'players',
      id,
      parseDto(VersionDto, r.body).expectedVersion,
    );
  }
  @Get('entries/:id/roster') roster(@Param('id', uuid) id: string) {
    return this.service.roster(id);
  }
  @Post('entries/:id/roster') addRoster(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.saveRoster(
      r.principal,
      parseDto(D.RosterDto, r.body),
      id,
    );
  }
  @Patch('rosters/:id') editRoster(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.saveRoster(
      r.principal,
      parseDto(D.RosterEditDto, r.body),
      undefined,
      id,
    );
  }
  @Get('venues') venues(@Req() r: AuthRequest) {
    return this.service.list('venues', r.query);
  }
  @Post('venues') venue(@Req() r: AuthRequest) {
    return this.service.venue(r.principal, parseDto(D.VenueDto, r.body));
  }
  @Patch('venues/:id') editVenue(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.venue(
      r.principal,
      parseDto(D.VenueEditDto, r.body),
      id,
    );
  }
  @Post('venues/:id/archive') archiveVenue(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.archive(
      r.principal,
      'venues',
      id,
      parseDto(VersionDto, r.body).expectedVersion,
    );
  }
  @Get('fields') fields(@Req() r: AuthRequest) {
    return this.service.list('fields', r.query);
  }
  @Post('fields') field(@Req() r: AuthRequest) {
    return this.service.field(r.principal, parseDto(D.FieldDto, r.body));
  }
  @Patch('fields/:id') editField(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.field(
      r.principal,
      parseDto(D.FieldEditDto, r.body),
      id,
    );
  }
  @Post('fields/:id/archive') archiveField(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.archive(
      r.principal,
      'fields',
      id,
      parseDto(VersionDto, r.body).expectedVersion,
    );
  }
}
@Controller('api/v1/competitions')
@UseGuards(SessionGuard, AdminGuard, CsrfGuard)
class OrganizationController {
  constructor(
    @Inject(CompetitionService) private service: CompetitionService,
    @Inject(SportsStore) private store: SportsStore,
  ) {}
  @Get(':id/sport-state') state(@Param('id', uuid) id: string) {
    return this.store.db.transaction(async (tx) => {
      const c = await this.store.competition(tx, id);
      const matches = await tx.query(
        'SELECT * FROM smc_matches WHERE competition_id=?',
        [id],
      );
      return {
        data: {
          id: c.id,
          version: c.version,
          published: !!c.published,
          archived: !!c.archived,
          rulesConfirmed: !!c.rules_confirmed,
          qualifiers: c.qualifiers,
          imported: !!c.import_batch_id,
        },
        standings: standings(await standingRows(tx, id), matches, c),
        provisional: standings(await standingRows(tx, id), matches, c, true),
      };
    });
  }
  @Post(':id/imported-publication') @HttpCode(200) importedPublication(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.importedPublication(
      r.principal,
      id,
      r.get('idempotency-key'),
      parseDto(D.ImportedPublicationDto, r.body),
    );
  }
  @Post(':id/draw-previews') preview(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.preview(
      r.principal,
      id,
      parseDto(D.PreviewDto, r.body),
    );
  }
  @Post(':id/draw') @HttpCode(200) publish(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.publish(
      r.principal,
      id,
      r.get('idempotency-key'),
      parseDto(D.DrawDto, r.body),
    );
  }
  @Post(':id/reset-draw') @HttpCode(200) reset(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.reset(
      r.principal,
      id,
      r.get('idempotency-key'),
      parseDto(D.ReasonDto, r.body),
    );
  }
  @Post(':id/qualify') @HttpCode(200) qualify(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.qualify(
      r.principal,
      id,
      r.get('idempotency-key'),
      parseDto(D.QualifyDto, r.body),
    );
  }
  @Post(':id/remove-rounds') @HttpCode(200) remove(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.removeRounds(
      r.principal,
      id,
      r.get('idempotency-key'),
      parseDto(D.RoundsDto, r.body),
    );
  }
  @Post(':id/rebuild-rounds') @HttpCode(200) rebuild(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.rebuild(
      r.principal,
      id,
      r.get('idempotency-key'),
      parseDto(D.ReasonDto, r.body),
    );
  }
}
@Controller('api/v1/matches')
@UseGuards(SessionGuard, ReadyGuard, CsrfGuard)
class MatchesController {
  constructor(@Inject(MatchService) private service: MatchService) {}
  @Get() list(@Req() r: AuthRequest) {
    return this.service.list(r.principal, r.query);
  }
  @Get(':id') detail(@Req() r: AuthRequest, @Param('id', uuid) id: string) {
    return this.service.detail(r.principal, id);
  }
  @Patch(':id/schedule') schedule(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.schedule(
      r.principal,
      id,
      r.get('idempotency-key'),
      parseDto(D.ScheduleDto, r.body),
    );
  }
  @Post(':id/assignment') @HttpCode(200) assign(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.assign(
      r.principal,
      id,
      r.get('idempotency-key'),
      parseDto(D.AssignDto, r.body),
    );
  }
  @Post(':id/status') @HttpCode(200) status(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.status(
      r.principal,
      id,
      r.get('idempotency-key'),
      parseDto(D.StatusDto, r.body),
    );
  }
  @Post(':id/events') @HttpCode(200) goal(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.goal(
      r.principal,
      id,
      r.get('idempotency-key'),
      parseDto(D.GoalDto, r.body),
    );
  }
  @Post(':id/events/:eventId/void') @HttpCode(200) void(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
    @Param('eventId', uuid) eventId: string,
  ) {
    return this.service.voidEvent(
      r.principal,
      id,
      eventId,
      r.get('idempotency-key'),
      parseDto(D.ReasonDto, r.body),
    );
  }
  @Post(':id/confirm') @HttpCode(200) confirm(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.confirm(
      r.principal,
      id,
      r.get('idempotency-key'),
      parseDto(D.ConfirmDto, r.body),
    );
  }
  @Post(':id/reopen') @HttpCode(200) reopen(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.reopen(
      r.principal,
      id,
      r.get('idempotency-key'),
      parseDto(D.ReasonDto, r.body),
    );
  }
}
@Controller('api/v1/public')
class PublicTournamentController {
  constructor(
    @Inject(PublicSportsService) private service: PublicSportsService,
  ) {}
  @Get('site') site() {
    return this.service.site();
  }
  @Get('seasons') seasons() {
    return this.service.seasons();
  }
  @Get('seasons/:id/competitions') competitions(@Param('id', uuid) id: string) {
    return this.service.competitions(id);
  }
  @Get('competitions/:id/matches') matches(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.matches(id, r.query);
  }
  @Get('competitions/:id/standings') table(
    @Req() r: AuthRequest,
    @Param('id', uuid) id: string,
  ) {
    return this.service.table(id, r.query.mode === 'provisional');
  }
  @Get('competitions/:id/bracket') bracket(@Param('id', uuid) id: string) {
    return this.service.bracket(id);
  }
  @Get('competitions/:id/scorers') scorers(@Param('id', uuid) id: string) {
    return this.service.scorers(id);
  }
  @Get('matches/:id') match(@Param('id', uuid) id: string) {
    return this.service.detail(id);
  }
}
@Module({
  imports: [AuthModule],
  controllers: [
    CatalogController,
    OrganizationController,
    MatchesController,
    PublicTournamentController,
  ],
  providers: [
    SportsStore,
    CatalogService,
    CompetitionService,
    MatchService,
    PublicSportsService,
    ReadyGuard,
  ],
  exports: [PublicSportsService],
})
export class SportsModule {}
