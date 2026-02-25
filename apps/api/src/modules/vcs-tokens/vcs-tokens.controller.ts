import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { VcsTokensService } from './vcs-tokens.service';
import { CreateVcsTokenDto } from './dto/create-vcs-token.dto';
import { UpdateVcsTokenDto } from './dto/update-vcs-token.dto';

@ApiTags('admin/vcs-tokens')
@ApiBearerAuth()
@Controller('admin/vcs-tokens')
@UseGuards(JwtAuthGuard, AdminGuard)
export class VcsTokensController {
  constructor(private readonly vcsTokensService: VcsTokensService) {}

  @Get()
  @ApiOperation({ summary: 'List VCS tokens (admin only)' })
  list() {
    return this.vcsTokensService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create VCS token (admin only)' })
  create(@Body() dto: CreateVcsTokenDto) {
    return this.vcsTokensService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update VCS token (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateVcsTokenDto) {
    return this.vcsTokensService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete VCS token (admin only)' })
  remove(@Param('id') id: string) {
    return this.vcsTokensService.remove(id);
  }
}
