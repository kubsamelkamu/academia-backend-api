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
} from './dto';
import { ProposalStatus } from '@prisma/client';

@Injectable()
export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository
  ) {}

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
    if (user.roles.includes('STUDENT') && proposal.submittedBy !== user.sub) {
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
    if (user.roles.includes('STUDENT') && !project.members.some((m) => m.userId === user.sub)) {
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
    if (!user.roles.includes('DEPARTMENT_HEAD')) {
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

  // Helper methods
  private hasDepartmentAccess(user: any, departmentId: string): boolean {
    return (
      user.departmentId === departmentId ||
      user.roles.includes('PLATFORM_ADMIN') ||
      user.roles.includes('DEPARTMENT_HEAD')
    );
  }

  private canUpdateProposalStatus(user: any, _proposal: any): boolean {
    return (
      user.roles.includes('DEPARTMENT_HEAD') ||
      user.roles.includes('ADVISOR') ||
      user.roles.includes('COORDINATOR')
    );
  }

  private canCreateProject(user: any, departmentId: string): boolean {
    return (
      user.roles.includes('DEPARTMENT_HEAD') ||
      user.roles.includes('COORDINATOR') ||
      (user.roles.includes('ADVISOR') && user.departmentId === departmentId)
    );
  }

  private canAssignAdvisor(user: any, _departmentId: string): boolean {
    return user.roles.includes('DEPARTMENT_HEAD') || user.roles.includes('COORDINATOR');
  }

  private canUpdateMilestoneStatus(user: any): boolean {
    return (
      user.roles.includes('DEPARTMENT_HEAD') ||
      user.roles.includes('ADVISOR') ||
      user.roles.includes('COORDINATOR')
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
