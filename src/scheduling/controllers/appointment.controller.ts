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
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { AppointmentService } from '../services/appointment.service';
import { CreateAppointmentDto } from '../dto/scheduling.dto';

interface RequestWithUser {
  user: {
    id: string;
    role: string;
  };
}

@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @Post()
  async bookAppointment(
    @Body() dto: CreateAppointmentDto,
    @Request() req: RequestWithUser,
  ) {
    return await this.appointmentService.bookAppointment(dto, req.user.id);
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
