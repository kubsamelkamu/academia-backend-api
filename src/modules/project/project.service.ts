import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ProjectRepository } from './project.repository';
import {
  ListProposalsDto,
  UpdateProposalStatusDto,
  ListProjectsDto,
  CreateProjectDto,
  AssignAdvisorDto,
  UpdateMilestoneStatusDto,
  AddProjectMemberDto,
} from './dto';
import { ProposalStatus } from '@prisma/client';
import { ROLES } from '../../common/constants/roles.constants';

const DEFAULT_MIN_GROUP_SIZE = 3;
const DEFAULT_MAX_GROUP_SIZE = 5;

@Injectable()
export class ProjectService {
  constructor(private readonly projectRepository: ProjectRepository) {}

  private isPlatformAdmin(user: any): boolean {
    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    return roles.includes(ROLES.PLATFORM_ADMIN);
  }

  private async assertProjectAccessByDepartment(
    user: any,
    project: { tenantId: string; departmentId: string }
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    if (this.isPlatformAdmin(user)) {
      return;
    }

    const actor = await this.projectRepository.findUserForProjectMembership(user.sub);
    if (!actor || actor.status !== 'ACTIVE') {
      throw new ForbiddenException('User not found or inactive');
    }

    if (actor.tenantId !== project.tenantId) {
      throw new ForbiddenException('Access denied');
    }

    if (!actor.departmentId || actor.departmentId !== project.departmentId) {
      throw new ForbiddenException('Access denied to this department');
    }
  }

  // Proposal methods
  async getProposals(departmentId: string, filters: ListProposalsDto, user: any) {
    // Check if user has access to department
    if (!this.hasDepartmentAccess(user, departmentId)) {
      throw new ForbiddenException('Access denied to this department');
    }

    const startDate = filters.startDate ? new Date(filters.startDate) : undefined;
    const endDate = filters.endDate ? new Date(filters.endDate) : undefined;

    return this.projectRepository.findProposalsByDepartment(departmentId, {
      status: filters.status,
      startDate,
      endDate,
    });
  }

  async getProposalById(id: string, user: any) {
    const proposal = await this.projectRepository.findProposalById(id);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Check access
    if (!this.hasDepartmentAccess(user, proposal.departmentId)) {
      throw new ForbiddenException('Access denied');
    }

    // Students can only see their own proposals
    if (user.roles.includes(ROLES.STUDENT) && proposal.submittedBy !== user.sub) {
      throw new ForbiddenException('Access denied');
    }

    return proposal;
  }

  async updateProposalStatus(id: string, updateData: UpdateProposalStatusDto, user: any) {
    const proposal = await this.projectRepository.findProposalById(id);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Check permissions
    if (!this.canUpdateProposalStatus(user, proposal)) {
      throw new ForbiddenException('Insufficient permissions to update proposal status');
    }

    // Validate status transition
    if (!this.isValidStatusTransition(proposal.status, updateData.status as ProposalStatus)) {
      throw new BadRequestException('Invalid status transition');
    }

    return this.projectRepository.updateProposalStatus(id, updateData);
  }

  // Project methods
  async getProjects(departmentId: string, filters: ListProjectsDto, user: any) {
    if (!this.hasDepartmentAccess(user, departmentId)) {
      throw new ForbiddenException('Access denied to this department');
    }

    return this.projectRepository.findProjectsByDepartment(departmentId, filters);
  }

  async getProjectById(id: string, user: any) {
    const project = await this.projectRepository.findProjectById(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!this.hasDepartmentAccess(user, project.departmentId)) {
      throw new ForbiddenException('Access denied');
    }

    // Students can only see projects they're members of
    if (user.roles.includes(ROLES.STUDENT) && !project.members.some((m) => m.userId === user.sub)) {
      throw new ForbiddenException('Access denied');
    }

    return project;
  }

  async createProject(createData: CreateProjectDto, user: any) {
    const proposal = await this.projectRepository.findProposalById(createData.proposalId);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.status !== ProposalStatus.APPROVED) {
      throw new BadRequestException('Only approved proposals can be converted to projects');
    }

    if (proposal.project) {
      throw new BadRequestException('Proposal already has a project');
    }

    // Check permissions - only department head or coordinator can create projects
    if (!this.canCreateProject(user, proposal.departmentId)) {
      throw new ForbiddenException('Insufficient permissions to create project');
    }

    // Use proposal's advisor or assign default
    const advisorId = proposal.advisorId || user.sub; // Fallback to current user if no advisor

    const project = await this.projectRepository.createProjectFromProposal(
      createData.proposalId,
      advisorId
    );

