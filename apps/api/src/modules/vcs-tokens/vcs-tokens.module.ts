import { Module } from '@nestjs/common';
import { VcsTokensController } from './vcs-tokens.controller';
import { UserVcsTokensController } from './user-vcs-tokens.controller';
import { VcsTokensService } from './vcs-tokens.service';

@Module({
  controllers: [VcsTokensController, UserVcsTokensController],
  providers: [VcsTokensService],
})
export class VcsTokensModule {}
