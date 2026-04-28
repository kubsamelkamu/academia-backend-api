import { CoordinatorAdvisorChatService } from '../../src/modules/chat/coordinator-advisor-chat.service';

describe('CoordinatorAdvisorChatService advisor discovery', () => {
  const authRepository: any = {
    findUserById: jest.fn(),
  };

  const repository: any = {
    findDepartmentAdvisorByUserId: jest.fn(),
    listAdvisorVisibleCoordinators: jest.fn(),
    countAdvisorVisibleCoordinators: jest.fn(),
    listExistingRoomsForAdvisor: jest.fn(),
  };

  const cloudinary: any = {};

  let service: CoordinatorAdvisorChatService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new CoordinatorAdvisorChatService(authRepository, repository, cloudinary);
  });

  it('returns advisor-visible coordinators with existing room hints', async () => {
    authRepository.findUserById.mockResolvedValue({
      id: 'advisor-user-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      roles: [{ revokedAt: null, role: { name: 'Advisor' } }],
    });

    repository.findDepartmentAdvisorByUserId.mockResolvedValue({
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
      user: { id: 'advisor-user-1' },
    });

    repository.listAdvisorVisibleCoordinators.mockResolvedValue([
      {
        id: 'coord-1',
        firstName: 'Abebe',
        lastName: 'Kebede',
        email: 'abebe@academia.et',
        avatarUrl: null,
        departmentId: 'dept-1',
        department: { id: 'dept-1', name: 'Computer Science' },
      },
    ]);

    repository.countAdvisorVisibleCoordinators.mockResolvedValue(1);

    repository.listExistingRoomsForAdvisor.mockResolvedValue([
      { id: 'room-1', coordinatorUserId: 'coord-1' },
    ]);

    const result = await service.listAdvisorVisibleCoordinators(
      { sub: 'advisor-user-1', tenantId: 'tenant-1' },
      { search: 'abebe', limit: 20 }
    );

    expect(repository.listAdvisorVisibleCoordinators).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      search: 'abebe',
      cursorUserId: undefined,
      take: 21,
    });

    expect(result).toEqual({
      items: [
        {
          userId: 'coord-1',
          firstName: 'Abebe',
          lastName: 'Kebede',
          email: 'abebe@academia.et',
          avatarUrl: null,
          roleName: 'COORDINATOR',
          departmentId: 'dept-1',
          departmentName: 'Computer Science',
          isDirectChatEligible: true,
          existingRoomId: 'room-1',
        },
      ],
      pagination: {
        limit: 20,
        nextCursor: null,
        hasNext: false,
        total: 1,
      },
    });
  });

  it('returns empty items when no eligible coordinators exist', async () => {
    authRepository.findUserById.mockResolvedValue({
      id: 'advisor-user-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      roles: [{ revokedAt: null, role: { name: 'Advisor' } }],
    });

    repository.findDepartmentAdvisorByUserId.mockResolvedValue({
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
      user: { id: 'advisor-user-1' },
    });

    repository.listAdvisorVisibleCoordinators.mockResolvedValue([]);
    repository.countAdvisorVisibleCoordinators.mockResolvedValue(0);
    repository.listExistingRoomsForAdvisor.mockResolvedValue([]);

    const result = await service.listAdvisorVisibleCoordinators(
      { sub: 'advisor-user-1', tenantId: 'tenant-1' },
      {}
    );

    expect(result).toEqual({
      items: [],
      pagination: {
        limit: 20,
        nextCursor: null,
        hasNext: false,
        total: 0,
      },
    });
  });

  it('throws forbidden-like error when caller is not advisor', async () => {
    authRepository.findUserById.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      roles: [{ revokedAt: null, role: { name: 'Coordinator' } }],
    });

    await expect(
      service.listAdvisorVisibleCoordinators({ sub: 'user-1', tenantId: 'tenant-1' }, {})
    ).rejects.toMatchObject({
      message: 'Advisor role is required',
    });
  });

  it('applies search and cursor pagination behavior', async () => {
    authRepository.findUserById.mockResolvedValue({
      id: 'advisor-user-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      roles: [{ revokedAt: null, role: { name: 'Advisor' } }],
    });

    repository.findDepartmentAdvisorByUserId.mockResolvedValue({
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
      user: { id: 'advisor-user-1' },
    });

    repository.listAdvisorVisibleCoordinators.mockResolvedValue([
      {
        id: 'coord-2',
        firstName: 'Biniam',
        lastName: 'Alemu',
        email: 'biniam@academia.et',
        avatarUrl: null,
        departmentId: 'dept-1',
        department: { id: 'dept-1', name: 'Computer Science' },
      },
      {
        id: 'coord-3',
        firstName: 'Hana',
        lastName: 'Tadesse',
        email: 'hana@academia.et',
        avatarUrl: null,
        departmentId: 'dept-1',
        department: { id: 'dept-1', name: 'Computer Science' },
      },
    ]);

    repository.countAdvisorVisibleCoordinators.mockResolvedValue(3);
    repository.listExistingRoomsForAdvisor.mockResolvedValue([]);

    const cursor = Buffer.from(JSON.stringify({ userId: 'coord-1' }), 'utf8').toString('base64url');

    const result = await service.listAdvisorVisibleCoordinators(
      { sub: 'advisor-user-1', tenantId: 'tenant-1' },
      { search: 'bin', limit: 1, cursor }
    );

    expect(repository.listAdvisorVisibleCoordinators).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      search: 'bin',
      cursorUserId: 'coord-1',
      take: 2,
    });

    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.nextCursor).toBeTruthy();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].userId).toBe('coord-2');
  });
});
