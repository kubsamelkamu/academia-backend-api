import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../auth/auth.service';
import { LoginDto } from '../../auth/dto/login.dto';
import { AuthRepository } from '../../auth/auth.repository';
import { ROLES } from '../../../common/constants/roles.constants';
import { JwtService } from '@nestjs/jwt';
import {
  ADMIN_2FA_DEFAULT_TOKEN_TTL_SECONDS,
  ADMIN_2FA_TOKEN_PURPOSE,
} from './totp/admin-twofactor.constants';
import type { TwoFactorPendingTokenPayload } from './totp/admin-twofactor.types';
import { verifyTotpCode } from './totp/totp.util';
import { authenticator } from 'otplib';
import * as bcrypt from 'bcrypt';
import { generateBackupCodes, hashBackupCode } from './backup-codes/backup-codes.util';
import {
  InsufficientPermissionsException,
  InvalidBackupCodeException,
  InvalidTwoFactorCodeException,
  InvalidTwoFactorMethodException,
  InvalidTwoFactorTokenException,
  NoBackupCodesAvailableException,
  TwoFactorNotEnabledException,
  TwoFactorSetupNotStartedException,
  UnauthorizedAccessException,
} from '../../../common/exceptions';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly authService: AuthService,
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  private async isUserTotpEnabled(userId: string): Promise<boolean> {
    const twoFactor = await this.authRepository.getUserTwoFactor(userId);
    return !!twoFactor?.twoFactorEnabled;
  }

  private async getUserTotpSecret(userId: string): Promise<string> {
    const twoFactor = await this.authRepository.getUserTwoFactor(userId);
    if (!twoFactor?.twoFactorEnabled || !twoFactor.twoFactorSecret) {
      throw new TwoFactorNotEnabledException();
    }
    return twoFactor.twoFactorSecret;
  }

  private signTwoFactorToken(payload: Omit<TwoFactorPendingTokenPayload, 'purpose'>): string {
    const fullPayload: TwoFactorPendingTokenPayload = {
      purpose: ADMIN_2FA_TOKEN_PURPOSE,
      ...payload,
    };

    // Use refresh secret so it cannot be verified with access secret.
    // TTL is short; token is only for completing 2FA.
    return this.jwtService.sign(fullPayload, {
      secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
      expiresIn: ADMIN_2FA_DEFAULT_TOKEN_TTL_SECONDS,
    });
  }

  private verifyTwoFactorToken(token: string): TwoFactorPendingTokenPayload {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
      }) as TwoFactorPendingTokenPayload;

      if (payload?.purpose !== ADMIN_2FA_TOKEN_PURPOSE) {
        throw new InvalidTwoFactorTokenException('Invalid two-factor token');
      }

      return payload;
    } catch {
      throw new InvalidTwoFactorTokenException();
    }
  }

  async login(loginDto: LoginDto) {
    // Force system tenant login for admins.
    const user = await this.authService.validateUser(loginDto.email, loginDto.password, 'system');

    // If user has 2FA enabled, return a staged response.
    if (await this.isUserTotpEnabled(user.id)) {
      const roles = user.roles.map((ur: { role: { name: string } }) => ur.role.name);
      if (!roles.includes(ROLES.PLATFORM_ADMIN)) {
        throw new InsufficientPermissionsException();
      }

      const twoFactorToken = this.signTwoFactorToken({
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId || 'system',
        roles,
      });

      return {
        requiresTwoFactor: true,
        twoFactorToken,
      };
    }

    // No 2FA => normal login.
    return this.authService.login({ ...loginDto, tenantDomain: 'system' });
  }

  async loginTwoFactor(twoFactorToken: string, code: string, method?: 'totp' | 'backup_code') {
    const pending = this.verifyTwoFactorToken(twoFactorToken);

    if (!pending.roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    if (!method || method === 'totp') {
      const secret = await this.getUserTotpSecret(pending.sub);
      const ok = verifyTotpCode(secret, code);
      if (!ok) {
        throw new InvalidTwoFactorCodeException();
      }
    } else if (method === 'backup_code') {
      const allCodes = await this.authRepository.getUserBackupCodeHashes(pending.sub);
      const candidates = allCodes.filter((c: { usedAt: Date | null }) => !c.usedAt);
      if (candidates.length === 0) {
        throw new NoBackupCodesAvailableException();
      }

      const preHash = hashBackupCode(pending.sub, code);
      let matchedId: string | null = null;
      for (const c of candidates) {
        const match = await bcrypt.compare(preHash, c.codeHash);
        if (match) {
          matchedId = c.id;
          break;
        }
      }

      if (!matchedId) {
        throw new InvalidBackupCodeException();
      }

      await this.authRepository.markBackupCodeUsed(matchedId);
    } else {
      throw new InvalidTwoFactorMethodException();
    }

    // Issue normal access+refresh tokens (same as AuthService.login)
    const dbUser = await this.authRepository.findUserById(pending.sub);
    if (!dbUser) {
      throw new UnauthorizedAccessException();
    }

    // Update last login
    await this.authRepository.updateUserLastLogin(dbUser.id);

    const payload = {
      sub: dbUser.id,
      email: dbUser.email,
      tenantId: dbUser.tenantId || 'system',
      roles: dbUser.roles.map((ur: { role: { name: string } }) => ur.role.name),
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
      expiresIn: this.configService.get('auth.refreshExpiresIn') || '30d',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        roles: dbUser.roles.map((ur: { role: { name: string } }) => ur.role.name),
        tenantId: dbUser.tenantId,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    const tokens = await this.authService.refreshToken(refreshToken);

    const payload = this.jwtService.decode(tokens.accessToken) as { roles?: string[] } | null;
    const roles = payload?.roles ?? [];
    if (!roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    return tokens;
  }

  async me(user: any) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    const dbUser = await this.authRepository.findUserById(user.sub);
    if (!dbUser) {
      throw new UnauthorizedAccessException();
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      avatarUrl: dbUser.avatarUrl,
      avatarPublicId: dbUser.avatarPublicId,
      tenantId: dbUser.tenantId,
      roles: dbUser.roles.map((ur: { role: { name: string } }) => ur.role.name),
      lastLoginAt: dbUser.lastLoginAt,
    };
  }

  async twoFactorStatus(user: any) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    const twoFactor = await this.authRepository.getUserTwoFactor(user.sub);
    return {
      enabled: !!twoFactor?.twoFactorEnabled,
      verifiedAt: twoFactor?.twoFactorVerifiedAt ?? null,
    };
  }

  async twoFactorEnable(user: any) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    const secret = authenticator.generateSecret();
    await this.authRepository.setUserTwoFactorSecret(user.sub, secret);

    const issuer = this.configService.get<string>('app.name') || 'Academic Platform';
    const label = `${issuer}:${user.email ?? 'admin'}`;
    const otpauthUrl = authenticator.keyuri(user.email ?? 'admin', issuer, secret);

    return {
      enabled: false,
      secret,
      otpauthUrl,
      label,
    };
  }

  async twoFactorVerify(user: any, code: string) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    const twoFactor = await this.authRepository.getUserTwoFactor(user.sub);
    if (!twoFactor?.twoFactorSecret) {
      throw new TwoFactorSetupNotStartedException();
    }

    const ok = verifyTotpCode(twoFactor.twoFactorSecret, code);
    if (!ok) {
      throw new InvalidTwoFactorCodeException();
    }

    await this.authRepository.enableUserTwoFactor(user.sub);
    return { enabled: true };
  }

  async twoFactorDisable(user: any) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    await this.authRepository.disableUserTwoFactor(user.sub);
    return { enabled: false };
  }

  async backupCodesStatus(user: any) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    const remaining = await this.authRepository.countUnusedBackupCodes(user.sub);
    return { remaining };
  }

  async backupCodesGenerate(user: any) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    const codes = generateBackupCodes(10);
    const rounds = Number(this.configService.get('auth.bcryptRounds') ?? 12);
    const hashed = await Promise.all(
      codes.map(async (plain) => bcrypt.hash(hashBackupCode(user.sub, plain), rounds))
    );

    await this.authRepository.replaceUserBackupCodes(user.sub, hashed);

    return {
      codes,
      count: codes.length,
      message: 'Backup codes generated. Store them securely; they will not be shown again.',
    };
  }

  async backupCodesRegenerate(user: any) {
    return this.backupCodesGenerate(user);
  }
}
