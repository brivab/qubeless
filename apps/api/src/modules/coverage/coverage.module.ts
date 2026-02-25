import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { AuthModule } from '../auth/auth.module';
import { CoverageService } from './coverage.service';
import { CoverageController } from './coverage.controller';
import { LcovParserService } from './parsers/lcov-parser.service';
import { CoberturaParserService } from './parsers/cobertura-parser.service';
import { JacocoParserService } from './parsers/jacoco-parser.service';
import { ParserFactoryService } from './parsers/parser-factory.service';

@Module({
  imports: [PrismaModule, ProjectsModule, AuthModule],
  providers: [
    CoverageService,
    LcovParserService,
    CoberturaParserService,
    JacocoParserService,
    ParserFactoryService,
  ],
  controllers: [CoverageController],
  exports: [CoverageService],
})
export class CoverageModule {}
