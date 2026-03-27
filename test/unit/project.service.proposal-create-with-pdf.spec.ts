import { BadRequestException } from '@nestjs/common';
import { ProjectService } from '../../src/modules/project/project.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('ProjectService.createProposalDraftWithPdf', () => {
  const repo: any = {
    findUserForProjectMembership: jest.fn(),
    findGroupLeaderRequestStatus: jest.fn(),
    findApprovedProjectGroupByLeader: jest.fn(),
    createProposal: jest.fn(),
    updateProposalDocuments: jest.fn(),
    deleteProposal: jest.fn(),
  };

  const notificationService: any = {};

  const cloudinaryService: any = {
    uploadProposalPdf: jest.fn(),
  };

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(repo, notificationService, cloudinaryService);

    repo.findUserForProjectMembership.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      departmentId: 'd1',
      status: 'ACTIVE',
    });

    repo.findGroupLeaderRequestStatus.mockResolvedValue({ status: 'APPROVED' });

    repo.findApprovedProjectGroupByLeader.mockResolvedValue({
      id: 'g1',
      status: 'APPROVED',
    });
  });

  it('creates draft and stores proposal.pdf document', async () => {
    repo.createProposal.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
    });

    cloudinaryService.uploadProposalPdf.mockResolvedValue({
      secureUrl: 'https://example.com/p.pdf',
      publicId: 'public-1',
      resourceType: 'raw',
    });

    repo.updateProposalDocuments.mockResolvedValue({ id: 'p1' });

    const file: any = {
      mimetype: 'application/pdf',
      size: 123,
      buffer: Buffer.from('pdf'),
      originalname: 'proposal.pdf',
    };

    const result = await service.createProposalDraftWithPdf(
      {
        titles: ['t1', 't2', 't3'],
        description: 'desc',
      },
      file,
      { sub: 'u1', roles: [ROLES.STUDENT] }
    );

    expect(repo.createProposal).toHaveBeenCalled();
    expect(cloudinaryService.uploadProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({ proposalId: 'p1', tenantId: 't1', departmentId: 'd1', userId: 'u1' })
    );
    expect(repo.updateProposalDocuments).toHaveBeenCalledWith(
      'p1',
      expect.arrayContaining([expect.objectContaining({ key: 'proposal.pdf', url: expect.any(String) })])
    );
    expect(result).toEqual({ id: 'p1' });
  });

  it('rolls back created draft when upload fails', async () => {
    repo.createProposal.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
    });

    cloudinaryService.uploadProposalPdf.mockRejectedValue(new Error('Upload failed'));

    const file: any = {
      mimetype: 'application/pdf',
      size: 123,
      buffer: Buffer.from('pdf'),
      originalname: 'proposal.pdf',
    };

    await expect(
      service.createProposalDraftWithPdf(
        {
          titles: ['t1', 't2', 't3'],
          description: 'desc',
        },
        file,
        { sub: 'u1', roles: [ROLES.STUDENT] }
      )
    ).rejects.toBeInstanceOf(Error);

    expect(repo.deleteProposal).toHaveBeenCalledWith('p1');
  });

  it('rejects non-pdf file', async () => {
    const file: any = {
      mimetype: 'image/png',
      size: 123,
      buffer: Buffer.from('x'),
      originalname: 'x.png',
    };

    await expect(
      service.createProposalDraftWithPdf(
        {
          titles: ['t1', 't2', 't3'],
          description: 'desc',
        },
        file,
        { sub: 'u1', roles: [ROLES.STUDENT] }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
