import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { validCsrf } from '../security';
import { AuthService, type Principal } from './auth.service';
export type AuthRequest = Request & { principal: Principal };
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    req.principal = await this.auth.resolve(req.cookies?.cup_session);
    return true;
  }
}
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (req.principal.role !== 'admin')
      throw new ForbiddenException('Acceso reservado al administrador.');
    if (req.principal.mustChangePassword)
      throw new ForbiddenException('Cambia tu contraseña antes de continuar.');
    return true;
  }
}
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    if (
      req.get('origin') !== process.env.APP_ORIGIN ||
      !validCsrf(
        process.env.CSRF_SECRET!,
        req.get('x-csrf-token'),
        req.cookies?.cup_csrf,
      )
    )
      throw new ForbiddenException(
        'La sesión cambió. Recarga y vuelve a intentarlo.',
      );
    return true;
  }
}
