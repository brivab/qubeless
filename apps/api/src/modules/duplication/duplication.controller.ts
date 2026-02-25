import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DuplicationService } from './duplication.service';
import { ApiOrJwtGuard } from '../auth/guards/api-or-jwt.guard';

@ApiTags('duplication')
@ApiBearerAuth()
@Controller()
@UseGuards(ApiOrJwtGuard)
export class DuplicationController {
  constructor(private readonly duplicationService: DuplicationService) {}

  @Get('analyses/:id/duplication')
  @ApiOperation({
    summary: 'Get duplication statistics for an analysis',
    description: 'Returns duplication percentage and summary statistics',
  })
  async getDuplication(@Param('id') id: string) {
    return this.duplicationService.getDuplicationForAnalysis(id);
  }

  @Get('analyses/:id/duplication/blocks')
  @ApiOperation({
    summary: 'Get detailed duplication blocks',
    description: 'Returns all duplicate code blocks with file locations and line numbers',
  })
  async getDuplicationBlocks(@Param('id') id: string) {
    return this.duplicationService.getDuplicationBlocks(id);
  }
}
