import { IsOptional, IsString, IsISO8601, IsNotEmpty } from 'class-validator';

export class RegisterAppDto {
    @IsString() @IsNotEmpty()
    name!: string;
}

export class GetApiKeyQuery {
  @IsString() @IsOptional()
  appId?: string;
}

export class RevokeDto {
  @IsString() @IsNotEmpty()
  apiKeyId!: string;
}

export class RegenerateDto {
  @IsString() @IsNotEmpty()
  apiKeyId!: string;

  // optional: carry over/override expiry
  @IsOptional() @IsISO8601()
  expiresAt?: string;
}

export class CreateKeyDto {
  @IsString() @IsNotEmpty()
  appId!: string;

  @IsOptional() @IsISO8601()
  expiresAt?: string; // ISO date string or undefined
}