    return project;
  }

  async assignAdvisor(projectId: string, assignData: AssignAdvisorDto, user: any) {
    const project = await this.projectRepository.findProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check permissions
    if (!this.canAssignAdvisor(user, project.departmentId)) {
      throw new ForbiddenException('Insufficient permissions to assign advisor');
    }

    return this.projectRepository.updateProjectAdvisor(projectId, assignData.advisorId);
  }

  // Milestone methods
  async getProjectMilestones(projectId: string, user: any) {
    const project = await this.projectRepository.findProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!this.hasDepartmentAccess(user, project.departmentId)) {
      throw new ForbiddenException('Access denied');
    }

    return this.projectRepository.findMilestonesByProject(projectId);
  }

  async updateMilestoneStatus(
    milestoneId: string,
    updateData: UpdateMilestoneStatusDto,
    user: any
  ) {
    // First get the milestone to check project access
    const milestone = await this.projectRepository
      .findMilestonesByProject('temp')
      .then((milestones) => milestones.find((m) => m.id === milestoneId));

    if (!milestone) {
      // Need to find milestone properly
      // For now, assume access is checked via project
      // TODO: Add method to get milestone with project
    }

    // Check permissions - advisors can approve, department heads can override
    if (!this.canUpdateMilestoneStatus(user)) {
      throw new ForbiddenException('Insufficient permissions to update milestone');
    }

    return this.projectRepository.updateMilestoneStatus(milestoneId, updateData);
  }

  // Advisor methods
  async getAdvisors(departmentId: string, includeLoad: boolean, user: any) {
    if (!this.hasDepartmentAccess(user, departmentId)) {
      throw new ForbiddenException('Access denied to this department');
    }

    return this.projectRepository.findAdvisorsByDepartment(departmentId, includeLoad);
  }

  async getAdvisorWorkload(advisorId: string, user: any) {
    const advisor = await this.projectRepository.findAdvisorById(advisorId);
    if (!advisor) {
      throw new NotFoundException('Advisor not found');
    }

    // Check access - department head, coordinator, or the advisor themselves
    if (!this.hasDepartmentAccess(user, advisor.departmentId) && user.sub !== advisor.userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.projectRepository.getAdvisorWorkload(advisorId);
  }

  async checkAdvisorAvailability(departmentId: string, minCapacity: number, user: any) {
    if (!this.hasDepartmentAccess(user, departmentId)) {
      throw new ForbiddenException('Access denied to this department');
    }

    return this.projectRepository.checkAdvisorAvailability(departmentId, minCapacity);
  }

  async setAdvisorLoadLimit(advisorId: string, loadLimit: number, user: any) {
    const advisor = await this.projectRepository.findAdvisorById(advisorId);
    if (!advisor) {
      throw new NotFoundException('Advisor not found');
    }

    // Only department head can set load limits
    if (!user.roles.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new ForbiddenException('Only department heads can set advisor load limits');
    }

    if (!this.hasDepartmentAccess(user, advisor.departmentId)) {
      throw new ForbiddenException('Access denied');
    }

    // Cannot set load limit below current load
    if (loadLimit < advisor.currentLoad) {
      throw new BadRequestException('Cannot set load limit below current load');
    }

    return this.projectRepository.updateAdvisorLoadLimit(advisorId, loadLimit);
  }

  async addStudentMember(projectId: string, dto: AddProjectMemberDto, user: any) {
    if (!this.canManageProjectMembers(user)) {
      throw new ForbiddenException('Insufficient permissions to manage project members');
    }

    const project = await this.projectRepository.findProjectForMemberManagement(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot modify members for non-active projects');
    }

    await this.assertProjectAccessByDepartment(user, project);

    const setting = await this.projectRepository.findDepartmentGroupSizeSetting(project.departmentId);
    const minGroupSize = setting?.minGroupSize ?? DEFAULT_MIN_GROUP_SIZE;
    const maxGroupSize = setting?.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE;

    const currentStudentCount = project.members.filter((m) => m.role === 'STUDENT').length;
    if (currentStudentCount + 1 > maxGroupSize) {
      throw new BadRequestException(`Group cannot exceed maxGroupSize (${maxGroupSize})`);
    }

    const targetUser = await this.projectRepository.findUserForProjectMembership(dto.userId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUser.status !== 'ACTIVE') {
      throw new BadRequestException('User must be ACTIVE to be added to a project');
    }

    if (targetUser.tenantId !== project.tenantId) {
      throw new ForbiddenException('User must belong to the same tenant');
    }

    if (targetUser.departmentId !== project.departmentId) {
      throw new ForbiddenException('User must belong to the same department');
    }

    const isStudent = await this.projectRepository.userHasActiveRoleInTenant({
      userId: dto.userId,
      tenantId: project.tenantId,
      roleName: ROLES.STUDENT,
    });
    if (!isStudent) {
      throw new BadRequestException('User must have STUDENT role to be added as a student member');
    }

    const membership = await this.projectRepository.upsertStudentMember(projectId, dto.userId);

    return {
      projectId: membership.projectId,
      userId: membership.userId,
      role: membership.role,
      minGroupSize,
      maxGroupSize,
    };
  }

  async removeStudentMember(projectId: string, memberUserId: string, user: any) {
    if (!this.canManageProjectMembers(user)) {
      throw new ForbiddenException('Insufficient permissions to manage project members');
    }

    const project = await this.projectRepository.findProjectForMemberManagement(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot modify members for non-active projects');
    }

    await this.assertProjectAccessByDepartment(user, project);

    const member = await this.projectRepository.findProjectMember(projectId, memberUserId);
    if (!member) {
      throw new NotFoundException('Project member not found');
    }

    if (member.role !== 'STUDENT') {
      throw new BadRequestException('Only STUDENT members can be removed with this endpoint');
    }

    const setting = await this.projectRepository.findDepartmentGroupSizeSetting(project.departmentId);
    const minGroupSize = setting?.minGroupSize ?? DEFAULT_MIN_GROUP_SIZE;
    const maxGroupSize = setting?.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE;

    const currentStudentCount = project.members.filter((m) => m.role === 'STUDENT').length;
    const remaining = currentStudentCount - 1;
    if (remaining < minGroupSize) {
      throw new BadRequestException(`Group cannot go below minGroupSize (${minGroupSize})`);
    }

    const removed = await this.projectRepository.removeProjectMember(projectId, memberUserId);

    return {
      projectId: removed.projectId,
      userId: removed.userId,
      role: removed.role,
      minGroupSize,
      maxGroupSize,
    };
  }

  async listProjectMembers(projectId: string, user: any) {
    const project = await this.projectRepository.findProjectMembers(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (this.isPlatformAdmin(user)) {
      return {
        projectId: project.id,
        members: project.members,
      };
    }

    // Students can list only if they are members.
    if (Array.isArray(user?.roles) && user.roles.includes(ROLES.STUDENT)) {
      const isMember = project.members.some((m) => m.userId === user.sub);
      if (!isMember) {
        throw new ForbiddenException('Access denied');
      }

      return {
        projectId: project.id,
        members: project.members,
      };
    }

    await this.assertProjectAccessByDepartment(user, project);

    return {
      projectId: project.id,
      members: project.members,
    };
  }

  // Helper methods
  private hasDepartmentAccess(user: any, departmentId: string): boolean {
    return (
      user.departmentId === departmentId ||
      user.roles.includes(ROLES.PLATFORM_ADMIN) ||
      user.roles.includes(ROLES.DEPARTMENT_HEAD)
    );
  }

  private canUpdateProposalStatus(user: any, _proposal: any): boolean {
    return (
      user.roles.includes(ROLES.DEPARTMENT_HEAD) ||
      user.roles.includes(ROLES.ADVISOR) ||
      user.roles.includes(ROLES.COORDINATOR)
    );
  }

  private canManageProjectMembers(user: any): boolean {
    return (
      user.roles.includes(ROLES.DEPARTMENT_HEAD) ||
      user.roles.includes(ROLES.COORDINATOR) ||
      user.roles.includes(ROLES.PLATFORM_ADMIN)
    );
  }

  private canCreateProject(user: any, departmentId: string): boolean {
    return (
      user.roles.includes(ROLES.DEPARTMENT_HEAD) ||
      user.roles.includes(ROLES.COORDINATOR) ||
      (user.roles.includes(ROLES.ADVISOR) && user.departmentId === departmentId)
    );
  }

  private canAssignAdvisor(user: any, _departmentId: string): boolean {
    return user.roles.includes(ROLES.DEPARTMENT_HEAD) || user.roles.includes(ROLES.COORDINATOR);
  }

  private canUpdateMilestoneStatus(user: any): boolean {
    return (
      user.roles.includes(ROLES.DEPARTMENT_HEAD) ||
      user.roles.includes(ROLES.ADVISOR) ||
      user.roles.includes(ROLES.COORDINATOR)
    );
  }

  private isValidStatusTransition(current: ProposalStatus, next: ProposalStatus): boolean {
    const transitions: Record<ProposalStatus, ProposalStatus[]> = {
      [ProposalStatus.DRAFT]: [ProposalStatus.SUBMITTED],
      [ProposalStatus.SUBMITTED]: [ProposalStatus.APPROVED, ProposalStatus.REJECTED],
      [ProposalStatus.APPROVED]: [],
      [ProposalStatus.REJECTED]: [ProposalStatus.SUBMITTED], // Allow resubmission
    };

    return transitions[current]?.includes(next) ?? false;
  }
}
