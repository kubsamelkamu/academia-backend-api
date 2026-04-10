import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { createHash, randomBytes } from 'crypto';
import {
  CloudinaryNotConfiguredException,
  CloudinaryUploadFailedException,
  InvalidCloudinaryResponseException,
} from '../../common/exceptions';

@Injectable()
export class CloudinaryService {
  private isConfigured = false;

  private createCompactPublicId(prefix: string, segments: string[]): string {
    const compactSegments = segments.map((segment) => this.compactSegment(segment));
    const fingerprint = createHash('sha1')
      .update(segments.join('|'))
      .digest('hex')
      .slice(0, 12);
    const nonce = randomBytes(4).toString('hex');

    return `${prefix}_${compactSegments.join('_')}_${Date.now()}_${fingerprint}_${nonce}`;
  }

  private compactSegment(segment: string): string {
    return segment.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'x';
  }

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

  async uploadUserAvatar(params: {
    userId: string;
    buffer: Buffer;
    folder?: string;
  }): Promise<{ secureUrl: string; publicId: string }> {
    if (!this.isConfigured) {
      throw new CloudinaryNotConfiguredException();
    }

    const folder = params.folder ?? 'academic-platform/users/avatars';
    const publicId = `user_avatar_${params.userId}`;

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

  async uploadTenantVerificationDocument(params: {
    tenantId: string;
    userId: string;
    buffer: Buffer;
    mimeType?: string;
    fileName?: string;
    folder?: string;
  }): Promise<{ secureUrl: string; publicId: string; resourceType: 'image' | 'raw' }> {
    if (!this.isConfigured) {
      throw new CloudinaryNotConfiguredException();
    }

    const mime = (params.mimeType ?? '').trim().toLowerCase();
    const isImage = mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/jpg';
    const isPdf = mime === 'application/pdf';

    // Allow raw upload (PDF) and basic images (JPG/PNG). Controller-level fileFilter should enforce too.
    if (mime && !isImage && !isPdf) {
      throw new CloudinaryUploadFailedException(
        `Unsupported document type. Allowed: PDF, JPG, PNG. Got: ${mime}`
      );
    }

    const folder = params.folder ?? 'academic-platform/tenant-verification/documents';
    const publicId = this.createCompactPublicId('tenant_verification', [
      params.tenantId,
      params.userId,
    ]);

    const resourceType: 'image' | 'raw' = isImage ? 'image' : 'raw';

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          overwrite: false,
          resource_type: resourceType,
          // NOTE: we intentionally do not transform/convert verification documents.
          // For images, keeping original helps avoid accidental data loss.
        },
        (error, result) => {
          if (error) {
            return reject(new CloudinaryUploadFailedException(error.message ?? 'Upload failed'));
          }
          if (!result?.secure_url || !result.public_id) {
            return reject(new InvalidCloudinaryResponseException());
          }

          resolve({ secureUrl: result.secure_url, publicId: result.public_id, resourceType });
        }
      );

