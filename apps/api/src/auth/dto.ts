import { BadRequestException } from '@nestjs/common';
import {
  plainToInstance,
  type ClassConstructor,
  Transform,
} from 'class-transformer';
import {
  IsEmail,
  IsString,
  Length,
  MaxLength,
  validateSync,
} from 'class-validator';
export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
export function parseDto<T extends object>(
  type: ClassConstructor<T>,
  value: unknown,
): T {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Solicitud inválida.');
  const dto = plainToInstance(type, value);
  if (
    validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }).length
  )
    throw new BadRequestException('Comprueba los campos y sus límites.');
  return dto;
}
export class LoginDto {
  @IsEmail() @MaxLength(160) @Trim() email!: string;
  @IsString() @Length(1, 128) password!: string;
}
export class PasswordDto {
  @IsString() @Length(1, 128) currentPassword!: string;
  @IsString() @Length(12, 128) newPassword!: string;
}
