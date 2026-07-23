import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('patient')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientController {
  @Get('profile')
  @Roles('PATIENT')
  getProfile(@Request() req) {
    return {
      message: 'Access granted to Patient profile',
      user: req.user,
    };
  }
}
