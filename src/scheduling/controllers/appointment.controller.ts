import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { AppointmentService } from '../services/appointment.service';
import {
  CreateAppointmentDto,
  RescheduleAppointmentDto,
} from '../dto/scheduling.dto';

interface RequestWithUser {
  user: {
    id: string;
    role: string;
  };
}

@Controller(['appointment', 'appointments'])
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @Post(['', 'book'])
  async bookAppointment(
    @Body() dto: CreateAppointmentDto,
    @Request() req: RequestWithUser,
  ) {
    return await this.appointmentService.bookAppointment(dto, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @Get(['my', 'my-appointments'])
  async getPatientAppointments(@Request() req: RequestWithUser) {
    return await this.appointmentService.getPatientAppointments(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @Patch([':id/cancel', 'cancel/:id'])
  async cancelAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    return await this.appointmentService.cancelAppointment(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @Patch([':id/reschedule', 'reschedule/:id'])
  async rescheduleAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
    @Request() req: RequestWithUser,
  ) {
    return await this.appointmentService.rescheduleAppointment(
      id,
      dto,
      req.user.id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getAppointmentById(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    return await this.appointmentService.getAppointmentById(id, req.user);
  }
}
