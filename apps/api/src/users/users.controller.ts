import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { SetUserStatusDto } from './dto/set-user-status.dto.js';
import { ReplaceRolesDto } from './dto/replace-roles.dto.js';

@Controller('users')
@RequirePermissions('user:manage')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthContext) {
    return this.usersService.create(dto, actor);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetUserStatusDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.usersService.setActiveStatus(id, dto.isActive, actor);
  }

  @Put(':id/roles')
  replaceRoles(
    @Param('id') id: string,
    @Body() dto: ReplaceRolesDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.usersService.replaceRoles(id, dto.roleKeys, actor);
  }
}
