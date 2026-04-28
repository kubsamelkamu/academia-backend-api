import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ROLES } from '../../common/constants/roles.constants';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CoordinatorAdvisorChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly messageSelect = {
    id: true,
    roomId: true,
    senderUserId: true,
    text: true,
    replyToMessageId: true,
    attachmentUrl: true,
    attachmentPublicId: true,
    attachmentResourceType: true,
    attachmentFileName: true,
    attachmentMimeType: true,
    attachmentSizeBytes: true,
    createdAt: true,
    editedAt: true,
    sender: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    },
    replyTo: {
      select: {
        id: true,
        roomId: true,
        senderUserId: true,
        text: true,
        attachmentUrl: true,
        attachmentPublicId: true,
        attachmentResourceType: true,
        attachmentFileName: true,
        attachmentMimeType: true,
        attachmentSizeBytes: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    },
  } satisfies Prisma.CoordinatorAdvisorChatMessageSelect;

  async findDepartmentAdvisorByUserId(params: {
    tenantId: string;
    departmentId: string;
    advisorUserId: string;
  }) {
    return this.prisma.advisor.findFirst({
      where: {
        userId: params.advisorUserId,
        departmentId: params.departmentId,
        user: {
          tenantId: params.tenantId,
          deletedAt: null,
        },
      },
      select: {
        userId: true,
        departmentId: true,
        user: {
          select: {
            id: true,
            tenantId: true,
            departmentId: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async findDepartmentCoordinatorByUserId(params: {
    tenantId: string;
    departmentId: string;
    coordinatorUserId: string;
  }) {
    return this.prisma.user.findFirst({
      where: {
        id: params.coordinatorUserId,
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        deletedAt: null,
        roles: {
          some: {
            revokedAt: null,
            role: {
              name: ROLES.COORDINATOR,
            },
          },
        },
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });
  }

  async upsertDirectRoom(params: {
    tenantId: string;
    departmentId: string;
    coordinatorUserId: string;
    advisorUserId: string;
  }) {
    return this.prisma.coordinatorAdvisorChatRoom.upsert({
      where: {
        tenantId_coordinatorUserId_advisorUserId: {
          tenantId: params.tenantId,
          coordinatorUserId: params.coordinatorUserId,
          advisorUserId: params.advisorUserId,
        },
      },
      update: {
        departmentId: params.departmentId,
      },
      create: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        coordinatorUserId: params.coordinatorUserId,
        advisorUserId: params.advisorUserId,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        coordinatorUserId: true,
        advisorUserId: true,
        createdAt: true,
      },
    });
  }

  async findRoomById(roomId: string) {
    return this.prisma.coordinatorAdvisorChatRoom.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        coordinatorUserId: true,
        advisorUserId: true,
        createdAt: true,
      },
    });
  }

  async createMessage(params: {
    tenantId: string;
    roomId: string;
    senderUserId: string;
    text?: string | null;
    replyToMessageId?: string | null;
    attachment?: {
      url: string;
      publicId: string;
      resourceType: 'image' | 'raw';
      name?: string;
      mimeType?: string;
      size?: number;
    } | null;
  }) {
    return this.prisma.coordinatorAdvisorChatMessage.create({
      data: {
        tenantId: params.tenantId,
        roomId: params.roomId,
        senderUserId: params.senderUserId,
        text: params.text ?? null,
        replyToMessageId: params.replyToMessageId ?? null,
        attachmentUrl: params.attachment?.url ?? null,
        attachmentPublicId: params.attachment?.publicId ?? null,
        attachmentResourceType: params.attachment?.resourceType ?? null,
        attachmentFileName: params.attachment?.name ?? null,
        attachmentMimeType: params.attachment?.mimeType ?? null,
        attachmentSizeBytes: params.attachment?.size ?? null,
      },
      select: this.messageSelect,
    });
  }

  async findMessageInRoom(params: { tenantId: string; roomId: string; messageId: string }) {
    return this.prisma.coordinatorAdvisorChatMessage.findFirst({
      where: {
        id: params.messageId,
        tenantId: params.tenantId,
        roomId: params.roomId,
      },
      select: {
        id: true,
        roomId: true,
        createdAt: true,
      },
    });
  }

  async findMessageByIdInRoom(params: { tenantId: string; roomId: string; messageId: string }) {
    return this.prisma.coordinatorAdvisorChatMessage.findFirst({
      where: {
        id: params.messageId,
        tenantId: params.tenantId,
        roomId: params.roomId,
      },
      select: this.messageSelect,
    });
  }

  async listMessages(params: { tenantId: string; roomId: string; cursor?: string; take: number }) {
    const baseQuery = {
      where: {
        tenantId: params.tenantId,
        roomId: params.roomId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.take,
      select: this.messageSelect,
    } satisfies Prisma.CoordinatorAdvisorChatMessageFindManyArgs;

    const query = params.cursor
      ? ({
          ...baseQuery,
          cursor: { id: params.cursor },
          skip: 1,
        } satisfies Prisma.CoordinatorAdvisorChatMessageFindManyArgs)
      : baseQuery;

    return this.prisma.coordinatorAdvisorChatMessage.findMany(query);
  }

  async updateMessageText(params: {
    tenantId: string;
    roomId: string;
    messageId: string;
    text: string | null;
    editedAt: Date;
  }) {
    return this.prisma.coordinatorAdvisorChatMessage.update({
      where: {
        id: params.messageId,
      },
      data: {
        text: params.text,
        editedAt: params.editedAt,
      },
      select: this.messageSelect,
    });
  }

  async deleteMessage(params: { tenantId: string; messageId: string }) {
    return this.prisma.coordinatorAdvisorChatMessage.delete({
      where: {
        id: params.messageId,
      },
      select: {
        id: true,
        roomId: true,
      },
    });
  }

  async listUnreadMessageIdsUpTo(params: {
    tenantId: string;
    roomId: string;
    userId: string;
    upToCreatedAt: Date;
  }) {
    const unread = await this.prisma.coordinatorAdvisorChatMessage.findMany({
      where: {
        tenantId: params.tenantId,
        roomId: params.roomId,
        createdAt: {
          lte: params.upToCreatedAt,
        },
        reads: {
          none: {
            userId: params.userId,
          },
        },
      },
      select: {
        id: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return unread.map((message) => message.id);
  }

  async createManyReads(params: {
    tenantId: string;
    roomId: string;
    userId: string;
    messageIds: string[];
    readAt: Date;
  }) {
    if (!params.messageIds.length) return { count: 0 };

    return this.prisma.coordinatorAdvisorChatMessageRead.createMany({
      data: params.messageIds.map((messageId) => ({
        tenantId: params.tenantId,
        roomId: params.roomId,
        messageId,
        userId: params.userId,
        readAt: params.readAt,
      })),
      skipDuplicates: true,
    });
  }

  async getMemberLastReadStates(params: {
    tenantId: string;
    roomId: string;
    memberUserIds: string[];
  }) {
    if (!params.memberUserIds.length) return [];

    return this.prisma.coordinatorAdvisorChatMessageRead.findMany({
      where: {
        tenantId: params.tenantId,
        roomId: params.roomId,
        userId: {
          in: params.memberUserIds,
        },
      },
      orderBy: {
        readAt: 'desc',
      },
      distinct: ['userId'],
      select: {
        userId: true,
        messageId: true,
        readAt: true,
      },
    });
  }

  async listReactionsForMessages(params: {
    tenantId: string;
    roomId: string;
    messageIds: string[];
  }) {
    if (!params.messageIds.length) return [];

    return this.prisma.coordinatorAdvisorChatMessageReaction.findMany({
      where: {
        tenantId: params.tenantId,
        roomId: params.roomId,
        messageId: {
          in: params.messageIds,
        },
      },
      select: {
        messageId: true,
        userId: true,
        emoji: true,
        createdAt: true,
      },
    });
  }

  async setReaction(params: {
    tenantId: string;
    roomId: string;
    messageId: string;
    userId: string;
    emoji: string;
  }) {
    return this.prisma.coordinatorAdvisorChatMessageReaction.upsert({
      where: {
        messageId_userId: {
          messageId: params.messageId,
          userId: params.userId,
        },
      },
      create: {
        tenantId: params.tenantId,
        roomId: params.roomId,
        messageId: params.messageId,
        userId: params.userId,
        emoji: params.emoji,
      },
      update: {
        emoji: params.emoji,
      },
      select: {
        messageId: true,
        userId: true,
        emoji: true,
        createdAt: true,
      },
    });
  }

  async removeReaction(params: {
    tenantId: string;
    roomId: string;
    messageId: string;
    userId: string;
  }) {
    return this.prisma.coordinatorAdvisorChatMessageReaction.deleteMany({
      where: {
        tenantId: params.tenantId,
        roomId: params.roomId,
        messageId: params.messageId,
        userId: params.userId,
      },
    });
  }

  async listPinsForRoom(params: { tenantId: string; roomId: string }) {
    return this.prisma.coordinatorAdvisorChatPinnedMessage.findMany({
      where: {
        tenantId: params.tenantId,
        roomId: params.roomId,
      },
      orderBy: {
        pinnedAt: 'desc',
      },
      select: {
        messageId: true,
        pinnedByUserId: true,
        pinnedAt: true,
        pinnedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        message: {
          select: this.messageSelect,
        },
      },
    });
  }

  async listPinnedMessageIds(params: { tenantId: string; roomId: string; messageIds: string[] }) {
    if (!params.messageIds.length) return [];

    const rows = await this.prisma.coordinatorAdvisorChatPinnedMessage.findMany({
      where: {
        tenantId: params.tenantId,
        roomId: params.roomId,
        messageId: {
          in: params.messageIds,
        },
      },
      select: {
        messageId: true,
      },
    });

    return rows.map((row) => row.messageId);
  }

  async addPin(params: {
    tenantId: string;
    roomId: string;
    messageId: string;
    pinnedByUserId: string;
    pinnedAt: Date;
  }) {
    return this.prisma.coordinatorAdvisorChatPinnedMessage.upsert({
      where: {
        roomId_messageId: {
          roomId: params.roomId,
          messageId: params.messageId,
        },
      },
      create: {
        tenantId: params.tenantId,
        roomId: params.roomId,
        messageId: params.messageId,
        pinnedByUserId: params.pinnedByUserId,
        pinnedAt: params.pinnedAt,
      },
      update: {
        pinnedByUserId: params.pinnedByUserId,
        pinnedAt: params.pinnedAt,
      },
      select: {
        messageId: true,
        pinnedByUserId: true,
        pinnedAt: true,
      },
    });
  }

  async removePin(params: { tenantId: string; roomId: string; messageId: string }) {
    return this.prisma.coordinatorAdvisorChatPinnedMessage.deleteMany({
      where: {
        tenantId: params.tenantId,
        roomId: params.roomId,
        messageId: params.messageId,
      },
    });
  }
}
