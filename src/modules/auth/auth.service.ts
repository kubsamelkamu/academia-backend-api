import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';
import {
  InvalidCredentialsException,
  UserNotFoundException,
  AccountInactiveException,
  TenantInactiveException,
  InvalidRefreshTokenException,
  PasswordNotSetException,
  IncorrectPasswordException,
} from '../../common/exceptions';

type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

const asJwtExpiresIn = (value: unknown): JwtExpiresIn => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return '15m' as JwtExpiresIn;
    const maybeNumber = Number(trimmed);
    if (!Number.isNaN(maybeNumber) && Number.isFinite(maybeNumber)) {
      return maybeNumber;
    }
    return trimmed as JwtExpiresIn;
  }
  return '15m' as JwtExpiresIn;
};

@Injectable()
export class AuthService {
  constructor(
    private authRepository: AuthRepository,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  async validateUser(email: string, password: string, tenantDomain?: string): Promise<any> {
    const domain = (tenantDomain?.trim() || 'system').toLowerCase();

    const tenant = await this.authRepository.findTenantByDomain(domain);

    if (!tenant) {
      throw new InvalidCredentialsException();
    }

    const user = await this.authRepository.findUserByEmailAndTenant(email, tenant.id);

    if (!user) {
      throw new InvalidCredentialsException();
    }

    if (!user.hashedPassword) {
      throw new InvalidCredentialsException();
    }

    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);

    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    if (user.status !== 'ACTIVE') {
      throw new AccountInactiveException();
    }

    // Check tenant status (skip only for system tenant)
    if (user.tenant.domain !== 'system' && user.tenant.status !== 'ACTIVE') {
      throw new TenantInactiveException();
    }

    // When logging into the system tenant, require PlatformAdmin role
    if (
      user.tenant.domain === 'system' &&
      !user.roles.some((ur: { role: { name: string } }) => ur.role.name === 'PlatformAdmin')
    ) {
      throw new InvalidCredentialsException();
    }

    return user;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password, loginDto.tenantDomain);

    // Update last login
    await this.authRepository.updateUserLastLogin(user.id);

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId || 'system',
      roles: user.roles.map((ur: { role: { name: string } }) => ur.role.name),
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
      expiresIn: asJwtExpiresIn(this.configService.get('auth.refreshExpiresIn')),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        roles: user.roles.map((ur: { role: { name: string } }) => ur.role.name),
        tenantId: user.tenantId,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
      });

      const user = await this.authRepository.findUserById(payload.sub);

      if (!user || user.status !== 'ACTIVE') {
        throw new UserNotFoundException('User not found or inactive');
      }

      const newPayload = {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId || 'system',
        roles: user.roles.map((ur: { role: { name: string } }) => ur.role.name),
      };

      const newAccessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
        expiresIn: asJwtExpiresIn(this.configService.get('auth.refreshExpiresIn')),
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new InvalidRefreshTokenException();
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new UserNotFoundException();
    }

    if (!user.hashedPassword) {
      throw new PasswordNotSetException();
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.hashedPassword);

    if (!isPasswordValid) {
      throw new IncorrectPasswordException();
    }

    const rounds = this.configService.getOrThrow<number>('auth.bcryptRounds');
    const hashedPassword = await bcrypt.hash(newPassword, rounds);

    await this.authRepository.updateUserPassword(userId, hashedPassword);

    return { message: 'Password changed successfully' };
  }

  async registerInstitution(registerDto: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    universityName: string;
    departmentName: string;
    departmentCode: string;
    departmentDescription?: string;
  }) {
    // Check if email already exists globally
    const existingUser = await this.authRepository.findUserByEmailGlobally(registerDto.email);
    if (existingUser) {
      throw new InvalidCredentialsException('Email already registered');
    }

    // Generate unique domain from university name
    const baseDomain = registerDto.universityName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);

    let domain = baseDomain;
    let counter = 1;

    // Ensure domain uniqueness
    while (await this.authRepository.findTenantByDomain(domain)) {
      domain = `${baseDomain}${counter}`;
      counter++;
      if (counter > 100) {
        throw new Error('Unable to generate unique domain for institution');
      }
    }

    // Hash password
    const rounds = this.configService.getOrThrow<number>('auth.bcryptRounds');
    const hashedPassword = await bcrypt.hash(registerDto.password, rounds);

    // Create institution (tenant), department, and department head in a transaction
    const result = await this.authRepository.createInstitutionWithDepartmentHead({
      // Tenant data
      tenantName: registerDto.universityName,
      tenantDomain: domain,

      // Department data
      departmentName: registerDto.departmentName,
      departmentCode: registerDto.departmentCode,
      departmentDescription: registerDto.departmentDescription,

      // User data
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      hashedPassword,
    });

    return {
      institution: {
        id: result.tenant.id,
        name: result.tenant.name,
        domain: result.tenant.domain,
      },
      department: {
        id: result.department.id,
        name: result.department.name,
        code: result.department.code,
      },
      departmentHead: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: 'DepartmentHead',
      },
      nextSteps: [
        'Your institution has been created successfully',
        'You can now login with your email and password',
        'Start managing your department users and academic projects'
      ],
    };
  }
}
