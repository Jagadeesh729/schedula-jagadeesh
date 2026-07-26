import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PatientService } from './patient.service';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('patient/profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PATIENT')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Post()
  async createProfile(
    @Request() req: { user: Express.User },
    @Body() dto: CreatePatientProfileDto,
  ) {
    return this.patientService.create(req.user.id, dto);
  }

  @Get()
  async getProfile(@Request() req: { user: Express.User }) {
    return this.patientService.findOne(req.user.id);
  }

  @Patch()
  async updateProfile(
    @Request() req: { user: Express.User },
    @Body() dto: UpdatePatientProfileDto,
  ) {
    return this.patientService.update(req.user.id, dto);
  }
}
