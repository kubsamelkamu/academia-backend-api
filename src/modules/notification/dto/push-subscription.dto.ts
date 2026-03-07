import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PushSubscriptionKeysDto {
  @ApiProperty({ description: 'Base64-encoded p256dh key' })
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @ApiProperty({ description: 'Base64-encoded auth secret' })
  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class PushSubscribeRequestDto {
  @ApiProperty({ description: 'Push service endpoint URL' })
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiProperty({ required: false, nullable: true, description: 'Expiration time (ms since epoch)' })
  @IsOptional()
  @IsNumber()
  expirationTime?: number | null;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}

export class PushSubscribeResponseDto {
  @ApiProperty()
  success: boolean;
}

export class PushUnsubscribeRequestDto {
  @ApiProperty({ required: false, description: 'If provided, deletes a single subscription by endpoint' })
  @IsOptional()
  @IsString()
  endpoint?: string;
}

export class PushUnsubscribeResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ description: 'Number of subscriptions removed' })
  removed: number;
}

export class VapidPublicKeyResponseDto {
  @ApiProperty({ nullable: true })
  publicKey: string | null;
}
