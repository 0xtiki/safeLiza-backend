import { IsHexadecimal, IsObject, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class PublicKeyDto {
  @IsString()
  prefix!: string;

  @Transform(({ value }) => BigInt(value))
  @IsString()
  x!: string;

  @Transform(({ value }) => BigInt(value))
  @IsString()
  y!: string;
}

export class PasskeyMetadataDto {
  @IsString()
  id!: string;

  @IsObject()
  publicKey!: PublicKeyDto;
}

export class PasskeyVerifyDto {
  @IsObject()
  metadata!: PasskeyMetadataDto;

  @IsString()
  @IsHexadecimal()
  signature!: string;

  @IsString()
  @IsHexadecimal()
  challenge!: string;
}

export class SiweVerifyDto {
  @IsString()
  @IsHexadecimal()
  address!: string;

  @IsString()
  message!: string;

  @IsString()
  @IsHexadecimal()
  signature!: string;
}
