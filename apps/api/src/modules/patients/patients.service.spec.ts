import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PrismaService } from '../../database/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { CommunicationService } from '../communication/communication.service';
import { CommunicationChannel } from '@calyvia/shared';

describe('PatientsService (guardian, welcome messages, photos)', () => {
  let service: PatientsService;
  let prisma: any;
  let communication: any;

  const baseDto = {
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: '1995-01-01',
    gender: 'FEMALE' as any,
    phone: '0703377395',
    county: 'Kiambu',
    residentialAddress: 'Ruiru, Kiambu',
  };

  beforeEach(async () => {
    prisma = {
      patient: {
        create: jest.fn().mockImplementation((args: any) =>
          Promise.resolve({ id: 'patient-1', ...args.data }),
        ),
        findUnique: jest.fn().mockResolvedValue({ id: 'patient-1', firstName: 'Jane' }),
      },
      emergencyContact: {
        create: jest.fn().mockImplementation((args: any) =>
          Promise.resolve({ id: 'guardian-1', ...args.data }),
        ),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ phone: '0799000001' }]),
      },
      client: {
        storage: {
          from: jest.fn().mockReturnValue({
            upload: jest.fn().mockResolvedValue({ error: null }),
            list: jest.fn().mockResolvedValue({
              data: [{ name: 'passport.jpg', created_at: '2026-11-26T00:00:00Z' }],
              error: null,
            }),
            createSignedUrl: jest.fn().mockResolvedValue({
              data: { signedUrl: 'https://storage.example/signed' },
            }),
          }),
        },
      },
    };
    communication = {
      sendMessage: jest.fn().mockResolvedValue({ status: 'SENT', provider: 'BYTEWAVE' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: CryptoService,
          useValue: {
            encrypt: jest.fn((value: string) => `enc:${value}`),
            decrypt: jest.fn(() => undefined),
          },
        },
        { provide: CommunicationService, useValue: communication },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
  });

  it('stores guardian details and sends a welcome SMS and WhatsApp message', async () => {
    const created = await service.create({
      ...baseDto,
      guardianName: 'Mary Wanjiku',
      guardianPhone: '0712345678',
      guardianWhatsApp: '0723456789',
      guardianEmail: 'mary@example.co.ke',
    });

    expect(prisma.emergencyContact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        patientId: 'patient-1',
        fullName: 'Mary Wanjiku',
        relationship: 'GUARDIAN',
        phone: '+254712345678',
        alternativePhone: '+254723456789',
        email: 'mary@example.co.ke',
        isPrimaryGuarantor: true,
      }),
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: { in: expect.arrayContaining(['SUPER_ADMIN', 'FACILITY_ADMIN']) }, isActive: true },
      take: 10,
    });
    expect(communication.sendMessage).toHaveBeenCalledTimes(4);
    expect(communication.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: CommunicationChannel.SMS,
        recipient: '+254712345678',
        templateKey: 'GUARDIAN_WELCOME',
        recipientType: 'FAMILY',
        variables: expect.objectContaining({ caregiver_name: 'Mary Wanjiku', patient_name: 'Jane' }),
      }),
    );
    expect(communication.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: CommunicationChannel.WHATSAPP,
        recipient: '+254723456789',
      }),
    );
    expect(communication.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: CommunicationChannel.SMS,
        recipient: '+254799000001',
        templateKey: 'ADMIN_NEW_PATIENT',
        recipientType: 'STAFF',
      }),
    );
    expect(communication.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: CommunicationChannel.WHATSAPP,
        recipient: '+254799000001',
        templateKey: 'ADMIN_NEW_PATIENT',
      }),
    );
    expect(created.welcomeNotifications).toHaveLength(4);
    expect(created.welcomeNotifications).toEqual([
      expect.objectContaining({ audience: 'GUARDIAN', channel: 'SMS', status: 'SENT' }),
      expect.objectContaining({ audience: 'GUARDIAN', channel: 'WHATSAPP', status: 'SENT' }),
      expect.objectContaining({ audience: 'ADMIN', channel: 'SMS', status: 'SENT' }),
      expect.objectContaining({ audience: 'ADMIN', channel: 'WHATSAPP', status: 'SENT' }),
    ]);
  });

  it('does not fail registration when a gateway rejects a welcome message', async () => {
    communication.sendMessage
      .mockResolvedValueOnce({ status: 'SENT' })
      .mockRejectedValueOnce(new Error('WhatSocket not connected'))
      .mockResolvedValue({ status: 'SENT' });

    const created = await service.create({
      ...baseDto,
      guardianName: 'Mary Wanjiku',
      guardianPhone: '0712345678',
      guardianWhatsApp: '0723456789',
    });

    expect(created.id).toBe('patient-1');
    expect(created.welcomeNotifications?.[1]).toEqual(
      expect.objectContaining({ channel: 'WHATSAPP', status: 'FAILED' }),
    );
  });

  it('skips guardian writes/messages but still alerts administrators', async () => {
    const created = await service.create(baseDto);

    expect(prisma.emergencyContact.create).not.toHaveBeenCalled();
    expect(created.welcomeNotifications).toEqual([
      expect.objectContaining({ audience: 'ADMIN', channel: 'SMS' }),
      expect.objectContaining({ audience: 'ADMIN', channel: 'WHATSAPP' }),
    ]);
    expect(communication.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('reports a failed administrator notification without failing registration', async () => {
    // No guardian supplied: the two calls are admin SMS + admin WhatsApp.
    communication.sendMessage
      .mockResolvedValueOnce({ status: 'SENT' })
      .mockRejectedValueOnce(new Error('Baileys offline'));

    const created = await service.create(baseDto);

    expect(created.welcomeNotifications?.[1]).toEqual(
      expect.objectContaining({ audience: 'ADMIN', channel: 'WHATSAPP', status: 'FAILED' }),
    );
  });

  it('rejects unsupported photo formats and oversized images', async () => {
    await expect(
      service.uploadPatientPhoto('patient-1', {
        fileName: 'scan.pdf',
        mimeType: 'application/pdf',
        dataBase64: 'aGVsbG8=',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.uploadPatientPhoto('patient-1', {
        fileName: 'huge.png',
        mimeType: 'image/png',
        dataBase64: Buffer.alloc(6 * 1024 * 1024).toString('base64'),
      }),
    ).rejects.toThrow(/5 MB/);
  });

  it('uploads a JPG photo and returns a signed URL, then lists it', async () => {
    const uploaded = await service.uploadPatientPhoto('patient-1', {
      fileName: 'passport.jpg',
      mimeType: 'image/jpeg',
      dataBase64: Buffer.from('%PDF-placeholder').toString('base64'),
    });

    expect(uploaded.path).toMatch(/^patient-1\/\d+-passport\.jpg$/);
    expect(uploaded.url).toBe('https://storage.example/signed');

    const photos = await service.listPatientPhotos('patient-1');
    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatchObject({
      name: 'passport.jpg',
      url: 'https://storage.example/signed',
    });
  });
});
