import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('doctor')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorController {
  @Get('profile')
  @Roles('DOCTOR')
  getProfile(@Request() req) {
    return {
      message: 'Access granted to Doctor profile',
      user: req.user,
    };
  }
}
