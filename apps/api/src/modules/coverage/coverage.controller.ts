import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoverageService } from './coverage.service';
import { ApiOrJwtGuard } from '../auth/guards/api-or-jwt.guard';
import { ProjectsService } from '../projects/projects.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('coverage')
@ApiBearerAuth()
@Controller()
@UseGuards(ApiOrJwtGuard)
export class CoverageController {
  constructor(
    private readonly coverageService: CoverageService,
    private readonly projectsService: ProjectsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('analyses/:id/coverage')
  @ApiOperation({
    summary: 'Get coverage report for an analysis',
    description: 'Returns coverage summary and file-level coverage details',
  })
  async getCoverage(@Param('id') id: string) {
    return this.coverageService.getCoverageForAnalysis(id);
  }

  @Get('analyses/:id/coverage/file')
  @ApiOperation({
    summary: 'Get line-by-line coverage for a specific file',
    description: 'Returns detailed line coverage with hit counts',
  })
  async getFileCoverage(@Param('id') id: string, @Query('path') filePath: string) {
    return this.coverageService.getFileCoverage(id, filePath);
  }

  @Get('projects/:key/coverage/trend')
  @ApiOperation({
    summary: 'Get coverage trend over time',
    description: 'Returns coverage percentage for recent analyses',
  })
  async getCoverageTrend(
    @Param('key') key: string,
    @Query('branch') branch?: string,
    @Query('limit') limitStr?: string,
  ) {
    const project = await this.projectsService.getByKeyOrThrow(key);
    const limit = limitStr ? parseInt(limitStr, 10) : 20;

    let branchId: string | undefined;
    if (branch) {
      const branchRecord = await this.prisma.branch.findFirst({
        where: { projectId: project.id, name: branch },
        select: { id: true },
      });
      branchId = branchRecord?.id;
    }

    return this.coverageService.getCoverageTrend(project.id, branchId, limit);
  }
}
