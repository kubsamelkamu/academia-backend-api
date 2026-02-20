import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { InvitationsService } from './invitations.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@ApiTags('Invitations')
@Controller({ path: 'invitations', version: '1' })
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Public()
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an invitation (create user + assign role)' })
  @ApiBadRequestResponse({
    description: 'Invalid token, expired/revoked invitation, or email already in use',
    schema: {
      example: {
        success: false,
        message: 'Invitation has expired',
        error: { code: 'BADREQUEST' },
        timestamp: '2026-02-20T08:34:06.948Z',
        path: '/api/v1/invitations/accept',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted',
    schema: {
      example: {
        success: true,
        message: 'Success',
        data: {
          id: 'user-id',
          tenantId: 'tenant-id',
          email: 'newuser@university.edu',
        },
        timestamp: '2026-02-20T08:34:06.948Z',
      },
    },
  })
  async accept(@Body() dto: AcceptInvitationDto) {
    return this.invitations.acceptInvitation({
      token: dto.token,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
  }
}
