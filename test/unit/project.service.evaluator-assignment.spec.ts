import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectService } from '../../src/modules/project/project.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('ProjectService evaluator assignment', () => {
  const repo: any = {
    findProjectById: jest.fn(),
    findAdvisorsByUserIds: jest.fn(),
    replaceProjectEvaluators: jest.fn(),
    removeProjectEvaluator: jest.fn(),
    findProjectMembers: jest.fn(),
    findProjectEvaluators: jest.fn(),
    findEligibleProjectEvaluators: jest.fn(),
    findUserForProjectMembership: jest.fn(),
  };

  const notificationService: any = {};
  notificationService.notifyProjectEvaluatorsAssigned = jest.fn();
  notificationService.notifyProjectEvaluatorRemoved = jest.fn();
  const cloudinaryService: any = {};
  const projectEmailService: any = {};

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(repo, notificationService, cloudinaryService, projectEmailService);
  });

  it('rejects assigning the same advisor as evaluator for the same project', async () => {
    repo.findProjectById.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      advisorId: 'advisor-user-1',
    });

    await expect(
      service.assignProjectEvaluators(
        'p1',
        { evaluatorIds: ['advisor-user-1', 'advisor-user-2'] } as any,
        { sub: 'staff-1', roles: [ROLES.COORDINATOR] }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assigns multiple evaluators when all are valid advisors in the same department', async () => {
    repo.findProjectById.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      advisorId: 'advisor-user-1',
    });
    repo.findAdvisorsByUserIds.mockResolvedValue([
      { userId: 'advisor-user-2', departmentId: 'd1' },
      { userId: 'advisor-user-3', departmentId: 'd1' },
    ]);
    repo.replaceProjectEvaluators.mockResolvedValue([
      { evaluatorUserId: 'advisor-user-2' },
      { evaluatorUserId: 'advisor-user-3' },
    ]);

    const result = await service.assignProjectEvaluators(
      'p1',
      { evaluatorIds: ['advisor-user-2', 'advisor-user-3'] } as any,
      { sub: 'staff-1', roles: [ROLES.DEPARTMENT_HEAD] }
    );

    expect(repo.replaceProjectEvaluators).toHaveBeenCalledWith('p1', [
      'advisor-user-2',
      'advisor-user-3',
    ]);
    expect(result).toEqual({
      projectId: 'p1',
      evaluators: [{ evaluatorUserId: 'advisor-user-2' }, { evaluatorUserId: 'advisor-user-3' }],
    });
    expect(notificationService.notifyProjectEvaluatorsAssigned).toHaveBeenCalledWith({
      tenantId: 't1',
      projectId: 'p1',
      evaluatorUserIds: ['advisor-user-2', 'advisor-user-3'],
      actorUserId: 'staff-1',
    });
  });

  it('rejects evaluator assignment when project does not exist', async () => {
    repo.findProjectById.mockResolvedValue(null);

    await expect(
      service.assignProjectEvaluators(
        'missing-project',
        { evaluatorIds: ['advisor-user-2'] } as any,
        { sub: 'staff-1', roles: [ROLES.DEPARTMENT_HEAD] }
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects evaluator assignment for unauthorized role', async () => {
    repo.findProjectById.mockResolvedValue({
      id: 'p1',
      departmentId: 'd1',
      advisorId: 'advisor-user-1',
    });

    await expect(
      service.assignProjectEvaluators(
        'p1',
        { evaluatorIds: ['advisor-user-2'] } as any,
        { sub: 'staff-1', roles: [ROLES.ADVISOR] }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns eligible evaluators excluding project advisor and already assigned evaluators', async () => {
    repo.findProjectById.mockResolvedValue({
      id: 'p1',
      departmentId: 'd1',
      advisorId: 'advisor-user-1',
    });
    repo.findProjectEvaluators.mockResolvedValue([
      { evaluatorUserId: 'advisor-user-2' },
      { evaluatorUserId: 'advisor-user-3' },
    ]);
    repo.findEligibleProjectEvaluators.mockResolvedValue([
      { userId: 'advisor-user-4' },
      { userId: 'advisor-user-5' },
    ]);

    const result = await service.getEligibleProjectEvaluators('p1', {
      sub: 'staff-1',
      roles: [ROLES.COORDINATOR],
    });

    expect(repo.findEligibleProjectEvaluators).toHaveBeenCalledWith({
      departmentId: 'd1',
      excludedUserIds: ['advisor-user-1', 'advisor-user-2', 'advisor-user-3'],
    });

    expect(result).toEqual({
      projectId: 'p1',
      excludedUserIds: ['advisor-user-1', 'advisor-user-2', 'advisor-user-3'],
      eligible: [{ userId: 'advisor-user-4' }, { userId: 'advisor-user-5' }],
    });
  });

  it('rejects eligible evaluator list for unauthorized role', async () => {
    repo.findProjectById.mockResolvedValue({
      id: 'p1',
      departmentId: 'd1',
      advisorId: 'advisor-user-1',
    });

    await expect(
      service.getEligibleProjectEvaluators('p1', { sub: 'staff-1', roles: [ROLES.ADVISOR] })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('removes a single project evaluator and returns updated evaluator list', async () => {
    repo.findProjectById.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      advisorId: 'advisor-user-1',
    });
    repo.removeProjectEvaluator.mockResolvedValue(true);
    repo.findProjectEvaluators.mockResolvedValue([{ evaluatorUserId: 'advisor-user-3' }]);

    const result = await service.removeProjectEvaluator('p1', 'advisor-user-2', {
      sub: 'staff-1',
      roles: [ROLES.COORDINATOR],
    });

    expect(repo.removeProjectEvaluator).toHaveBeenCalledWith('p1', 'advisor-user-2');
    expect(notificationService.notifyProjectEvaluatorRemoved).toHaveBeenCalledWith({
      tenantId: 't1',
      projectId: 'p1',
      evaluatorUserId: 'advisor-user-2',
      actorUserId: 'staff-1',
    });
    expect(result).toEqual({
      projectId: 'p1',
      removedEvaluatorUserId: 'advisor-user-2',
      evaluators: [{ evaluatorUserId: 'advisor-user-3' }],
    });
  });

  it('rejects remove evaluator when assignment does not exist', async () => {
    repo.findProjectById.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      advisorId: 'advisor-user-1',
    });
    repo.removeProjectEvaluator.mockResolvedValue(false);

    await expect(
      service.removeProjectEvaluator('p1', 'advisor-user-x', {
        sub: 'staff-1',
        roles: [ROLES.COORDINATOR],
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
