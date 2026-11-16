import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../auth/dto';
const IfPresent = () => ValidateIf((_object, value) => value !== undefined);
export class VersionDto {
  @IsInt() @Min(0) expectedVersion!: number;
}
export class SeasonCreateDto {
  @IsString() @Length(1, 120) @Trim() name!: string;
  @IsString() @Length(1, 80) timezone!: string;
}
export class SeasonEditDto extends VersionDto {
  @IfPresent() @IsString() @Length(1, 120) @Trim() name?: string;
  @IfPresent() @IsString() @Length(1, 80) timezone?: string;
}
export class TeamCreateDto {
  @IsString() @Length(1, 120) @Trim() name!: string;
}
export class TeamEditDto extends VersionDto {
  @IsString() @Length(1, 120) @Trim() name!: string;
}
export class EntryDto {
  @IsUUID('4') teamId!: string;
}
export class RulesDto extends VersionDto {
  @IsInt() @Min(10) @Max(180) duration!: number;
  @IsInt() @Min(0) @Max(20) winPoints!: number;
  @IsInt() @Min(0) @Max(20) drawPoints!: number;
  @IsInt() @Min(0) @Max(20) lossPoints!: number;
  @IsInt() @Min(2) @Max(32) groupCapacity!: number;
  @IsInt() @Min(1) @Max(16) qualifiers!: number;
  @IsBoolean() rulesConfirmed!: boolean;
}
export class UserCreateDto {
  @IsString() @Length(1, 120) @Trim() name!: string;
  @IsEmail() @MaxLength(160) @Trim() email!: string;
  @IsIn(['admin', 'scorer']) role!: 'admin' | 'scorer';
  @IsString() @Length(12, 128) password!: string;
}
export class UserEditDto extends VersionDto {
  @IfPresent() @IsString() @Length(1, 120) @Trim() name?: string;
  @IfPresent() @IsEmail() @MaxLength(160) @Trim() email?: string;
  @IfPresent() @IsIn(['admin', 'scorer']) role?: 'admin' | 'scorer';
  @IfPresent() @IsBoolean() active?: boolean;
}
export class ResetPasswordDto extends VersionDto {
  @IsString() @Length(12, 128) password!: string;
}
