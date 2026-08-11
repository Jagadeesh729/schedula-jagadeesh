import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

const makeMockDataSource = (overrides: Partial<DataSource> = {}) =>
  ({
    isInitialized: true,
    query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    ...overrides,
  } as unknown as DataSource);

describe('AppController', () => {
  let appController: AppController;
  let mockDataSource: ReturnType<typeof makeMockDataSource>;

  beforeEach(async () => {
    mockDataSource = makeMockDataSource();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('getHealth', () => {
    it('should return status ok when DB is initialized and query succeeds', async () => {
      const result = await appController.getHealth();
      expect(result.status).toBe('ok');
      expect(result.database).toBe('connected');
      expect(typeof result.dbLatencyMs).toBe('number');
      expect(result.dbLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw ServiceUnavailableException when DB is not initialized', async () => {
      const uninitModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          AppService,
          { provide: DataSource, useValue: makeMockDataSource({ isInitialized: false }) },
        ],
      }).compile();
      const uninitCtrl = uninitModule.get<AppController>(AppController);
      await expect(uninitCtrl.getHealth()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should throw ServiceUnavailableException when DB query fails', async () => {
      mockDataSource.query = jest.fn().mockRejectedValue(new Error('Connection refused'));
      await expect(appController.getHealth()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('getReadiness', () => {
    it('should return ready when DB is initialized and query succeeds', async () => {
      const result = await appController.getReadiness();
      expect(result.status).toBe('ready');
      expect(result.database).toBe('connected');
    });

    it('should throw ServiceUnavailableException when DB is not initialized', async () => {
      const uninitModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          AppService,
          { provide: DataSource, useValue: makeMockDataSource({ isInitialized: false }) },
        ],
      }).compile();
      const uninitCtrl = uninitModule.get<AppController>(AppController);
      await expect(uninitCtrl.getReadiness()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should throw ServiceUnavailableException when DB query fails', async () => {
      mockDataSource.query = jest.fn().mockRejectedValue(new Error('Query failed'));
      await expect(appController.getReadiness()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('getLiveness', () => {
    it('should return alive status with uptime and memory fields', () => {
      const result = appController.getLiveness();
      expect(result.status).toBe('alive');
      expect(typeof result.uptimeSeconds).toBe('number');
      expect(typeof result.memoryRssMb).toBe('string');
      expect(typeof result.timestamp).toBe('string');
    });
  });
});
