import { Body, Controller, Get, Post } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';

@Controller('departments')
@RequirePermissions('employee:manage')
export class DepartmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  @Post()
  create(@Body() dto: CreateDepartmentDto) {
    return this.prisma.department.create({ data: dto });
  }
}
