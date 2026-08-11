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

  @Get('/health')
  async getHealth() {
    let dbStatus = 'disconnected';
    let dbLatencyMs = -1;
    const startTime = Date.now();

    try {
      if (this.dataSource && this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        dbStatus = 'connected';
        dbLatencyMs = Date.now() - startTime;
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

    const memoryUsage = process.memoryUsage();

    return {
      status: 'ok',
      database: 'connected',
      dbLatencyMs,
      service: 'Schedula Enterprise Medical Appointment API',
      version: '1.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
      system: {
        memoryRssMb: (memoryUsage.rss / 1024 / 1024).toFixed(2),
        heapUsedMb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
        nodeVersion: process.version,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('/readiness')
  async getReadiness() {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        reason: 'Database pool uninitialized',
        timestamp: new Date().toISOString(),
      });
    }
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        reason: 'Database query failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Get('/liveness')
  getLiveness() {
    const memory = process.memoryUsage();
    return {
      status: 'alive',
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMb: (memory.rss / 1024 / 1024).toFixed(2),
      timestamp: new Date().toISOString(),
    };
  }
}

