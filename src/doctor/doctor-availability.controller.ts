import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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

  // NOTE: This static route MUST be declared before the dynamic /:id route.
  // NestJS resolves routes in declaration order. If /:id appeared first,
  // the literal string "date" would be captured as the :id parameter,
  // causing the wrong handler to be invoked.
  @Get('date')
  async getByDate(@Request() req, @Query('date') date: string) {
    return this.availabilityService.getByDate(req.user.id, date);
  }

  @Patch(':id')
  async updateRecurring(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringAvailabilityDto,
  ) {
    return this.availabilityService.updateRecurring(req.user.id, id, dto);
  }

  @Delete(':id')
  async deleteRecurring(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.availabilityService.deleteRecurring(req.user.id, id);
  }

  @Post('override')
  async createOverride(@Request() req, @Body() dto: CreateCustomAvailabilityDto) {
    return this.availabilityService.createOverride(req.user.id, dto);
  }
}
