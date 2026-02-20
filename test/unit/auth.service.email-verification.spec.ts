import { BadRequestException } from '@nestjs/common';

import { AuthService } from '../../src/modules/auth/auth.service';
import { hashOtp } from '../../src/modules/auth/utils/password-reset-otp.util';

describe('AuthService email verification', () => {
  const authRepository: any = {
    findTenantByDomain: jest.fn(),
    findUserByEmailAndTenant: jest.fn(),
    findLatestEmailVerificationOtp: jest.fn(),
    deleteActiveEmailVerificationOtps: jest.fn(),
    createEmailVerificationOtp: jest.fn(),
    updateEmailVerificationOtpAttempts: jest.fn(),
    markEmailVerificationOtpUsed: jest.fn(),
    verifyUserEmailAndActivate: jest.fn(),
  };

  const jwtService: any = {};
  const configService: any = {
    get: jest.fn(),
    getOrThrow: jest.fn().mockReturnValue('jwt-secret'),
  };

  const emailService: any = {
    sendTransactionalEmail: jest.fn(),
  };

  const queueService: any = {
    addTransactionalEmailJob: jest.fn(),
  };

  const notificationService: any = {};

  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AuthService(
      authRepository,
      jwtService,
      configService,
      queueService,
      emailService,
      notificationService
    );
  });

  it('requestEmailVerification returns generic response when tenant not found', async () => {
    authRepository.findTenantByDomain.mockResolvedValue(null);

    const result = await service.requestEmailVerification({
      email: 'depthead@uni.edu',
      tenantDomain: 'missing-tenant',
    });

    expect(result).toEqual({
      message: 'If an account exists for that email, a verification code has been sent.',
    });
  });

  it('verifyEmailVerificationOtp activates user when OTP matches', async () => {
    authRepository.findTenantByDomain.mockResolvedValue({ id: 't1', domain: 'uni' });

    const pepper = 'pepper';
    configService.getOrThrow.mockReturnValue(pepper);

    const otp = '123456';
    const salt = 'salt';
    const otpHash = hashOtp(otp, salt, pepper);

    authRepository.findLatestEmailVerificationOtp.mockResolvedValue({
      id: 'otp1',
      tenantId: 't1',
      email: 'depthead@uni.edu',
      userId: 'u1',
      otpHash,
      otpSalt: salt,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      attempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
    });

    const result = await service.verifyEmailVerificationOtp({
      email: 'depthead@uni.edu',
      tenantDomain: 'uni',
      otp,
    });

    expect(authRepository.markEmailVerificationOtpUsed).toHaveBeenCalledWith('otp1');
    expect(authRepository.verifyUserEmailAndActivate).toHaveBeenCalledWith('u1');
    expect(result).toEqual({ verified: true, message: 'Email verified successfully' });
  });

  it('verifyEmailVerificationOtp increments attempts on wrong OTP', async () => {
    authRepository.findTenantByDomain.mockResolvedValue({ id: 't1', domain: 'uni' });

    const pepper = 'pepper';
    configService.getOrThrow.mockReturnValue(pepper);

    authRepository.findLatestEmailVerificationOtp.mockResolvedValue({
      id: 'otp1',
      tenantId: 't1',
      email: 'depthead@uni.edu',
      userId: 'u1',
      otpHash: hashOtp('000000', 'salt', pepper),
      otpSalt: 'salt',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      attempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
    });

    await expect(
      service.verifyEmailVerificationOtp({
        email: 'depthead@uni.edu',
        tenantDomain: 'uni',
        otp: '123456',
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(authRepository.updateEmailVerificationOtpAttempts).toHaveBeenCalledWith('otp1', {
      attempts: 1,
      lockedUntil: null,
    });
  });
});
