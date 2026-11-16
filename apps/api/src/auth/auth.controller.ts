import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionGuard, CsrfGuard, type AuthRequest } from './guards';
import { LoginDto, PasswordDto, parseDto } from './dto';
import { createCsrf } from '../security';
@Controller('api/v1/auth')
export class AuthController {
  constructor(@Inject(AuthService) private auth: AuthService) {}
  private cookies(res: Response, token: string) {
    res.cookie('cup_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api',
      maxAge: 86400000,
    });
    res.cookie('cup_csrf', createCsrf(process.env.CSRF_SECRET!), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api',
      maxAge: 3600000,
    });
    res.setHeader('Cache-Control', 'no-store');
  }
  @Post('login')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const dto = parseDto(LoginDto, req.body);
    const result = await this.auth.login(
      dto.email,
      dto.password,
      req.cookies?.cup_session,
    );
    this.cookies(res, result.token);
    return { data: result.user };
  }
  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return { data: req.principal };
  }
  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard, CsrfGuard)
  async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies.cup_session, req.principal);
    res.clearCookie('cup_session', {
      path: '/api',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.setHeader('Cache-Control', 'no-store');
  }
  @Post('password')
  @HttpCode(200)
  @UseGuards(SessionGuard, CsrfGuard)
  async password(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const dto = parseDto(PasswordDto, req.body);
    const result = await this.auth.changePassword(
      req.principal,
      dto.currentPassword,
      dto.newPassword,
    );
    this.cookies(res, result.token);
    return { data: result.user };
  }
}
