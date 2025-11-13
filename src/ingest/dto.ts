import { Prisma } from '@prisma/client';
import { IsISO8601, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CollectEventDto {
  @IsString() event!: string;

  @IsOptional() @IsString() @MaxLength(2048)
  url?: string;

  @IsOptional() @IsString() @MaxLength(2048)
  referrer?: string;

  @IsOptional() @IsString()
  device?: 'mobile' | 'desktop' | 'tablet';

  @IsOptional() @IsString()
  ipAddress?: string;

  @IsOptional() @IsISO8601()
  timestamp?: string;

  @IsOptional() @IsObject()
  metadata?: Prisma.InputJsonValue;

  @IsOptional() @IsString()
  userId?: string; // allow callers to send anon/known id
}
