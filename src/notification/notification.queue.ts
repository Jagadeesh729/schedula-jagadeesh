import { Injectable, Logger } from '@nestjs/common';

export interface NotificationJobData {
  patientId: string;
  type: string;
  appointmentId: string;
  eventId: string;
  title: string;
  message: string;
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);
  private queue: NotificationJobData[] = [];
  private isProcessing = false;

  enqueueJob(job: NotificationJobData): void {
    this.queue.push(job);
    this.logger.log(
      `Enqueued asynchronous notification job [Event: ${job.eventId}] for Patient: ${job.patientId}`,
    );
    setImmediate(() => {
      void this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (job) {
        try {
          // Process background job side-effects asynchronously
          this.logger.log(
            `Successfully processed async notification job for event: ${job.eventId}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed processing async notification job for event: ${job.eventId}`,
            error instanceof Error ? error.stack : '',
          );
        }
      }
    }
    this.isProcessing = false;
  }
}
