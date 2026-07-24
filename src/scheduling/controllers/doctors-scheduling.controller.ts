import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SchedulingConfigService } from '../services/scheduling-config.service';
import { AppointmentService } from '../services/appointment.service';
import { CreateSchedulingConfigDto } from '../dto/create-scheduling-config.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';

@Controller('doctors')
export class DoctorsSchedulingController {
  constructor(
    private readonly configService: SchedulingConfigService,
    private readonly appointmentService: AppointmentService,
  ) {}

  @Post(':doctorId/scheduling')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR')
  async configureScheduling(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: CreateSchedulingConfigDto,
  ) {
    return await this.configService.configureScheduling(doctorId, dto);
  }

  @Get(':doctorId/availability')
  async getDoctorAvailability(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('date') date: string,
  ) {
    return await this.appointmentService.getDoctorAvailability(doctorId, date);
  }
}
