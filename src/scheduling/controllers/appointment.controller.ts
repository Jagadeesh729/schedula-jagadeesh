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

@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  async createAppointment(@Body() dto: CreateAppointmentDto, @Request() req: any) {
    const userId = req?.user?.id;
    return await this.appointmentService.createAppointment(dto, userId);
  }

  @Get(':id')
  async getAppointmentById(@Param('id', ParseUUIDPipe) id: string) {
    return await this.appointmentService.getAppointmentById(id);
  }
}
