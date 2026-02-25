import { ApiProperty } from '@nestjs/swagger';

export class IssueCodeResponseDto {
  @ApiProperty()
  issueId!: string;

  @ApiProperty()
  analysisId!: string;

  @ApiProperty()
  filePath!: string;

  @ApiProperty({ required: false, nullable: true })
  line!: number | null;

  @ApiProperty({ required: false, nullable: true })
  startLine!: number | null;

  @ApiProperty({ required: false, nullable: true })
  endLine!: number | null;

  @ApiProperty({ required: false, nullable: true })
  language!: string | null;

  @ApiProperty()
  snippet!: string;

  @ApiProperty()
  fileExists!: boolean;
}
