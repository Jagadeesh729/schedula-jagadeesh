import { Test, TestingModule } from '@nestjs/testing';
import { NotificationGateway } from './notification.gateway';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { Socket } from 'socket.io';

describe('NotificationGateway', () => {
  let gateway: NotificationGateway;
  let jwtService: JwtService;

  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockPatientProfileRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationGateway,
        { provide: JwtService, useValue: mockJwtService },
        {
          provide: getRepositoryToken(PatientProfile),
          useValue: mockPatientProfileRepo,
        },
      ],
    }).compile();

    gateway = module.get<NotificationGateway>(NotificationGateway);
    jwtService = module.get<JwtService>(JwtService);
    jest.clearAllMocks();
  });

  it('should reject subscription without JWT token', async () => {
    const mockSocket = {
      id: 'socket-1',
      handshake: { auth: {}, headers: {} },
    } as unknown as Socket;

    const result = await gateway.handleSubscribePatient(
      { patientId: 'patient-uuid-1' },
      mockSocket,
    );

    expect(result).toEqual({
      status: 'error',
      message: 'Unauthorized: Missing JWT token',
    });
  });

  it('should reject IDOR attempt when Patient A tries to subscribe to Patient B room', async () => {
    const mockSocket = {
      id: 'socket-1',
      handshake: { auth: { token: 'valid-patient-a-jwt' }, headers: {} },
      join: jest.fn(),
    } as unknown as Socket;

    mockJwtService.verify.mockReturnValue({
      sub: 'user-patient-a-id',
      role: 'PATIENT',
    });

    // Patient B profile belongs to user-patient-b-id
    mockPatientProfileRepo.findOne.mockResolvedValue({
      id: 'patient-uuid-b',
      user: { id: 'user-patient-b-id' },
    });

    const result = await gateway.handleSubscribePatient(
      { patientId: 'patient-uuid-b', token: 'valid-patient-a-jwt' },
      mockSocket,
    );

    expect(result).toEqual({
      status: 'error',
      message:
        'Unauthorized: Cannot subscribe to another patient notification channel',
    });
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it('should allow subscription when Patient A subscribes to Patient A room', async () => {
    const mockSocket = {
      id: 'socket-1',
      handshake: { auth: { token: 'valid-patient-a-jwt' }, headers: {} },
      join: jest.fn().mockResolvedValue(undefined),
    } as unknown as Socket;

    mockJwtService.verify.mockReturnValue({
      sub: 'user-patient-a-id',
      role: 'PATIENT',
    });

    mockPatientProfileRepo.findOne.mockResolvedValue({
      id: 'patient-uuid-a',
      user: { id: 'user-patient-a-id' },
    });

    const result = await gateway.handleSubscribePatient(
      { patientId: 'patient-uuid-a', token: 'valid-patient-a-jwt' },
      mockSocket,
    );

    expect(result).toEqual({
      status: 'subscribed',
      room: 'patient_patient-uuid-a',
    });
    expect(mockSocket.join).toHaveBeenCalledWith('patient_patient-uuid-a');
  });
});
