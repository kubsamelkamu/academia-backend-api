import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectGroupStatus } from '@prisma/client';

import { ROLES } from '../../common/constants/roles.constants';
import {
  InsufficientPermissionsException,
  UnauthorizedAccessException,
} from '../../common/exceptions';
import { CloudinaryService } from '../../core/storage/cloudinary.service';
import { AuthRepository } from '../auth/auth.repository';

import { ChatRepository } from './chat.repository';

@Injectable()
export class ChatService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly chatRepository: ChatRepository,
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

  private requireChatRole(user: any) {
    const roles: string[] = user?.roles ?? [];
    const allowed = roles.includes(ROLES.STUDENT) || roles.includes(ROLES.ADVISOR);
    if (!allowed) {
      throw new InsufficientPermissionsException('Only students or advisors can access chat');
    }
  }

  private isStudent(user: any) {
    const roles: string[] = user?.roles ?? [];
    return roles.includes(ROLES.STUDENT);
  }

  private isAdvisor(user: any) {
    const roles: string[] = user?.roles ?? [];
    return roles.includes(ROLES.ADVISOR);
  }

  private getGroupMemberUserIds(group: { leaderUserId: string; members: { userId: string }[] }) {
    const ids = [group.leaderUserId, ...(group.members ?? []).map((m) => m.userId)].filter(Boolean);
    return Array.from(new Set(ids));
  }

  private shapeMessage(m: any) {
    return {
      id: m.id,
      roomId: m.roomId,
      senderUserId: m.senderUserId,
      sender: m.sender,
      replyToMessageId: m.replyToMessageId ?? null,
      replyTo: m.replyTo
        ? {
            id: m.replyTo.id,
            roomId: m.replyTo.roomId,
            senderUserId: m.replyTo.senderUserId,
            sender: m.replyTo.sender,
            text: m.replyTo.text,
            attachment:
              m.replyTo.attachmentUrl && m.replyTo.attachmentPublicId
                ? {
                    url: m.replyTo.attachmentUrl,
                    publicId: m.replyTo.attachmentPublicId,
                    resourceType: m.replyTo.attachmentResourceType,
                    name: m.replyTo.attachmentFileName,
                    mimeType: m.replyTo.attachmentMimeType,
                    size: m.replyTo.attachmentSizeBytes,
                  }
                : null,
            createdAt: m.replyTo.createdAt,
          }
        : null,
      text: m.text,
      attachment:
        m.attachmentUrl && m.attachmentPublicId
          ? {
              url: m.attachmentUrl,
              publicId: m.attachmentPublicId,
              resourceType: m.attachmentResourceType,
              name: m.attachmentFileName,
              mimeType: m.attachmentMimeType,
              size: m.attachmentSizeBytes,
            }
          : null,
      createdAt: m.createdAt,
      editedAt: m.editedAt ?? null,
    };
  }

  async getMyApprovedGroupChatRoom(user: any) {
    this.requireChatRole(user);
    if (!this.isStudent(user)) {
      throw new InsufficientPermissionsException('Only students can use this endpoint');
    }
    const dbUser = await this.requireDbUser(user);

    const group = await this.chatRepository.findApprovedProjectGroupForUser({
      tenantId: dbUser.tenantId,
      userId: dbUser.id,
    });

    if (!group) {
      throw new BadRequestException('No approved group found for this student');
    }

    const room = await this.chatRepository.upsertRoomForProjectGroup({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
    });

    return {
      roomId: room.id,
      projectGroupId: group.id,
    };
  }

  async getMySupervisedProjectGroupChatRoom(user: any, projectId: string) {
    this.requireChatRole(user);
    if (!this.isAdvisor(user)) {
      throw new InsufficientPermissionsException('Only advisors can use this endpoint');
    }

    const dbUser = await this.requireDbUser(user);
    const group = await this.chatRepository.findApprovedProjectGroupForAdvisorProject({
      tenantId: dbUser.tenantId,
      projectId,
      advisorUserId: dbUser.id,
    });

    if (!group) {
      throw new BadRequestException('Supervised approved group not found for this project');
    }

    const room = await this.chatRepository.upsertRoomForProjectGroup({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
    });

    return {
      roomId: room.id,
      projectGroupId: group.id,
    };
  }

  async requireRoomAndMembership(user: any, roomId: string) {
    this.requireChatRole(user);
    const dbUser = await this.requireDbUser(user);

    const room = await this.chatRepository.findRoomByIdWithGroup(roomId);
    if (!room || room.tenantId !== dbUser.tenantId) {
      throw new BadRequestException('Chat room not found');
    }

    const group = room.projectGroup;
    if (!group || group.tenantId !== dbUser.tenantId) {
      throw new BadRequestException('Project group not found');
    }

    if (group.status !== ProjectGroupStatus.APPROVED) {
      throw new BadRequestException('Group is not approved yet');
    }

    const studentMemberIds = this.getGroupMemberUserIds(group);
    const isStudentMember = studentMemberIds.includes(dbUser.id);

    let isAdvisorForGroup = false;
    if (this.isAdvisor(user)) {
      isAdvisorForGroup = await this.chatRepository.isAdvisorForProjectGroup({
        tenantId: dbUser.tenantId,
        projectGroupId: group.id,
        advisorUserId: dbUser.id,
      });
    }

    if (!isStudentMember && !isAdvisorForGroup) {
      throw new BadRequestException('You do not have access to this chat room');
    }

    const assignedAdvisorId = await this.chatRepository.findAssignedAdvisorUserIdForProjectGroup({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
    });

    const participantUserIds = Array.from(
      new Set([...studentMemberIds, ...(assignedAdvisorId ? [assignedAdvisorId] : [])])
    );

    return { dbUser, room, group, memberIds: participantUserIds };
  }

  async joinApprovedProjectGroupChat(user: any, projectGroupId: string) {
    this.requireChatRole(user);
    const dbUser = await this.requireDbUser(user);

    const group = await this.chatRepository.findApprovedProjectGroupByIdForUser({
      tenantId: dbUser.tenantId,
      projectGroupId,
      userId: dbUser.id,
    });

    const canJoinAsAdvisor = this.isAdvisor(user)
      ? await this.chatRepository.isAdvisorForProjectGroup({
          tenantId: dbUser.tenantId,
          projectGroupId,
          advisorUserId: dbUser.id,
        })
      : false;

    if (!group && !canJoinAsAdvisor) {
      throw new BadRequestException('Group not found or not approved');
    }

    const groupId = group?.id ?? projectGroupId;

    const room = await this.chatRepository.upsertRoomForProjectGroup({
      tenantId: dbUser.tenantId,
      projectGroupId: groupId,
    });

    return {
      roomId: room.id,
      projectGroupId: groupId,
    };
  }

  async listMessages(user: any, params: { roomId: string; cursor?: string; limit: number }) {
    const { dbUser, room, memberIds } = await this.requireRoomAndMembership(user, params.roomId);

    const take = Math.min(Math.max(params.limit, 1), 50);
    const rows = await this.chatRepository.listMessages({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      cursor: params.cursor,
      take: take + 1,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    const readStates = await this.chatRepository.getMemberLastReadStates({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      memberUserIds: memberIds,
    });

    const messageIds = items.map((m) => m.id);
    const reactionRows = await this.chatRepository.listReactionsForMessages({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageIds,
    });

    const pinnedMessageIds = await this.chatRepository.listPinnedMessageIds({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageIds,
    });
    const pinnedSet = new Set(pinnedMessageIds);

    const reactionCountMap = new Map<string, Map<string, number>>();
    const myReactionMap = new Map<string, string>();
    for (const r of reactionRows) {
      const perMessage = reactionCountMap.get(r.messageId) ?? new Map<string, number>();
      perMessage.set(r.emoji, (perMessage.get(r.emoji) ?? 0) + 1);
      reactionCountMap.set(r.messageId, perMessage);
      if (r.userId === dbUser.id) {
        myReactionMap.set(r.messageId, r.emoji);
      }
    }

    return {
      items: items.map((m) => {
        const base = this.shapeMessage(m);
        const perMessageCounts = reactionCountMap.get(m.id) ?? new Map<string, number>();
        const reactionItems = Array.from(perMessageCounts.entries()).map(([emoji, count]) => ({
          emoji,
          count,
        }));

        return {
          ...base,
          isPinned: pinnedSet.has(m.id),
          reactions: {
            items: reactionItems,
            myReaction: myReactionMap.get(m.id) ?? null,
          },
        };
      }),
      nextCursor,
      readStates: readStates.map((s) => ({
        userId: s.userId,
        lastReadMessageId: s.messageId,
        readAt: s.readAt,
      })),
    };
  }

  async uploadAttachment(user: any, roomId: string, file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('Attachment file is required');
    }

    const { dbUser, group } = await this.requireRoomAndMembership(user, roomId);

    const uploaded = await this.cloudinary.uploadProjectGroupChatAttachment({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
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
      const replyTarget = await this.chatRepository.findMessageInRoom({
        tenantId: dbUser.tenantId,
        roomId: room.id,
        messageId: replyToMessageId,
      });
      if (!replyTarget) {
        throw new BadRequestException('Reply-to message not found in this room');
      }
    }

    const created = await this.chatRepository.createMessage({
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

    const existing = await this.chatRepository.findMessageByIdInRoom({
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
    const updated = await this.chatRepository.updateMessageText({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: existing.id,
      text: nextTextOrNull,
      editedAt,
    });

    return {
      ...this.shapeMessage(updated),
      // caller can merge existing isPinned/reactions from state; defaults keep shape consistent
      isPinned: false,
      reactions: { items: [], myReaction: null },
    };
  }

  async deleteMessage(user: any, params: { roomId: string; messageId: string }) {
    const { dbUser, room } = await this.requireRoomAndMembership(user, params.roomId);

    const existing = await this.chatRepository.findMessageByIdInRoom({
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

    const deleted = await this.chatRepository.deleteMessage({
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

    const message = await this.chatRepository.findMessageInRoom({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: params.messageId,
    });
    if (!message) {
      throw new BadRequestException('Message not found in this room');
    }

    const reaction = await this.chatRepository.setReaction({
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

    const message = await this.chatRepository.findMessageInRoom({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: params.messageId,
    });
    if (!message) {
      throw new BadRequestException('Message not found in this room');
    }

    await this.chatRepository.removeReaction({
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

    const message = await this.chatRepository.findMessageInRoom({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: params.messageId,
    });
    if (!message) {
      throw new BadRequestException('Message not found in this room');
    }

    const pinnedAt = new Date();
    const pin = await this.chatRepository.addPin({
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

    await this.chatRepository.removePin({
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

    const pins = await this.chatRepository.listPinsForRoom({
      tenantId: dbUser.tenantId,
      roomId: room.id,
    });

    return {
      roomId: room.id,
      items: pins.map((p) => ({
        messageId: p.messageId,
        pinnedByUserId: p.pinnedByUserId,
        pinnedBy: p.pinnedBy,
        pinnedAt: p.pinnedAt,
        message: {
          ...this.shapeMessage(p.message),
          isPinned: true,
          reactions: { items: [], myReaction: null },
        },
      })),
    };
  }

  async markReadUpTo(user: any, params: { roomId: string; messageId: string }) {
    const { dbUser, room } = await this.requireRoomAndMembership(user, params.roomId);

    const target = await this.chatRepository.findMessageInRoom({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      messageId: params.messageId,
    });

    if (!target) {
      throw new BadRequestException('Message not found in this room');
    }

    const readAt = new Date();
    const unreadMessageIds = await this.chatRepository.listUnreadMessageIdsUpTo({
      tenantId: dbUser.tenantId,
      roomId: room.id,
      userId: dbUser.id,
      upToCreatedAt: target.createdAt,
    });

    await this.chatRepository.createManyReads({
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
