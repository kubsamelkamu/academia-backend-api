export const ROLES = {
  PLATFORM_ADMIN: 'PlatformAdmin',
  DEPARTMENT_HEAD: 'DepartmentHead',
  ADVISOR: 'Advisor',
  COORDINATOR: 'Coordinator',
  DEPARTMENT_COMMITTEE: 'DepartmentCommittee',
  STUDENT: 'Student',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];
