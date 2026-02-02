import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import {
  CloudinaryNotConfiguredException,
  CloudinaryUploadFailedException,
  InvalidCloudinaryResponseException,
} from '../../common/exceptions';

@Injectable()
export class CloudinaryService {
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('storage.cloudinaryCloudName');
    const apiKey = this.configService.get<string>('storage.cloudinaryApiKey');
    const apiSecret = this.configService.get<string>('storage.cloudinaryApiSecret');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
      this.isConfigured = true;
    }
  }

  async uploadAdminAvatar(params: {
    userId: string;
    buffer: Buffer;
    folder?: string;
  }): Promise<{ secureUrl: string; publicId: string }> {
    if (!this.isConfigured) {
      throw new CloudinaryNotConfiguredException();
    }

    const folder = params.folder ?? 'academic-platform/admin/avatars';
    const publicId = `admin_avatar_${params.userId}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          overwrite: true,
          resource_type: 'image',
          format: 'webp',
          transformation: [
            {
              width: 512,
              height: 512,
              crop: 'limit',
            },
          ],
        },
        (error, result) => {
          if (error) {
            return reject(new CloudinaryUploadFailedException(error.message ?? 'Upload failed'));
          }
          if (!result?.secure_url || !result.public_id) {
            return reject(new InvalidCloudinaryResponseException());
          }

          resolve({ secureUrl: result.secure_url, publicId: result.public_id });
        }
      );

      uploadStream.end(params.buffer);
    });
  }

  async deleteByPublicId(publicId: string): Promise<void> {
    if (!this.isConfigured) {
      throw new CloudinaryNotConfiguredException();
    }
    if (!publicId) return;

    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  }
}
