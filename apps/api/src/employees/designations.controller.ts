import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDesignationDto } from './dto/create-designation.dto.js';
import { UpdateDesignationDto } from './dto/update-designation.dto.js';

@Controller('designations')
@RequirePermissions('employee:manage')
export class DesignationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.designation.findMany({
      include: { department: true },
      orderBy: { title: 'asc' },
    });
  }

  @Post()
  create(@Body() dto: CreateDesignationDto) {
    return this.prisma.designation.create({ data: dto });
  }

  /** Currently only used to assign a Daily Report template - see UpdateDesignationDto. */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDesignationDto) {
    return this.prisma.designation.update({
      where: { id },
      data: { dailyReportTemplate: dto.dailyReportTemplate },
    });
  }
}
