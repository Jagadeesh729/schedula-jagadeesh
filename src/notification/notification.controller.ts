import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  UseGuards,
  Request,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ReminderService } from './reminder.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

interface RequestWithUser {
  user: {
    id: string;
    role: string;
  };
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly reminderService: ReminderService,
  ) {}

  @Post('notifications/trigger-reminders')
  @HttpCode(200)
  @Roles('DOCTOR', 'ADMIN')
  async triggerReminders() {
    const stats = await this.reminderService.processAppointmentReminders();
    return {
      message: 'Appointment reminders processed',
      ...stats,
    };
  }

  @Get(['notifications', 'notification'])
  @Roles('PATIENT')
  async getNotifications(@Request() req: RequestWithUser) {
    return this.notificationService.getPatientNotifications(req.user.id);
  }

  @Patch(['notifications/read-all', 'notification/read-all'])
  async markAllAsRead(@Request() req: RequestWithUser) {
    return this.notificationService.markAllAsRead(req.user.id);
  }

  @Patch([
    'notifications/:id/read',
    'notifications/:id',
    'notification/:id/read',
    'notification/:id',
  ])
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.notificationService.markAsRead(id, req.user.id);
  }

  @Delete(['notifications', 'notification'])
  async deleteAllNotifications(@Request() req: RequestWithUser) {
    return this.notificationService.deleteAllNotifications(req.user.id);
  }

  @Delete(['notifications/:id', 'notification/:id'])
  async deleteNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.notificationService.deleteNotification(id, req.user.id);
  }
}
