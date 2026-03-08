import { Injectable, NotFoundException } from '@nestjs/common';

import { ROLES } from '../../common/constants/roles.constants';
import { InsufficientPermissionsException, UnauthorizedAccessException } from '../../common/exceptions';
import { AuthRepository } from '../auth/auth.repository';

import { StudentProfileRepository } from './student-profile.repository';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';

@Injectable()
export class StudentProfileService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly studentProfileRepository: StudentProfileRepository
  ) {}

  private async requireDbUser(user: any) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const dbUser = await this.authRepository.findUserById(user.sub);
    if (!dbUser) {
      throw new UnauthorizedAccessException();
    }

    // Defensive tenant check in case of mismatched/legacy tokens.
    if (user.tenantId && user.tenantId !== 'system' && dbUser.tenantId !== user.tenantId) {
      throw new UnauthorizedAccessException();
    }

    return dbUser;
  }

  async getMyStudentProfile(user: any) {
    const dbUser = await this.requireDbUser(user);

    const roles: string[] = user?.roles ?? [];
    if (!roles.includes(ROLES.STUDENT)) {
      throw new InsufficientPermissionsException('Only students can access student profile');
    }

    const profile = await this.studentProfileRepository.findByUserId(dbUser.id);

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        avatarUrl: dbUser.avatarUrl,
        tenantId: dbUser.tenantId,
      },
      profile: {
        bio: profile?.bio ?? null,
        githubUrl: profile?.githubUrl ?? null,
        linkedinUrl: profile?.linkedinUrl ?? null,
        portfolioUrl: profile?.portfolioUrl ?? null,
        techStack: (profile?.techStack as string[] | null) ?? [],
        updatedAt: profile?.updatedAt ?? null,
      },
    };
  }

  async updateMyStudentProfile(user: any, dto: UpdateStudentProfileDto) {
    const dbUser = await this.requireDbUser(user);

    const roles: string[] = user?.roles ?? [];
    if (!roles.includes(ROLES.STUDENT)) {
      throw new InsufficientPermissionsException('Only students can update student profile');
    }

    const profile = await this.studentProfileRepository.upsertByUserId(dbUser.tenantId, dbUser.id, {
      bio: dto.bio,
      githubUrl: dto.githubUrl,
      linkedinUrl: dto.linkedinUrl,
      portfolioUrl: dto.portfolioUrl,
      techStack: dto.techStack,
    });

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        avatarUrl: dbUser.avatarUrl,
        tenantId: dbUser.tenantId,
      },
      profile: {
        bio: profile.bio ?? null,
        githubUrl: profile.githubUrl ?? null,
        linkedinUrl: profile.linkedinUrl ?? null,
        portfolioUrl: profile.portfolioUrl ?? null,
        techStack: (profile.techStack as string[] | null) ?? [],
        updatedAt: profile.updatedAt,
      },
    };
  }

  async getStudentPublicProfile(viewer: any, studentId: string) {
    if (!viewer?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const studentUser = await this.authRepository.findUserById(studentId);
    if (!studentUser || studentUser.deletedAt) {
      throw new NotFoundException('Student not found');
    }

    // Same-tenant visibility (Step 2 = A).
    if (studentUser.tenantId !== viewer.tenantId) {
      throw new InsufficientPermissionsException('Student profile is not accessible');
    }

    const roleNames = studentUser.roles.map((ur: { role: { name: string } }) => ur.role.name);
    if (!roleNames.includes(ROLES.STUDENT)) {
      throw new NotFoundException('Student not found');
    }

    const profile = await this.studentProfileRepository.findByUserId(studentUser.id);

    return {
      user: {
        id: studentUser.id,
        firstName: studentUser.firstName,
        lastName: studentUser.lastName,
        avatarUrl: studentUser.avatarUrl,
        tenantId: studentUser.tenantId,
      },
      profile: {
        bio: profile?.bio ?? null,
        githubUrl: profile?.githubUrl ?? null,
        linkedinUrl: profile?.linkedinUrl ?? null,
        portfolioUrl: profile?.portfolioUrl ?? null,
        techStack: (profile?.techStack as string[] | null) ?? [],
      },
    };
  }
}
