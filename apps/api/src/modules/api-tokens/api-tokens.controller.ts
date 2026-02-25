import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTokensService } from './api-tokens.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { BulkDeleteApiTokensDto } from './dto/bulk-delete-api-tokens.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';

@ApiTags('api-tokens')
@ApiBearerAuth()
@Controller('tokens')
@UseGuards(JwtAuthGuard)
export class ApiTokensController {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un token API', description: 'Retourne le token en clair une seule fois.' })
  create(
    @Body() dto: CreateApiTokenDto,
    @CurrentUser() user: AuthPayload,
  ) {
    return this.apiTokensService.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les tokens API' })
  findAll() {
    return this.apiTokensService.findAll();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un token API' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthPayload,
  ) {
    return this.apiTokensService.remove(id, user.sub);
  }

  @Post('bulk-delete')
  @ApiOperation({ summary: 'Supprimer plusieurs tokens API' })
  removeMany(
    @Body() dto: BulkDeleteApiTokensDto,
    @CurrentUser() user: AuthPayload,
  ) {
    return this.apiTokensService.removeMany(dto.ids, user.sub);
  }
}
