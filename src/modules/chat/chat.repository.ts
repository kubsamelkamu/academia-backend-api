import { Injectable } from '@nestjs/common';
import { Prisma, ProjectGroupStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatRepository {
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
  } satisfies Prisma.ProjectGroupChatMessageSelect;

  async findApprovedProjectGroupForUser(params: { tenantId: string; userId: string }) {
    return this.prisma.projectGroup.findFirst({
      where: {
        tenantId: params.tenantId,
        status: ProjectGroupStatus.APPROVED,
        OR: [
          { leaderUserId: params.userId },
          {
            members: {
              some: {
                userId: params.userId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        status: true,
        leaderUserId: true,
        members: {
          select: {
            userId: true,
          },
        },
      },
    });
  }

  async findApprovedProjectGroupByIdForUser(params: {
    tenantId: string;
    projectGroupId: string;
    userId: string;
  }) {
    return this.prisma.projectGroup.findFirst({
      where: {
        id: params.projectGroupId,
        tenantId: params.tenantId,
        status: ProjectGroupStatus.APPROVED,
        OR: [
          { leaderUserId: params.userId },
          {
            members: {
              some: {
                userId: params.userId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        status: true,
        leaderUserId: true,
        members: {
          select: {
            userId: true,
          },
        },
      },
    });
  }

  async upsertRoomForProjectGroup(params: { tenantId: string; projectGroupId: string }) {
    return this.prisma.projectGroupChatRoom.upsert({
      where: {
        projectGroupId: params.projectGroupId,
      },
      update: {},
      create: {
        tenantId: params.tenantId,
        projectGroupId: params.projectGroupId,
      },
      select: {
        id: true,
        tenantId: true,
        projectGroupId: true,
        createdAt: true,
      },
    });
  }

  async findRoomByIdWithGroup(roomId: string) {
    return this.prisma.projectGroupChatRoom.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        tenantId: true,
        projectGroupId: true,
        createdAt: true,
        projectGroup: {
          select: {
            id: true,
            tenantId: true,
            departmentId: true,
            status: true,
            leaderUserId: true,
            members: {
              select: {
                userId: true,
              },
            },
          },
        },
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
    return this.prisma.projectGroupChatMessage.create({
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

  async listMessages(params: { tenantId: string; roomId: string; cursor?: string; take: number }) {
    const baseQuery = {
      where: {
        tenantId: params.tenantId,
        roomId: params.roomId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.take,
      select: this.messageSelect,
    } satisfies Prisma.ProjectGroupChatMessageFindManyArgs;

    const query = params.cursor
      ? ({
          ...baseQuery,
          cursor: { id: params.cursor },
          skip: 1,
        } satisfies Prisma.ProjectGroupChatMessageFindManyArgs)
      : baseQuery;

    return this.prisma.projectGroupChatMessage.findMany(query);
  }

  async findMessageByIdInRoom(params: { tenantId: string; roomId: string; messageId: string }) {
    return this.prisma.projectGroupChatMessage.findFirst({
      where: {
        id: params.messageId,
        tenantId: params.tenantId,
        roomId: params.roomId,
      },
      select: this.messageSelect,
    });
  }

  async updateMessageText(params: {
    tenantId: string;
    roomId: string;
    messageId: string;
    text: string | null;
    editedAt: Date;
  }) {
    return this.prisma.projectGroupChatMessage.update({
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
    return this.prisma.projectGroupChatMessage.delete({
      where: {
        id: params.messageId,
      },
      select: {
        id: true,
        roomId: true,
      },
    });
  }

  async findMessageInRoom(params: { tenantId: string; roomId: string; messageId: string }) {
    return this.prisma.projectGroupChatMessage.findFirst({
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

  async listUnreadMessageIdsUpTo(params: {
    tenantId: string;
    roomId: string;
    userId: string;
    upToCreatedAt: Date;
  }) {
    const unread = await this.prisma.projectGroupChatMessage.findMany({
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

    return unread.map((m) => m.id);
  }

  async createManyReads(params: {
    tenantId: string;
    roomId: string;
    userId: string;
    messageIds: string[];
    readAt: Date;
  }) {
    if (!params.messageIds.length) return { count: 0 };

    return this.prisma.projectGroupChatMessageRead.createMany({
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

    return this.prisma.projectGroupChatMessageRead.findMany({
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

    return this.prisma.projectGroupChatMessageReaction.findMany({
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
    return this.prisma.projectGroupChatMessageReaction.upsert({
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
    return this.prisma.projectGroupChatMessageReaction.deleteMany({
      where: {
        tenantId: params.tenantId,
        roomId: params.roomId,
        messageId: params.messageId,
        userId: params.userId,
      },
    });
  }

  async listPinsForRoom(params: { tenantId: string; roomId: string }) {
    return this.prisma.projectGroupChatPinnedMessage.findMany({
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

    const rows = await this.prisma.projectGroupChatPinnedMessage.findMany({
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

    return rows.map((r) => r.messageId);
  }

  async addPin(params: {
    tenantId: string;
    roomId: string;
    messageId: string;
    pinnedByUserId: string;
    pinnedAt: Date;
  }) {
    return this.prisma.projectGroupChatPinnedMessage.upsert({
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
    return this.prisma.projectGroupChatPinnedMessage.deleteMany({
      where: {
        tenantId: params.tenantId,
        roomId: params.roomId,
        messageId: params.messageId,
      },
    });
  }
}
