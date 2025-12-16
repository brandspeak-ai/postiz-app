import {
  IsDefined,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class OrgSettingsDto {
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class CreateHubOrganizationDto {
  @IsString()
  @IsDefined()
  @MinLength(1)
  @MaxLength(128)
  name: string;

  @IsString()
  @IsDefined()
  hubClientId: string;

  @IsEmail()
  @IsDefined()
  adminEmail: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrgSettingsDto)
  settings?: OrgSettingsDto;
}
