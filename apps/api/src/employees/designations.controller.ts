import { Body, Controller, Get, Post } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDesignationDto } from './dto/create-designation.dto.js';

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
}
