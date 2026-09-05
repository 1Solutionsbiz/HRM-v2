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
import { HolidaysService } from './holidays.service.js';
import { CreateHolidayDto } from './dto/create-holiday.dto.js';
import { UpdateHolidayDto } from './dto/update-holiday.dto.js';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  getAll() {
    return this.holidaysService.getAll();
  }

  @Post()
  @RequirePermissions('company:manage')
  create(@Body() dto: CreateHolidayDto, @CurrentUser() actor: AuthContext) {
    return this.holidaysService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions('company:manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHolidayDto,
    @CurrentUser() actor: AuthContext,
  ) {
    return this.holidaysService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('company:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: AuthContext) {
    return this.holidaysService.remove(id, actor);
  }
}
