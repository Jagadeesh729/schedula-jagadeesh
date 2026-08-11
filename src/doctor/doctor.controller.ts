import { Body, Controller, Get, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { CreateDoctorProfileDto } from './dto/create-doctor-profile.dto';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

interface RequestWithUser {
  user: {
    id: string;
    role: string;
  };
}

@Controller('doctor/profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @Post()
  async createProfile(@Request() req: RequestWithUser, @Body() dto: CreateDoctorProfileDto) {
    return this.doctorService.create(req.user.id, dto);
  }

  @Get()
  async getProfile(@Request() req: RequestWithUser) {
    return this.doctorService.findOne(req.user.id);
  }

  @Patch()
  async updateProfile(@Request() req: RequestWithUser, @Body() dto: UpdateDoctorProfileDto) {
    return this.doctorService.update(req.user.id, dto);
  }
}

