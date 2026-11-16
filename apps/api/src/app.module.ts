import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Module,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import nodemailer from 'nodemailer';
import { createCsrf, validCsrf } from './security';
import { DatabaseService } from './database/database.service';
import { LegacyService } from './legacy.service';
import { SportsModule } from './sports/controllers';
import { PublicSportsService } from './sports/public.service';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.controller';
class Inquiry {
  @IsIn(['contact', 'registration', 'vendor']) kind!: string;
  @IsEmail() @MaxLength(160) email!: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) team_name?: string;
  @IsOptional() @IsString() @MaxLength(120) owner?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(6000) message?: string;
  @IsOptional() @IsString() @MaxLength(6000) players_to_enroll?: string;
  @IsOptional() @IsString() @MaxLength(6000) product?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsString() @MaxLength(200) csrf?: string;
}
@Controller('api/v1')
class PublicController {
  constructor(
    @Inject(LegacyService) private readonly legacy: LegacyService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(PublicSportsService) private readonly sports: PublicSportsService,
  ) {}
  @Get('health/live') health() {
    return { status: 'ok', stage: 'foundation' };
  }
  @Get('health/ready') async ready() {
    try {
      const rows = await this.db.query('SELECT name FROM smc_migrations');
      if (
        ![
          'Foundation1794225600000',
          'Sports1794225700000',
          'Imports1794225800000',
        ].every((name) => rows.some((r: any) => r.name === name))
      )
        throw Error();
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException(
        'El sistema todavía no está preparado.',
      );
    }
  }
  @Get('public/live') async live(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return process.env.PUBLIC_DATA_SOURCE === 'system'
      ? this.sports.feed()
      : this.legacy.feed();
  }
  @Get('auth/csrf') csrf(@Res({ passthrough: true }) res: Response) {
    const token = createCsrf(process.env.CSRF_SECRET!);
    res.setHeader('Cache-Control', 'no-store');
    res.cookie('cup_csrf', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api',
      maxAge: 3600000,
    });
    return { token };
  }
  @Post('public/inquiries')
  @HttpCode(200)
  async inquiry(@Req() req: Request) {
    if (
      req.get('origin') !== process.env.APP_ORIGIN ||
      !validCsrf(
        process.env.CSRF_SECRET!,
        req.get('x-csrf-token'),
        req.cookies?.cup_csrf,
      )
    )
      throw new ForbiddenException(
        'Your session expired. Reload the form and try again.',
      );
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
      throw new BadRequestException('Invalid submission.');
    const dto = plainToInstance(Inquiry, req.body);
    if (
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })
        .length ||
      dto.website
    )
      throw new BadRequestException('Invalid submission.');
    const fields =
      dto.kind === 'registration'
        ? ['team_name', 'owner', 'email', 'phone', 'players_to_enroll']
        : dto.kind === 'vendor'
          ? ['name', 'email', 'phone']
          : ['name', 'email', 'message'];
    for (const key of fields) {
      const v = (dto as unknown as Record<string, unknown>)[key];
      if (typeof v !== 'string' || !v.trim())
        throw new BadRequestException('Please complete all required fields.');
    }
    if (!process.env.SMTP_HOST || !process.env.MAIL_FROM)
      throw new ServiceUnavailableException(
        'Your message could not be sent. Please contact smokymountaincup@yahoo.com or try again later.',
      );
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === '465',
      requireTLS: true,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
    try {
      const result = await transport.sendMail({
        from: process.env.MAIL_FROM,
        to: process.env.MAIL_TO || 'smokymountaincup@yahoo.com',
        replyTo: dto.email,
        subject: `Smoky Mountain Cup: ${dto.kind}`,
        text:
          `Smoky Mountain Cup — ${dto.kind}\n\n` +
          (dto.kind === 'vendor' ? [...fields, 'product'] : fields)
            .map(
              (k) =>
                `${k}:\n${(dto as unknown as Record<string, string>)[k] ?? ''}\n`,
            )
            .join('\n'),
      });
      if (!result.accepted.length) throw Error();
      return { ok: true };
    } catch {
      throw new ServiceUnavailableException(
        'Your message could not be sent. Please contact smokymountaincup@yahoo.com or try again later.',
      );
    } finally {
      transport.close();
    }
  }
}
@Module({
  imports: [AuthModule, AdminModule, SportsModule],
  controllers: [PublicController],
  providers: [LegacyService],
})
export class AppModule {}
