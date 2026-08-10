import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { DoctorAvailabilityService } from './doctor-availability.service';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('doctor/availability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR')
export class DoctorAvailabilityController {
  constructor(private readonly availabilityService: DoctorAvailabilityService) {}

  @Post()
  async createRecurring(@Request() req, @Body() dto: CreateRecurringAvailabilityDto) {
    return this.availabilityService.createRecurring(req.user.id, dto);
  }

  @Get()
  async getRecurring(@Request() req) {
    return this.availabilityService.getRecurring(req.user.id);
  }

  // NOTE: Static routes MUST be declared before dynamic /:id routes.
  @Get('date')
  async getByDate(@Request() req, @Query('date') date: string) {
    return this.availabilityService.getByDate(req.user.id, date);
  }

  @Post('override')
  async createOverride(@Request() req, @Body() dto: CreateCustomAvailabilityDto) {
    return this.availabilityService.createOverride(req.user.id, dto);
  }

  @Get(':id/shrink-preview')
  async previewShrink(
    @Request() req,
    @Param('id') id: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    return this.availabilityService.previewShrink(req.user.id, id, startTime, endTime);
  }

  @Patch(':id')
  async updateRecurring(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringAvailabilityDto,
  ) {
    return this.availabilityService.updateRecurring(req.user.id, id, dto);
  }

  @Delete(':id')
  async deleteRecurring(@Request() req, @Param('id') id: string) {
    return this.availabilityService.deleteRecurring(req.user.id, id);
  }
}
