import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class BulkDeleteApiTokensDto {
  @ApiProperty({ type: [String], example: ['token-id-1', 'token-id-2'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];
}
