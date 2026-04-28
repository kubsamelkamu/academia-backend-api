import { BadRequestException, Injectable } from '@nestjs/common';

import { ROLES } from '../../common/constants/roles.constants';
import {
  InsufficientPermissionsException,
  UnauthorizedAccessException,
} from '../../common/exceptions';
import { CloudinaryService } from '../../core/storage/cloudinary.service';
import { AuthRepository } from '../auth/auth.repository';

import { CoordinatorAdvisorChatRepository } from './coordinator-advisor-chat.repository';

@Injectable()
export class CoordinatorAdvisorChatService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly repository: CoordinatorAdvisorChatRepository,
    private readonly cloudinary: CloudinaryService
  ) {}

  private async requireDbUser(user: any) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const dbUser = await this.authRepository.findUserById(user.sub);
    if (!dbUser) {
      throw new UnauthorizedAccessException();
    }

    if (user.tenantId && user.tenantId !== 'system' && dbUser.tenantId !== user.tenantId) {
      throw new UnauthorizedAccessException();
    }

    return dbUser;
  }

  private getRoleNames(
    user: { roles?: Array<{ revokedAt?: Date | null; role?: { name?: string | null } }> }
  ) {
    return (user.roles ?? [])
      .filter((role) => !role.revokedAt)
      .map((role) => role.role?.name)
      .filter((name): name is string => Boolean(name));
  }

  private encodeCoordinatorCursor(userId: string) {
    return Buffer.from(JSON.stringify({ userId }), 'utf8').toString('base64url');
  }

  private decodeCoordinatorCursor(cursor?: string) {
    const normalized = String(cursor ?? '').trim();
    if (!normalized) return undefined;

    try {
      const decoded = Buffer.from(normalized, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as { userId?: string };
      const userId = String(parsed.userId ?? '').trim();
      if (!userId) {
        throw new Error('missing userId');
      }
      return userId;
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }

  private isCoordinatorRole(user: { roles?: Array<{ role?: { name?: string | null } }> }) {
    return this.getRoleNames(user).includes(ROLES.COORDINATOR);
  }

  private isAdvisorRole(user: { roles?: Array<{ role?: { name?: string | null } }> }) {
    return this.getRoleNames(user).includes(ROLES.ADVISOR);
  }

  private shapeMessage(message: any) {
    return {
      id: message.id,
      roomId: message.roomId,
      senderUserId: message.senderUserId,
      sender: message.sender,
      replyToMessageId: message.replyToMessageId ?? null,
      replyTo: message.replyTo
        ? {
            id: message.replyTo.id,
            roomId: message.replyTo.roomId,
            senderUserId: message.replyTo.senderUserId,
            sender: message.replyTo.sender,
            text: message.replyTo.text,
            attachment:
              message.replyTo.attachmentUrl && message.replyTo.attachmentPublicId
                ? {
                    url: message.replyTo.attachmentUrl,
                    publicId: message.replyTo.attachmentPublicId,
                    resourceType: message.replyTo.attachmentResourceType,
                    name: message.replyTo.attachmentFileName,
                    mimeType: message.replyTo.attachmentMimeType,
                    size: message.replyTo.attachmentSizeBytes,
                  }
                : null,
            createdAt: message.replyTo.createdAt,
          }
        : null,
      text: message.text,
      attachment:
        message.attachmentUrl && message.attachmentPublicId
          ? {
              url: message.attachmentUrl,
              publicId: message.attachmentPublicId,
              resourceType: message.attachmentResourceType,
              name: message.attachmentFileName,
              mimeType: message.attachmentMimeType,
              size: message.attachmentSizeBytes,
            }
          : null,
      createdAt: message.createdAt,
      editedAt: message.editedAt ?? null,
    };
  }

  private async resolveEligiblePair(dbUser: any, counterpartUserId: string) {
    const tenantId = dbUser.tenantId;
    const departmentId = dbUser.departmentId;
    if (!departmentId) {
      throw new InsufficientPermissionsException('User is not assigned to a department');
    }

    const requesterCanActAsCoordinator = this.isCoordinatorRole(dbUser);
    const requesterCanActAsAdvisor = this.isAdvisorRole(dbUser);

    if (!requesterCanActAsCoordinator && !requesterCanActAsAdvisor) {
      throw new InsufficientPermissionsException(
        'Only coordinators or advisors can access direct chat'
      );
    }

    if (dbUser.id === counterpartUserId) {
      throw new BadRequestException('counterpartUserId must be a different user');
    }

    if (requesterCanActAsCoordinator) {
      const coordinator = await this.repository.findDepartmentCoordinatorByUserId({
        tenantId,
        departmentId,
        coordinatorUserId: dbUser.id,
      });
      const advisor = await this.repository.findDepartmentAdvisorByUserId({
        tenantId,
        departmentId,
        advisorUserId: counterpartUserId,
      });

      if (coordinator && advisor) {
        return {
          tenantId,
          departmentId,
          coordinatorUserId: coordinator.id,
          advisorUserId: advisor.userId,
        };
      }
    }

    if (requesterCanActAsAdvisor) {
      const advisor = await this.repository.findDepartmentAdvisorByUserId({
        tenantId,
        departmentId,
        advisorUserId: dbUser.id,
      });
      const coordinator = await this.repository.findDepartmentCoordinatorByUserId({
        tenantId,
        departmentId,
        coordinatorUserId: counterpartUserId,
      });

      if (advisor && coordinator) {
        return {
          tenantId,
          departmentId,
          coordinatorUserId: coordinator.id,
          advisorUserId: advisor.userId,
        };
      }
    }

    throw new BadRequestException(
      'Direct chat is only available between a coordinator and an advisor in the same department'
    );
  }

  async getOrCreateRoom(user: any, counterpartUserId: string) {
    const dbUser = await this.requireDbUser(user);
    const room = await this.repository.upsertDirectRoom(
      await this.resolveEligiblePair(dbUser, counterpartUserId)
    );

    return {
      roomId: room.id,
      coordinatorUserId: room.coordinatorUserId,
      advisorUserId: room.advisorUserId,
      departmentId: room.departmentId,
    };
  }

  async listAdvisorVisibleCoordinators(
    user: any,
    query: { search?: string; limit?: number; cursor?: string }
  ) {
    const dbUser = await this.requireDbUser(user);
    const departmentId = dbUser.departmentId;

    if (!departmentId) {
      throw new InsufficientPermissionsException('User is not assigned to a department');
    }

    if (!this.isAdvisorRole(dbUser)) {
      throw new InsufficientPermissionsException('Advisor role is required');
    }

    const advisor = await this.repository.findDepartmentAdvisorByUserId({
      tenantId: dbUser.tenantId,
      departmentId,
      advisorUserId: dbUser.id,
    });

    if (!advisor) {
      throw new InsufficientPermissionsException('Advisor role is required');
    }

    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const cursorUserId = this.decodeCoordinatorCursor(query.cursor);

    const rows = await this.repository.listAdvisorVisibleCoordinators({
      tenantId: dbUser.tenantId,
      departmentId,
      search: query.search,
      cursorUserId,
      take: limit + 1,
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    const nextCursor = hasNext
      ? this.encodeCoordinatorCursor(items[items.length - 1]?.id ?? '')
      : null;

    const total = await this.repository.countAdvisorVisibleCoordinators({
      tenantId: dbUser.tenantId,
      departmentId,
      search: query.search,
    });

    const roomRows = await this.repository.listExistingRoomsForAdvisor({
      tenantId: dbUser.tenantId,
      departmentId,
      advisorUserId: dbUser.id,
      coordinatorUserIds: items.map((item) => item.id),
    });

    const roomMap = new Map(roomRows.map((room) => [room.coordinatorUserId, room.id]));

    return {
      items: items.map((item) => ({
        userId: item.id,
        firstName: item.firstName ?? null,
        lastName: item.lastName ?? null,
        email: item.email,
        avatarUrl: item.avatarUrl ?? null,
        roleName: 'COORDINATOR',
        departmentId: item.departmentId ?? null,
        departmentName: item.department?.name ?? null,
        isDirectChatEligible: true,
        existingRoomId: roomMap.get(item.id) ?? null,
      })),
      pagination: {
        limit,
        nextCursor,
        hasNext,
        total,
      },
    };
  }

  async requireRoomAndMembership(user: any, roomId: string) {
    const dbUser = await this.requireDbUser(user);
    const room = await this.repository.findRoomById(roomId);

    if (!room || room.tenantId !== dbUser.tenantId) {
      throw new BadRequestException('Direct chat room not found');
    }

    if (!dbUser.departmentId || dbUser.departmentId !== room.departmentId) {
      throw new InsufficientPermissionsException('You do not have access to this direct chat room');
    }

    if (room.coordinatorUserId !== dbUser.id && room.advisorUserId !== dbUser.id) {
      throw new InsufficientPermissionsException('You do not have access to this direct chat room');
    }

    const pair = await this.resolveEligiblePair(
      dbUser,
      room.coordinatorUserId === dbUser.id ? room.advisorUserId : room.coordinatorUserId
    );

    if (
      pair.coordinatorUserId !== room.coordinatorUserId ||
      pair.advisorUserId !== room.advisorUserId ||
      pair.departmentId !== room.departmentId
    ) {
      throw new InsufficientPermissionsException('Direct chat membership is no longer valid');
    }

    return {
      dbUser,
      room,
      memberUserIds: [room.coordinatorUserId, room.advisorUserId],
    };
  }

  async listMessages(user: any, params: { roomId: string; cursor?: string; limit: number }) {
    const { dbUser, room, memberUserIds } = await this.requireRoomAndMembership(user, params.roomId);

    const take = Math.min(Math.max(params.limit, 1), 50);
    const rows = await this.repository.listMessages({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      cursor: params.cursor,
      take: take + 1,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    const readStates = await this.repository.getMemberLastReadStates({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      memberUserIds,
    });

    const messageIds = items.map((message) => message.id);
    const reactionRows = await this.repository.listReactionsForMessages({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageIds,
    });

    const pinnedMessageIds = await this.repository.listPinnedMessageIds({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageIds,
    });
    const pinnedSet = new Set(pinnedMessageIds);

    const reactionCountMap = new Map<string, Map<string, number>>();
    const myReactionMap = new Map<string, string>();
    for (const reaction of reactionRows) {
      const perMessage = reactionCountMap.get(reaction.messageId) ?? new Map<string, number>();
      perMessage.set(reaction.emoji, (perMessage.get(reaction.emoji) ?? 0) + 1);
      reactionCountMap.set(reaction.messageId, perMessage);
      if (reaction.userId === dbUser.id) {
        myReactionMap.set(reaction.messageId, reaction.emoji);
      }
    }

    return {
      items: items.map((message) => {
        const base = this.shapeMessage(message);
        const perMessageCounts = reactionCountMap.get(message.id) ?? new Map<string, number>();
        const reactionItems = Array.from(perMessageCounts.entries()).map(([emoji, count]) => ({
          emoji,
          count,
        }));

        return {
          ...base,
          isPinned: pinnedSet.has(message.id),
          reactions: {
            items: reactionItems,
            myReaction: myReactionMap.get(message.id) ?? null,
          },
        };
      }),
      nextCursor,
      readStates: readStates.map((state) => ({
        userId: state.userId,
        lastReadMessageId: state.messageId,
        readAt: state.readAt,
      })),
    };
  }

  async uploadAttachment(user: any, roomId: string, file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('Attachment file is required');
    }

    const { dbUser, room } = await this.requireRoomAndMembership(user, roomId);

    const uploaded = await this.cloudinary.uploadCoordinatorAdvisorChatAttachment({
      tenantId: dbUser.tenantId,
      departmentId: room.departmentId,
      roomId: room.id,
      userId: dbUser.id,
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname,
    });

    return {
      url: uploaded.secureUrl,
      publicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  async sendMessage(
    user: any,
    params: {
      roomId: string;
      text?: string;
      replyToMessageId?: string | null;
      attachment?: {
        url: string;
        publicId: string;
        resourceType: 'image' | 'raw';
        name?: string;
        mimeType?: string;
        size?: number;
      } | null;
    }
  ) {
    const { dbUser, room } = await this.requireRoomAndMembership(user, params.roomId);

    const text = (params.text ?? '').trim();
    const hasText = Boolean(text);
    const hasAttachment = Boolean(params.attachment?.url && params.attachment?.publicId);

    if (!hasText && !hasAttachment) {
      throw new BadRequestException('Message text or attachment is required');
    }

    const replyToMessageId = (params.replyToMessageId ?? '').trim() || null;
    if (replyToMessageId) {
      const replyTarget = await this.repository.findMessageInRoom({
        tenantId: dbUser.tenantId,
        roomId: room.id,
        messageId: replyToMessageId,
      });
      if (!replyTarget) {
        throw new BadRequestException('Reply-to message not found in this room');
      }
    }

    const created = await this.repository.createMessage({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      senderUserId: dbUser.id,
      text: hasText ? text : null,
      replyToMessageId,
      attachment: hasAttachment ? params.attachment! : null,
    });

    return {
      ...this.shapeMessage(created),
      isPinned: false,
      reactions: { items: [], myReaction: null },
    };
  }

  async editMessage(user: any, params: { roomId: string; messageId: string; text: string }) {
    const { dbUser, room } = await this.requireRoomAndMembership(user, params.roomId);

    const existing = await this.repository.findMessageByIdInRoom({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: params.messageId,
    });

    if (!existing) {
      throw new BadRequestException('Message not found in this room');
    }

    if (existing.senderUserId !== dbUser.id) {
      throw new InsufficientPermissionsException('Only the sender can edit this message');
    }

    const nextText = (params.text ?? '').trim();
    const nextTextOrNull = nextText.length ? nextText : null;

    const hasAttachment = Boolean(existing.attachmentUrl && existing.attachmentPublicId);
    if (!nextTextOrNull && !hasAttachment) {
      throw new BadRequestException('Message text is required (message has no attachment)');
    }

    const editedAt = new Date();
    const updated = await this.repository.updateMessageText({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: existing.id,
      text: nextTextOrNull,
      editedAt,
    });

    return {
      ...this.shapeMessage(updated),
      isPinned: false,
      reactions: { items: [], myReaction: null },
    };
  }

  async deleteMessage(user: any, params: { roomId: string; messageId: string }) {
    const { dbUser, room } = await this.requireRoomAndMembership(user, params.roomId);

    const existing = await this.repository.findMessageByIdInRoom({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: params.messageId,
    });

    if (!existing) {
      throw new BadRequestException('Message not found in this room');
    }

    if (existing.senderUserId !== dbUser.id) {
      throw new InsufficientPermissionsException('Only the sender can delete this message');
    }

    const deleted = await this.repository.deleteMessage({
      tenantId: dbUser.tenantId,
      messageId: existing.id,
    });

    return {
      messageId: deleted.id,
      roomId: deleted.roomId,
    };
  }

  async setReaction(user: any, params: { roomId: string; messageId: string; emoji: string }) {
    const { dbUser, room } = await this.requireRoomAndMembership(user, params.roomId);
    const emoji = (params.emoji ?? '').trim();
    if (!emoji) {
      throw new BadRequestException('emoji is required');
    }

    const message = await this.repository.findMessageInRoom({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: params.messageId,
    });
    if (!message) {
      throw new BadRequestException('Message not found in this room');
    }

    const reaction = await this.repository.setReaction({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: params.messageId,
      userId: dbUser.id,
      emoji,
    });

    return {
      roomId: room.id,
      messageId: reaction.messageId,
      userId: reaction.userId,
      emoji: reaction.emoji,
      reactedAt: reaction.createdAt,
    };
  }

  async removeReaction(user: any, params: { roomId: string; messageId: string }) {
    const { dbUser, room } = await this.requireRoomAndMembership(user, params.roomId);

    const message = await this.repository.findMessageInRoom({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: params.messageId,
    });
    if (!message) {
      throw new BadRequestException('Message not found in this room');
    }

    await this.repository.removeReaction({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: params.messageId,
      userId: dbUser.id,
    });

    return {
      roomId: room.id,
      messageId: params.messageId,
      userId: dbUser.id,
      removedAt: new Date(),
    };
  }

  async addPin(user: any, params: { roomId: string; messageId: string }) {
    const { dbUser, room } = await this.requireRoomAndMembership(user, params.roomId);

    const message = await this.repository.findMessageInRoom({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: params.messageId,
    });
    if (!message) {
      throw new BadRequestException('Message not found in this room');
    }

    const pinnedAt = new Date();
    const pin = await this.repository.addPin({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: params.messageId,
      pinnedByUserId: dbUser.id,
      pinnedAt,
    });

    return {
      roomId: room.id,
      messageId: pin.messageId,
      pinnedByUserId: pin.pinnedByUserId,
      pinnedAt: pin.pinnedAt,
    };
  }

  async removePin(user: any, params: { roomId: string; messageId: string }) {
    const { dbUser, room } = await this.requireRoomAndMembership(user, params.roomId);

    await this.repository.removePin({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: params.messageId,
    });

    return {
      roomId: room.id,
      messageId: params.messageId,
      unpinnedByUserId: dbUser.id,
      unpinnedAt: new Date(),
    };
  }

  async listPins(user: any, params: { roomId: string }) {
    const { dbUser, room } = await this.requireRoomAndMembership(user, params.roomId);

    const pins = await this.repository.listPinsForRoom({
      tenantId: dbUser.tenantId,
      roomId: room.id,
    });

    return {
      roomId: room.id,
      items: pins.map((pin) => ({
        messageId: pin.messageId,
        pinnedByUserId: pin.pinnedByUserId,
        pinnedBy: pin.pinnedBy,
        pinnedAt: pin.pinnedAt,
        message: {
          ...this.shapeMessage(pin.message),
          isPinned: true,
          reactions: { items: [], myReaction: null },
        },
      })),
    };
  }

  async markReadUpTo(user: any, params: { roomId: string; messageId: string }) {
    const { dbUser, room } = await this.requireRoomAndMembership(user, params.roomId);

    const target = await this.repository.findMessageInRoom({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: params.messageId,
    });

    if (!target) {
      throw new BadRequestException('Message not found in this room');
    }

    const readAt = new Date();
    const unreadMessageIds = await this.repository.listUnreadMessageIdsUpTo({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      userId: dbUser.id,
      upToCreatedAt: target.createdAt,
    });

    await this.repository.createManyReads({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      userId: dbUser.id,
      messageIds: unreadMessageIds,
      readAt,
    });

    return {
      readUpToMessageId: target.id,
      readAt,
    };
  }
}
