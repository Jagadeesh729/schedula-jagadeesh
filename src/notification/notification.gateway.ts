import {
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { PatientProfile } from '../patient/entities/patient-profile.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    @Optional() private readonly jwtService?: JwtService,
    @Optional()
    @InjectRepository(PatientProfile)
    private readonly patientProfileRepo?: Repository<PatientProfile>,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to WebSocket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from WebSocket: ${client.id}`);
  }

  /**
   * Authenticates the socket connection using JWT token and authorizes patient room subscription.
   * Prevents Patient A from subscribing to Patient B's notification channel (IDOR prevention).
   */
  async handleSubscribePatient(
    @MessageBody() data: { patientId: string; token?: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.patientId) {
      return { status: 'error', message: 'patientId is required' };
    }

    // Extract token from body payload, handshake auth, or authorization header
    const token =
      data.token ||
      (client.handshake?.auth as { token?: string })?.token ||
      client.handshake?.headers?.authorization?.replace('Bearer ', '');

    if (!token || !this.jwtService) {
      return { status: 'error', message: 'Unauthorized: Missing JWT token' };
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; role: string }>(
        token,
        {
          secret: process.env.JWT_SECRET || 'supersecretkey',
        },
      );

      const authenticatedUserId = payload.sub;

      // Verify ownership: patientId must match patient profile associated with authenticatedUserId
      if (this.patientProfileRepo) {
        const patientProfile = await this.patientProfileRepo.findOne({
          where: { id: data.patientId },
          relations: { user: true },
        });

        if (
          !patientProfile ||
          (patientProfile.user &&
            patientProfile.user.id !== authenticatedUserId)
        ) {
          this.logger.warn(
            `Unauthorized WebSocket subscription attempt: User ${authenticatedUserId} tried to subscribe to patient ${data.patientId}`,
          );
          return {
            status: 'error',
            message:
              'Unauthorized: Cannot subscribe to another patient notification channel',
          };
        }
      }

      await client.join(`patient_${data.patientId}`);
      this.logger.log(
        `Authorized client ${client.id} (User: ${authenticatedUserId}) subscribed to room: patient_${data.patientId}`,
      );
      return { status: 'subscribed', room: `patient_${data.patientId}` };
    } catch {
      return {
        status: 'error',
        message: 'Unauthorized: Invalid or expired JWT token',
      };
    }
  }

  notifyPatient(
    patientId: string,
    notificationPayload: Record<string, unknown>,
  ) {
    if (this.server) {
      this.server
        .to(`patient_${patientId}`)
        .emit('notification', notificationPayload);
      this.logger.log(
        `Real-time WebSocket notification emitted to room patient_${patientId}`,
      );
    }
  }
}
