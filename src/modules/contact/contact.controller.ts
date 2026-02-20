import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { ContactDto } from './dto/contact.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Contact')
@Controller({ path: 'contact', version: '1' })
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send contact email' })
  @ApiResponse({
    status: 200,
    description: 'Contact request queued successfully',
    schema: {
      example: {
        success: true,
        message: 'Success',
        data: null,
        timestamp: '2026-02-17T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation error',
  })
  async sendContactEmail(@Body() contactDto: ContactDto): Promise<null> {
    await this.contactService.sendContactEmail(contactDto);
    return null;
  }
}