      uploadStream.end(params.buffer);
    });
  }

  async uploadDepartmentDocumentTemplateFile(params: {
    tenantId: string;
    departmentId: string;
    userId: string;
    buffer: Buffer;
    mimeType?: string;
    fileName?: string;
    folder?: string;
  }): Promise<{ secureUrl: string; publicId: string; resourceType: 'raw' }> {
    if (!this.isConfigured) {
      throw new CloudinaryNotConfiguredException();
    }

    const mime = (params.mimeType ?? '').trim().toLowerCase();
    const isPdf = mime === 'application/pdf';
    const isDocx =
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Allow raw upload (PDF/DOCX). Controller-level fileFilter should enforce too.
    if (mime && !isPdf && !isDocx) {
      throw new CloudinaryUploadFailedException(
        `Unsupported document type. Allowed: PDF, DOCX. Got: ${mime}`
      );
    }

    const folder = params.folder ?? 'academic-platform/departments/document-templates';
    const publicId = this.createCompactPublicId('dept_doc_template', [
      params.tenantId,
      params.departmentId,
      params.userId,
    ]);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          overwrite: false,
          resource_type: 'raw',
          // NOTE: we intentionally do not transform/convert template documents.
        },
        (error, result) => {
          if (error) {
            return reject(new CloudinaryUploadFailedException(error.message ?? 'Upload failed'));
          }
          if (!result?.secure_url || !result.public_id) {
            return reject(new InvalidCloudinaryResponseException());
          }

          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
            resourceType: 'raw',
          });
        }
      );

      uploadStream.end(params.buffer);
    });
  }

  async uploadMilestoneSubmissionFile(params: {
    tenantId: string;
    projectId: string;
    milestoneId: string;
    userId: string;
    buffer: Buffer;
    mimeType?: string;
    fileName?: string;
    folder?: string;
  }): Promise<{ secureUrl: string; publicId: string; resourceType: 'raw' }> {
    if (!this.isConfigured) {
      throw new CloudinaryNotConfiguredException();
    }

    const mime = (params.mimeType ?? '').trim().toLowerCase();
    const isPdf = mime === 'application/pdf';
    const isDocx =
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Allow raw upload (PDF/DOCX). Controller-level fileFilter should enforce too.
    if (mime && !isPdf && !isDocx) {
      throw new CloudinaryUploadFailedException(
        `Unsupported document type. Allowed: PDF, DOCX. Got: ${mime}`
      );
    }

    const folder = params.folder ?? 'academic-platform/projects/milestones/submissions';
    const publicId = this.createCompactPublicId('milestone_submission', [
      params.tenantId,
      params.projectId,
      params.milestoneId,
      params.userId,
    ]);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          overwrite: false,
          resource_type: 'raw',
        },
        (error, result) => {
          if (error) {
            return reject(new CloudinaryUploadFailedException(error.message ?? 'Upload failed'));
          }
          if (!result?.secure_url || !result.public_id) {
            return reject(new InvalidCloudinaryResponseException());
          }

          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
            resourceType: 'raw',
          });
        }
      );

      uploadStream.end(params.buffer);
    });
  }

  async uploadMilestoneFeedbackAttachment(params: {
    tenantId: string;
    projectId: string;
    milestoneId: string;
    submissionId: string;
    userId: string;
    buffer: Buffer;
    mimeType?: string;
    fileName?: string;
    folder?: string;
  }): Promise<{ secureUrl: string; publicId: string; resourceType: 'raw' }> {
    if (!this.isConfigured) {
      throw new CloudinaryNotConfiguredException();
    }

    const mime = (params.mimeType ?? '').trim().toLowerCase();
    const isPdf = mime === 'application/pdf';
    const isDocx =
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (mime && !isPdf && !isDocx) {
      throw new CloudinaryUploadFailedException(
        `Unsupported document type. Allowed: PDF, DOCX. Got: ${mime}`
      );
    }

    const folder = params.folder ?? 'academic-platform/projects/milestones/feedbacks';
    const publicId = this.createCompactPublicId('milestone_feedback', [
      params.tenantId,
      params.projectId,
      params.milestoneId,
      params.submissionId,
      params.userId,
    ]);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          overwrite: false,
          resource_type: 'raw',
        },
        (error, result) => {
          if (error) {
            return reject(new CloudinaryUploadFailedException(error.message ?? 'Upload failed'));
          }
          if (!result?.secure_url || !result.public_id) {
            return reject(new InvalidCloudinaryResponseException());
          }

          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
            resourceType: 'raw',
          });
        }
      );

      uploadStream.end(params.buffer);
    });
  }

  async uploadProposalPdf(params: {
    tenantId: string;
    departmentId: string;
    proposalId: string;
    userId: string;
    buffer: Buffer;
    mimeType?: string;
    fileName?: string;
    folder?: string;
  }): Promise<{ secureUrl: string; publicId: string; resourceType: 'raw' }> {
    if (!this.isConfigured) {
      throw new CloudinaryNotConfiguredException();
    }

    const mime = (params.mimeType ?? '').trim().toLowerCase();
    const isPdf = mime === 'application/pdf';
    if (mime && !isPdf) {
      throw new CloudinaryUploadFailedException(
        `Unsupported document type. Allowed: PDF. Got: ${mime}`
      );
    }

    const folder = params.folder ?? 'academic-platform/proposals/documents';
    const publicId = this.createCompactPublicId('proposal_pdf', [
      params.tenantId,
      params.departmentId,
      params.proposalId,
      params.userId,
    ]);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          overwrite: false,
          resource_type: 'raw',
        },
        (error, result) => {
          if (error) {
            return reject(new CloudinaryUploadFailedException(error.message ?? 'Upload failed'));
          }
          if (!result?.secure_url || !result.public_id) {
            return reject(new InvalidCloudinaryResponseException());
          }

          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
            resourceType: 'raw',
          });
        }
      );

      uploadStream.end(params.buffer);
    });
  }

  async uploadProjectGroupAnnouncementAttachment(params: {
    tenantId: string;
    projectGroupId: string;
    userId: string;
    buffer: Buffer;
    mimeType?: string;
    fileName?: string;
    folder?: string;
  }): Promise<{ secureUrl: string; publicId: string; resourceType: 'image' | 'raw' }> {
    if (!this.isConfigured) {
      throw new CloudinaryNotConfiguredException();
    }

    const mime = (params.mimeType ?? '').trim().toLowerCase();
    const isImage = mime.startsWith('image/');
    const isPdf = mime === 'application/pdf';
    const isDocx =
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isPptx =
      mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    const isXlsx = mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const isZip = mime === 'application/zip' || mime === 'application/x-zip-compressed';

    // Controller-level fileFilter should enforce too.
    if (mime && !isImage && !isPdf && !isDocx && !isPptx && !isXlsx && !isZip) {
      throw new CloudinaryUploadFailedException(
        `Unsupported attachment type. Allowed: PDF, DOCX, PPTX, XLSX, ZIP, images. Got: ${mime}`
      );
    }

    const folder = params.folder ?? 'academic-platform/project-groups/announcements';
    const publicId = this.createCompactPublicId('group_announcement', [
      params.tenantId,
      params.projectGroupId,
      params.userId,
    ]);

    const resourceType: 'image' | 'raw' = isImage ? 'image' : 'raw';

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          overwrite: false,
          resource_type: resourceType,
        },
        (error, result) => {
          if (error) {
            return reject(new CloudinaryUploadFailedException(error.message ?? 'Upload failed'));
          }
          if (!result?.secure_url || !result.public_id) {
            return reject(new InvalidCloudinaryResponseException());
          }

          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
            resourceType,
          });
        }
      );

      uploadStream.end(params.buffer);
    });
  }

  async uploadProjectGroupChatAttachment(params: {
    tenantId: string;
    projectGroupId: string;
    userId: string;
    buffer: Buffer;
    mimeType?: string;
    fileName?: string;
    folder?: string;
  }): Promise<{ secureUrl: string; publicId: string; resourceType: 'image' | 'raw' }> {
    if (!this.isConfigured) {
      throw new CloudinaryNotConfiguredException();
    }

    const mime = (params.mimeType ?? '').trim().toLowerCase();
    const isImage = mime.startsWith('image/');
    const isPdf = mime === 'application/pdf';
    const isDocx =
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Controller-level fileFilter should enforce too.
    if (mime && !isImage && !isPdf && !isDocx) {
      throw new CloudinaryUploadFailedException(
        `Unsupported attachment type. Allowed: PDF, DOCX, images. Got: ${mime}`
      );
    }

    const folder = params.folder ?? 'academic-platform/project-groups/chat';
    const publicId = this.createCompactPublicId('group_chat', [
      params.tenantId,
      params.projectGroupId,
      params.userId,
    ]);

    const resourceType: 'image' | 'raw' = isImage ? 'image' : 'raw';

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          overwrite: false,
          resource_type: resourceType,
        },
        (error, result) => {
          if (error) {
            return reject(new CloudinaryUploadFailedException(error.message ?? 'Upload failed'));
          }
          if (!result?.secure_url || !result.public_id) {
            return reject(new InvalidCloudinaryResponseException());
          }

          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
            resourceType,
          });
        }
      );

      uploadStream.end(params.buffer);
    });
  }

  async uploadTenantLogo(params: {
    tenantId: string;
    buffer: Buffer;
    folder?: string;
  }): Promise<{ secureUrl: string; publicId: string }> {
    if (!this.isConfigured) {
      throw new CloudinaryNotConfiguredException();
    }

    const folder = params.folder ?? 'academic-platform/tenants/logos';
    const publicId = `tenant_logo_${params.tenantId}`;

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

  async deleteByPublicId(
    publicId: string,
    resourceType: 'image' | 'raw' | 'video' = 'image'
  ): Promise<void> {
    if (!this.isConfigured) {
      throw new CloudinaryNotConfiguredException();
    }
    if (!publicId) return;

    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  }
}
