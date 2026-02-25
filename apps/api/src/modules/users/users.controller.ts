import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { UserDTO } from '@qubeless/shared';
import { NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthPayload): Promise<UserDTO> {
    const found = await this.usersService.findById(user.sub);
    const dto = this.usersService.toUserDTO(found);
    if (!dto) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return dto;
  }
}
