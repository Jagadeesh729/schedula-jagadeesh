import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { ReminderService } from './reminder.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { NotificationType } from './enums/notification-type.enum';

interface RequestWithUser {
  user: {
    id: string;
    role: string;
  };
}

@ApiTags('Notification')
@ApiBearerAuth()
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
  @ApiOperation({
    summary: 'Trigger automated appointment reminder scan (Doctor/Admin)',
    description:
      'Scans upcoming active appointments within the reminder window and generates deduplicated reminders.',
  })
  @ApiResponse({ status: 200, description: 'Reminders processed successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Requires DOCTOR or ADMIN role',
  })
  async triggerReminders(@Body() body?: { appointmentId?: string }) {
    const stats = await this.reminderService.processAppointmentReminders(
      body?.appointmentId,
    );
    return {
      message: 'Appointment reminders processed',
      ...stats,
    };
  }

  @Get(['notifications', 'notification'])
  @Roles('PATIENT')
  @ApiOperation({
    summary: 'Get patient notifications (latest first)',
    description:
      'Retrieves all notifications for the authenticated patient ordered latest first. Supports optional type category filter.',
  })
  @ApiQuery({
    name: 'type',
    enum: NotificationType,
    required: false,
    description: 'Optional notification type filter',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns notifications array with totalCount and unreadCount',
  })
  async getNotifications(
    @Request() req: RequestWithUser,
    @Query('type') type?: NotificationType,
  ) {
    return this.notificationService.getPatientNotifications(req.user.id, type);
  }

  @Patch(['notifications/read-all', 'notification/read-all'])
  @Roles('PATIENT')
  @ApiOperation({
    summary: 'Mark all patient notifications as read',
    description:
      'Updates all unread notifications belonging to the authenticated patient to isRead: true.',
  })
  @ApiResponse({ status: 200, description: 'Returns updated unread count (0)' })
  async markAllAsRead(@Request() req: RequestWithUser) {
    return this.notificationService.markAllAsRead(req.user.id);
  }

  @Patch([
    'notifications/:id/read',
    'notifications/:id',
    'notification/:id/read',
    'notification/:id',
  ])
  @Roles('PATIENT')
  @ApiOperation({
    summary: 'Mark a notification as read by ID',
    description:
      'Updates the specified notification to isRead: true with patient ownership validation.',
  })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.notificationService.markAsRead(id, req.user.id);
  }

  @Delete(['notifications', 'notification'])
  @Roles('PATIENT')
  @ApiOperation({
    summary: 'Delete all notifications for authenticated patient',
    description:
      'Permanently deletes all notifications belonging to the logged-in patient.',
  })
  @ApiResponse({
    status: 200,
    description: 'All patient notifications deleted',
  })
  async deleteAllNotifications(@Request() req: RequestWithUser) {
    return this.notificationService.deleteAllNotifications(req.user.id);
  }

  @Delete(['notifications/:id', 'notification/:id'])
  @Roles('PATIENT')
  @ApiOperation({
    summary: 'Delete a specific notification by ID',
    description:
      'Permanently deletes a notification with patient ownership verification.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async deleteNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.notificationService.deleteNotification(id, req.user.id);
  }
}
