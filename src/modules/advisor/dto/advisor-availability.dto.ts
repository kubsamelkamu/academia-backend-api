import { ApiProperty } from '@nestjs/swagger';

export class AdvisorAvailabilityDto {
  @ApiProperty()
  advisorId: string;

  @ApiProperty()
  advisorName: string;

  @ApiProperty()
  currentLoad: number;

  @ApiProperty()
  loadLimit: number;

  @ApiProperty()
  available: boolean;

  @ApiProperty()
  remainingCapacity: number;

  @ApiProperty()
  utilizationRate: number;

  @ApiProperty({ type: [String] })
  availableTimeSlots?: string[];

  @ApiProperty()
  nextAvailableSlot?: Date;

  @ApiProperty()
  totalProjects: number;

  @ApiProperty()
  activeProjects: number;

  @ApiProperty()
  completedProjects: number;

  @ApiProperty()
  pendingEvaluations: number;

  @ApiProperty()
  pendingReviews: number;
}
