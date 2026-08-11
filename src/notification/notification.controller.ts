import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PATIENT')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get(['notifications', 'notification'])
  async getNotifications(@Request() req: any) {
    return this.notificationService.getPatientNotifications(req.user.id);
  }

  @Patch(['notifications/:id/read', 'notifications/:id', 'notification/:id/read', 'notification/:id'])
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.notificationService.markAsRead(id, req.user.id);
  }
}
