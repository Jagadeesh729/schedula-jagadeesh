import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

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

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to WebSocket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from WebSocket: ${client.id}`);
  }

  @SubscribeMessage('subscribe_patient')
  handleSubscribePatient(
    @MessageBody() data: { patientId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data?.patientId) {
      void client.join(`patient_${data.patientId}`);
      this.logger.log(
        `Client ${client.id} subscribed to patient room: patient_${data.patientId}`,
      );
      return { status: 'subscribed', room: `patient_${data.patientId}` };
    }
    return { status: 'error', message: 'patientId is required' };
  }

  notifyPatient(patientId: string, notificationPayload: Record<string, unknown>) {
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
