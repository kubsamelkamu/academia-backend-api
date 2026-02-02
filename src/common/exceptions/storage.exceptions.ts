import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

export class CloudinaryNotConfiguredException extends InternalServerErrorException {
  constructor(message = 'Cloudinary is not configured') {
    super(message);
  }
}

export class CloudinaryUploadFailedException extends BadRequestException {
  constructor(message = 'Upload failed') {
    super(message);
  }
}

export class InvalidCloudinaryResponseException extends InternalServerErrorException {
  constructor(message = 'Invalid Cloudinary response') {
    super(message);
  }
}
