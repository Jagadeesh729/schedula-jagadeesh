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
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { SchedulingConfigService } from '../services/scheduling-config.service';
import { AppointmentService } from '../services/appointment.service';
import { CreateSchedulingConfigDto } from '../dto/scheduling.dto';

interface RequestWithUser {
  user: {
    id: string;
    role: string;
  };
}

@Controller('doctors')
export class DoctorsSchedulingController {
  constructor(
    private readonly configService: SchedulingConfigService,
    private readonly appointmentService: AppointmentService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR')
  @Get('appointments')
  async getDoctorAppointments(@Request() req: RequestWithUser) {
    return await this.appointmentService.getDoctorAppointments(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'ADMIN')
  @Post(':doctorId/scheduling')
  async createOrUpdateConfig(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: CreateSchedulingConfigDto,
    @Request() req: RequestWithUser,
  ) {
    return await this.configService.createOrUpdateConfig(
      doctorId,
      dto,
      req.user,
    );
  }

  @Get(':doctorId/availability')
  async getDoctorAvailability(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('date') date: string,
  ) {
    return await this.appointmentService.getDoctorAvailability(doctorId, date);
  }
}

@Controller('scheduling')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR', 'ADMIN')
export class SchedulingConfigController {
  constructor(private readonly configService: SchedulingConfigService) {}

  @Post('config')
  async createOrUpdateConfigSelf(
    @Body() dto: CreateSchedulingConfigDto,
    @Request() req: RequestWithUser,
  ) {
    return await this.configService.createOrUpdateConfig(
      req.user.id,
      dto,
      req.user,
    );
  }

  @Post()
  async createOrUpdateConfigSelfRoot(
    @Body() dto: CreateSchedulingConfigDto,
    @Request() req: RequestWithUser,
  ) {
    return await this.configService.createOrUpdateConfig(
      req.user.id,
      dto,
      req.user,
    );
  }
}

@Controller('doctor/scheduling')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR', 'ADMIN')
export class DoctorSchedulingConfigController {
  constructor(private readonly configService: SchedulingConfigService) {}

  @Post('config')
  async createOrUpdateConfigSelf(
    @Body() dto: CreateSchedulingConfigDto,
    @Request() req: RequestWithUser,
  ) {
    return await this.configService.createOrUpdateConfig(
      req.user.id,
      dto,
      req.user,
    );
  }

  @Post()
  async createOrUpdateConfigSelfRoot(
    @Body() dto: CreateSchedulingConfigDto,
    @Request() req: RequestWithUser,
  ) {
    return await this.configService.createOrUpdateConfig(
      req.user.id,
      dto,
      req.user,
    );
  }
}


@Controller('doctor')
export class DoctorAppointmentsController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR')
  @Get('appointments')
  async getDoctorAppointments(@Request() req: RequestWithUser) {
    return await this.appointmentService.getDoctorAppointments(req.user.id);
  }
}
