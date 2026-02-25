import { Controller, Get, Query, UseGuards, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';
import { PortfolioQueryDto } from './dto/portfolio-query.dto';
import { PortfolioResponseDto } from './dto/portfolio-response.dto';
import { ApiOrJwtGuard } from '../auth/guards/api-or-jwt.guard';

@ApiTags('portfolio')
@ApiBearerAuth()
@Controller('portfolio')
@UseGuards(ApiOrJwtGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  @ApiOperation({
    summary: 'Récupérer le portfolio',
    description: 'Retourne une vue d\'ensemble de tous les projets avec leurs métriques et filtres',
  })
  async getPortfolio(@Query() query: PortfolioQueryDto): Promise<PortfolioResponseDto> {
    return this.portfolioService.getPortfolio(query);
  }

  @Get('export')
  @ApiOperation({
    summary: 'Exporter le portfolio en CSV',
    description: 'Exporte tous les projets du portfolio au format CSV',
  })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="portfolio.csv"')
  async exportToCSV(@Query() query: PortfolioQueryDto): Promise<string> {
    return this.portfolioService.exportToCSV(query);
  }
}
