import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import type { AuthContext } from '../common/auth-context.js';
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /** Open to any authenticated user - populates the Daily Report task dropdown, not just the admin management page. */
  @Get()
  getAll() {
    return this.projectsService.getAll();
  }

  @Post()
  @RequirePermissions('company:manage')
  create(@Body() dto: CreateProjectDto, @CurrentUser() actor: AuthContext) {
    return this.projectsService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions('company:manage')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @CurrentUser() actor: AuthContext) {
    return this.projectsService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('company:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: AuthContext) {
    return this.projectsService.remove(id, actor);
  }
}
