import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PullRequestProvider } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { VcsTokensService } from './vcs-tokens.service';
import { CreateVcsTokenDto } from './dto/create-vcs-token.dto';

@ApiTags('vcs-tokens')
@ApiBearerAuth()
@Controller('vcs-tokens')
@UseGuards(JwtAuthGuard)
export class UserVcsTokensController {
  constructor(private readonly vcsTokensService: VcsTokensService) {}

  @Get()
  @ApiOperation({ summary: 'List VCS tokens for current user' })
  list(@CurrentUser() user: AuthPayload) {
    return this.vcsTokensService.listForUser(user.sub);
  }

  @Put()
  @ApiOperation({ summary: 'Create or update a VCS token for current user' })
  upsert(@CurrentUser() user: AuthPayload, @Body() dto: CreateVcsTokenDto) {
    return this.vcsTokensService.upsertForUser(user.sub, dto);
  }

  @Delete(':provider')
  @ApiOperation({ summary: 'Delete a VCS token for current user' })
  remove(@CurrentUser() user: AuthPayload, @Param('provider') provider: PullRequestProvider) {
    return this.vcsTokensService.removeForUser(user.sub, provider);
  }
}
