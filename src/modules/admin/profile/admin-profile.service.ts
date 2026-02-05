import { Injectable } from '@nestjs/common';
import { AuthRepository } from '../../auth/auth.repository';
import { AuthService } from '../../auth/auth.service';
import { ROLES } from '../../../common/constants/roles.constants';
import { CloudinaryService } from '../../../core/storage/cloudinary.service';
import {
  AvatarFileRequiredException,
  InsufficientPermissionsException,
  UnauthorizedAccessException,
} from '../../../common/exceptions';

@Injectable()
export class AdminProfileService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly authService: AuthService
  ) {}

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
      tenantId: dbUser.tenantId,
      roles: dbUser.roles.map((ur: { role: { name: string } }) => ur.role.name),
      lastLoginAt: dbUser.lastLoginAt,
    };
  }

  async uploadAvatar(user: any, file: Express.Multer.File) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    if (!file?.buffer?.length) {
      throw new AvatarFileRequiredException();
    }

    const dbUser = await this.authRepository.findUserById(user.sub);
    if (!dbUser) {
      throw new UnauthorizedAccessException();
    }

    const oldPublicId = dbUser.avatarPublicId;

    const uploaded = await this.cloudinaryService.uploadAdminAvatar({
      userId: dbUser.id,
      buffer: file.buffer,
    });

    try {
      await this.authRepository.updateUserAvatar(dbUser.id, {
        avatarUrl: uploaded.secureUrl,
        avatarPublicId: uploaded.publicId,
      });
    } catch (e) {
      // DB update failed => remove newly uploaded asset to avoid orphaning.
      await this.cloudinaryService.deleteByPublicId(uploaded.publicId);
      throw e;
    }

    // If we used stable public_id overwrite, oldPublicId should match uploaded.publicId.
    // If oldPublicId differs (in case of historical data), best-effort delete it.
    if (oldPublicId && oldPublicId !== uploaded.publicId) {
      await this.cloudinaryService.deleteByPublicId(oldPublicId);
    }

    return {
      avatarUrl: uploaded.secureUrl,
      avatarPublicId: uploaded.publicId,
    };
  }

  async deleteAvatar(user: any): Promise<void> {
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

    const publicId = dbUser.avatarPublicId;
    if (!publicId) {
      await this.authRepository.updateUserAvatar(dbUser.id, {
        avatarUrl: null,
        avatarPublicId: null,
      });
      return;
    }

    await this.cloudinaryService.deleteByPublicId(publicId);

    await this.authRepository.updateUserAvatar(dbUser.id, {
      avatarUrl: null,
      avatarPublicId: null,
    });
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    return this.authService.changePassword(userId, oldPassword, newPassword);
  }
}
