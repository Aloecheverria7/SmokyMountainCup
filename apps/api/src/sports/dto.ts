import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../auth/dto';
import { VersionDto } from '../admin/dto';
const Present = () => ValidateIf((_o, v) => v !== undefined);
export class PlayerDto {
  @IsString() @Length(1, 120) @Trim() name!: string;
  @Present()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @Length(10, 10)
  birthDate?: string | null;
  @Present()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @Length(0, 160)
  contact?: string | null;
}
export class PlayerEditDto extends PlayerDto {
  @IsInt() @Min(0) expectedVersion!: number;
}
export class RosterDto {
  @IsUUID('4') playerId!: string;
  @IsInt() @Min(0) @Max(999) number!: number;
}
export class RosterEditDto extends VersionDto {
  @IsInt() @Min(0) @Max(999) number!: number;
}
export class VenueDto {
  @IsString() @Length(1, 120) @Trim() name!: string;
  @Present() @IsString() @Length(0, 255) address?: string;
}
export class VenueEditDto extends VenueDto {
  @IsInt() @Min(0) expectedVersion!: number;
}
export class FieldDto {
  @IsString() @Length(1, 120) @Trim() name!: string;
  @IsUUID('4') venueId!: string;
}
export class FieldEditDto extends VersionDto {
  @IsString() @Length(1, 120) @Trim() name!: string;
}
export class PreviewDto {
  @IsIn(['random', 'manual']) mode!: 'random' | 'manual';
  @Present()
  @IsArray()
  @ArrayMaxSize(512)
  @IsUUID('4', { each: true })
  entryIds?: string[];
}
export class DrawDto {
  @IsUUID('4') previewId!: string;
}
export class ReasonDto extends VersionDto {
  @IsString() @Length(1, 255) @Trim() reason!: string;
}
export class ImportedPublicationDto extends ReasonDto {
  @IsBoolean() published!: boolean;
}
export class RoundsDto extends ReasonDto {
  @IsInt() @Min(1) @Max(10) fromRound!: number;
}
export class QualifyDto extends VersionDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(512)
  @IsUUID('4', { each: true })
  entryIds!: string[];
  @Present() @IsString() @Length(1, 255) @Trim() tieReason?: string;
}
export class ScheduleDto extends VersionDto {
  @ValidateIf((_o, v) => v !== null) @IsUUID('4') fieldId!: string | null;
  @ValidateIf((_o, v) => v !== null) @IsString() @Length(20, 40) scheduledAt!:
    string | null;
}
export class AssignDto extends VersionDto {
  @ValidateIf((_o, v) => v !== null) @IsUUID('4') scorerId!: string | null;
}
export class StatusDto extends VersionDto {
  @IsIn(['scheduled', 'live', 'half_time', 'paused', 'finished', 'suspended'])
  status!: string;
}
export class GoalDto extends VersionDto {
  @IsUUID('4') entryId!: string;
  @ValidateIf((_o, v) => v !== null && v !== undefined) @IsUUID('4') rosterId?:
    string | null;
  @IsIn(['goal', 'own_goal']) kind!: 'goal' | 'own_goal';
  @IsInt() @Min(0) @Max(300) minute!: number;
}
export class ConfirmDto extends VersionDto {
  @Present() @IsInt() @Min(0) @Max(100) homePenalties?: number;
  @Present() @IsInt() @Min(0) @Max(100) awayPenalties?: number;
}
