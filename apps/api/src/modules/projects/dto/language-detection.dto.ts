import { ApiProperty } from '@nestjs/swagger';

export class LanguageDetectionDto {
  @ApiProperty({ description: 'Nom du langage détecté', example: 'JavaScript/TypeScript' })
  language!: string;

  @ApiProperty({ description: 'Confiance de la détection (en %)', example: 75.5 })
  confidence!: number;

  @ApiProperty({ description: 'Nombre de fichiers détectés', example: 42 })
  fileCount!: number;

  @ApiProperty({
    description: 'Analyseurs suggérés pour ce langage',
    example: ['eslint', 'semgrep'],
    type: [String],
  })
  suggestedAnalyzers!: string[];

  @ApiProperty({
    description: 'Frameworks détectés (optionnel)',
    example: ['React', 'Node.js'],
    type: [String],
    required: false,
  })
  frameworks?: string[];
}

export class DetectLanguagesResponseDto {
  @ApiProperty({
    description: 'Langages détectés dans le projet',
    type: [LanguageDetectionDto],
  })
  languages!: LanguageDetectionDto[];

  @ApiProperty({ description: 'Nombre total de fichiers scannés', example: 156 })
  totalFiles!: number;

  @ApiProperty({ description: 'Chemin du projet scanné', example: '/tmp/qubeless/projects/my-project' })
  projectPath!: string;
}
