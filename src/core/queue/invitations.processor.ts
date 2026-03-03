import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bull';
import { randomBytes } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ROLES } from '../../common/constants/roles.constants';
import { buildInvitationEmailContent } from '../../modules/invitations/invitation-email-content';

type BulkInviteStudentsJobData = {
  tenantId: string;
  inviterId: string;
  departmentId: string;
  invites: Array<{ email: string; firstName: string; lastName: string }>;
  customSubject?: string;
  customMessage?: string;
};

@Injectable()
@Processor('invitations')
export class InvitationsProcessor {
  private readonly logger = new Logger(InvitationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService
  ) {
    this.logger.log('InvitationsProcessor initialized (invitations queue worker active)');
  }

  @Process('bulk-invite-students')
  async handleBulkInviteStudents(job: Job<BulkInviteStudentsJobData>) {
    const { tenantId, inviterId, departmentId } = job.data;
    const rawInvites = Array.isArray(job.data.invites) ? job.data.invites : [];
    const customSubject = job.data.customSubject;
    const customMessage = job.data.customMessage;

    const now = new Date();

    job.progress({ step: 'validating', requested: rawInvites.length });

    if (!tenantId || !inviterId || !departmentId) {
      throw new Error('Invalid job payload');
    }
    if (rawInvites.length === 0) {
      throw new Error('At least one invite is required');
    }
    if (rawInvites.length > 50) {
      throw new Error('Bulk invite supports a maximum of 50 invites per job');
    }

    const normalizedInvites = rawInvites
      .map((i) => ({
        email: (i?.email ?? '').trim().toLowerCase(),
        firstName: (i?.firstName ?? '').trim(),
        lastName: (i?.lastName ?? '').trim(),
      }))
      .filter((i) => i.email);

    if (normalizedInvites.length === 0) {
      throw new Error('At least one valid invite is required');
    }

    for (const inv of normalizedInvites) {
      if (!inv.firstName) throw new Error('Each invite must include firstName');
      if (!inv.lastName) throw new Error('Each invite must include lastName');
    }

    const seen = new Set<string>();
    const uniqueInvites: Array<{ email: string; firstName: string; lastName: string }> = [];
    const duplicates: string[] = [];
    for (const inv of normalizedInvites) {
      if (seen.has(inv.email)) {
        duplicates.push(inv.email);
        continue;
      }
      seen.add(inv.email);
      uniqueInvites.push(inv);
    }

    const uniqueEmails = uniqueInvites.map((i) => i.email);

    job.progress({ step: 'lookup', unique: uniqueEmails.length });

    const existingUsers = await this.prisma.user.findMany({
      where: {
        tenantId,
        email: { in: uniqueEmails },
      },
      select: { email: true },
    });
    const existingEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    const toInvite = uniqueInvites.filter((i) => !existingEmailSet.has(i.email));

    const expiryDays = this.config.get<number>('email.invitationExpiryDays') || 7;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    const role = await this.prisma.role.findFirst({ where: { name: ROLES.STUDENT } });
    if (!role) {
      throw new Error(`Role not found: ${ROLES.STUDENT}`);
    }

    job.progress({ step: 'create', toInvite: toInvite.length });

    const createdInvitations = await this.prisma.$transaction(async (tx) => {
      if (toInvite.length > 0) {
        await tx.invitation.updateMany({
          where: {
            tenantId,
            departmentId,
            email: { in: toInvite.map((i) => i.email) },
            roleId: role.id,
            status: 'PENDING',
          },
          data: { status: 'REVOKED', revokedAt: now, revokedById: inviterId },
        });
      }

      const results: Array<{
        id: string;
        tenantId: string;
        departmentId: string | null;
        email: string;
        inviteeFirstName: string | null;
        inviteeLastName: string | null;
        token: string;
        status: string;
        expiresAt: Date;
      }> = [];

      for (const invite of toInvite) {
        const token = randomBytes(32).toString('hex');
        const createdInvitation = await tx.invitation.create({
          data: {
            tenantId,
            departmentId,
            email: invite.email,
            inviteeFirstName: invite.firstName,
            inviteeLastName: invite.lastName,
            roleId: role.id,
            token,
            status: 'PENDING',
            expiresAt,
            invitedById: inviterId,
          },
          select: {
            id: true,
            tenantId: true,
            departmentId: true,
            email: true,
            inviteeFirstName: true,
            inviteeLastName: true,
            token: true,
            status: true,
            expiresAt: true,
          },
        });
        results.push(createdInvitation);
      }

      return results;
    });

    job.progress({ step: 'email', created: createdInvitations.length });

    const frontendBase = (
      this.config.get<string>('app.frontendUrl') || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const templateId = this.config.get<number>('email.invitationTemplateId');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, domain: true },
    });
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true },
    });

    const loginUrl = tenant?.domain
      ? `${frontendBase}/login?tenantDomain=${encodeURIComponent(tenant.domain)}`
      : `${frontendBase}/login`;

    const sendFailures: Array<{ email: string; reason: string }> = [];
    let sent = 0;

    for (const inv of createdInvitations) {
      const acceptUrl = `${frontendBase}/invitations/accept?token=${inv.token}`;
      const to = { email: inv.email };

      const built = buildInvitationEmailContent({
        commonTemplateParams: this.email.getCommonTemplateParams(),
        tenantName: tenant?.name ?? 'Academia',
        tenantDomain: tenant?.domain ?? undefined,
        inviteeFirstName: inv.inviteeFirstName ?? undefined,
        inviteeLastName: inv.inviteeLastName ?? undefined,
        roleName: ROLES.STUDENT,
        departmentName: department?.name ?? undefined,
        acceptUrl,
        loginUrl,
        expiresAt: inv.expiresAt,
        customSubject,
        customMessage,
      });

      try {
        if (templateId) {
          await this.email.sendTransactionalTemplateEmail({
            to,
            templateId,
            params: built.templateParams,
          });
        } else {
          await this.email.sendTransactionalEmail({
            to,
            subject: built.subject,
            htmlContent: built.htmlContent,
            textContent: built.textContent,
          });
        }
        sent += 1;
        try {
          await this.prisma.invitation.update({
            where: { id: inv.id },
            data: {
              lastSentAt: new Date(),
              sendCount: { increment: 1 },
              lastSendError: null,
            },
          });
        } catch {
          // Best-effort audit update.
        }
        job.progress({ step: 'email', sent, total: createdInvitations.length });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        sendFailures.push({ email: inv.email, reason });
        this.logger.warn(`BulkInvite: email send failed to=${inv.email} (${reason})`);
        try {
          await this.prisma.invitation.update({
            where: { id: inv.id },
            data: { lastSendError: reason.slice(0, 500) },
          });
        } catch {
          // Best-effort audit update.
        }
      }
    }

    job.progress({ step: 'done', sent, failures: sendFailures.length });

    const refreshed = await this.prisma.invitation.findMany({
      where: { id: { in: createdInvitations.map((i) => i.id) } },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        email: true,
        inviteeFirstName: true,
        inviteeLastName: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        acceptedAt: true,
        revokedAt: true,
        lastSentAt: true,
        sendCount: true,
        lastSendError: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      requested: rawInvites.length,
      unique: uniqueEmails.length,
      created: createdInvitations.length,
      skippedExisting: uniqueEmails.length - toInvite.length,
      duplicates,
      sendFailures,
      invitations: refreshed.map((inv) => ({
        id: inv.id,
        tenantId: inv.tenantId,
        departmentId: inv.departmentId,
        email: inv.email,
        firstName: inv.inviteeFirstName,
        lastName: inv.inviteeLastName,
        roleName: ROLES.STUDENT,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        acceptedAt: inv.acceptedAt,
        revokedAt: inv.revokedAt,
        lastSentAt: inv.lastSentAt,
        sendCount: inv.sendCount,
        lastSendError: inv.lastSendError,
      })),
    };
  }
}
