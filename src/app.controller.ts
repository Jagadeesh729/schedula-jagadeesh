import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    let dbStatus = 'disconnected';
    try {
      if (this.dataSource && this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        dbStatus = 'connected';
      }
    } catch {
      dbStatus = 'unhealthy';
    }

    if (dbStatus !== 'connected') {
      throw new ServiceUnavailableException({
        status: 'error',
        database: dbStatus,
        service: 'Schedula Enterprise Medical Appointment API',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ok',
      database: 'connected',
      service: 'Schedula Enterprise Medical Appointment API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
