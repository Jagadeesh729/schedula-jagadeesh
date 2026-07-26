import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AppointmentService } from '../services/appointment.service';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';

@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  async createAppointment(@Body() dto: CreateAppointmentDto, @Request() req: any) {
    const userId = req?.user?.id;
    return await this.appointmentService.createAppointment(dto, userId, req?.user?.role);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT', 'DOCTOR')
  async getAppointmentById(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return await this.appointmentService.getAppointmentById(id, req?.user?.id, req?.user?.role);
  }
}
