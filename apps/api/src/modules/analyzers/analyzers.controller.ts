import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyzersService } from './analyzers.service';
import { CreateAnalyzerDto } from './dto/create-analyzer.dto';
import { UpdateProjectAnalyzerDto } from './dto/update-project-analyzer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ProjectMembershipGuard } from '../authorization';

@ApiTags('analyzers')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class AnalyzersController {
  constructor(private readonly analyzersService: AnalyzersService) {}

  @Get('analyzers')
  list() {
    return this.analyzersService.listAllEnabled();
  }

  @UseGuards(AdminGuard)
  @Post('analyzers')
  create(@Body() dto: CreateAnalyzerDto) {
    return this.analyzersService.create(dto);
  }

  @UseGuards(ProjectMembershipGuard)
  @Get('projects/:key/analyzers')
  listForProject(@Param('key') key: string) {
    return this.analyzersService.listForProject(key);
  }

  @UseGuards(ProjectMembershipGuard)
  @Put('projects/:key/analyzers/:analyzerKey')
  updateProjectAnalyzer(
    @Param('key') key: string,
    @Param('analyzerKey') analyzerKey: string,
    @Body() dto: UpdateProjectAnalyzerDto,
  ) {
    return this.analyzersService.upsertProjectAnalyzer(key, analyzerKey, dto);
  }
}
