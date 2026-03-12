export interface AdvisorAvailability {
  advisorId: string;
  currentLoad: number;
  loadLimit: number;
  available: boolean;
  remainingCapacity: number;
  utilizationRate: number;
}

export interface AdvisorProjectSummary {
  id: string;
  title: string;
  status: string;
  membersCount: number;
  milestonesCount: number;
  completedMilestones: number;
  pendingEvaluations: number;
  lastActivity?: Date;
  progress: number;
  dueDate?: Date;
}

export interface AdvisorEvaluationSummary {
  id: string;
  projectId: string;
  projectTitle: string;
  milestoneId?: string;
  milestoneTitle?: string;
  score?: number;
  status: string;
  createdAt: Date;
  studentNames?: string[];
}

export interface AdvisorReviewSummary {
  id: string;
  milestoneId: string;
  milestoneTitle: string;
  projectId: string;
  projectTitle: string;
  status: string;
  createdAt: Date;
  studentNames: string[];
  qualityScore?: number;
}

export interface AdvisorDashboardData {
  advisor: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    academicRank?: string;
    department: string;
    departmentId: string;
  };
  loadStats: {
    currentLoad: number;
    loadLimit: number;
    availableSlots: number;
    utilizationRate: number;
  };
  projectStats: {
    total: number;
    active: number;
    completed: number;
    overdue: number;
    inProgress: number;
  };
  evaluationStats: {
    pending: number;
    completed: number;
    averageScore: number;
    total: number;
  };
  reviewStats: {
    pending: number;
    completed: number;
    averageQuality: number;
    total: number;
  };
  recentActivities: Array<{
    id: string;
    type:
      | 'PROJECT_ASSIGNED'
      | 'MILESTONE_SUBMITTED'
      | 'EVALUATION_PENDING'
      | 'REVIEW_COMPLETED'
      | 'STUDENT_MESSAGE'
      | 'DEADLINE_APPROACHING';
    description: string;
    timestamp: Date;
    metadata?: any;
  }>;
  upcomingDeadlines: Array<{
    id: string;
    projectId: string;
    projectTitle: string;
    milestoneTitle: string;
    dueDate: Date;
    daysLeft: number;
    studentNames: string[];
    status: string;
  }>;
  performanceMetrics: {
    onTimeCompletion: number;
    averageFeedbackTime: number;
    studentSatisfaction?: number;
    evaluationTurnaround: number;
  };
}

export interface AdvisorNotification {
  id: string;
  type:
    | 'PROJECT_ASSIGNED'
    | 'MILESTONE_SUBMITTED'
    | 'EVALUATION_REMINDER'
    | 'REVIEW_REQUESTED'
    | 'STUDENT_MESSAGE'
    | 'DEADLINE_APPROACHING'
    | 'SYSTEM_ALERT';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: Date;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AdvisorLoadUpdate {
  advisorId: string;
  previousLoad: number;
  currentLoad: number;
  loadLimit: number;
  availableSlots: number;
  timestamp: Date;
  projectsAdded?: number;
  projectsRemoved?: number;
}

export interface AdvisorPerformanceReport {
  advisorId: string;
  advisorName: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    projectsSupervised: number;
    projectsCompleted: number;
    completionRate: number;
    averageProjectDuration: number;
    evaluationsDone: number;
    reviewsDone: number;
    averageEvaluationScore: number;
    averageFeedbackTime: number;
    onTimeSubmissions: number;
    lateSubmissions: number;
    feedbackResponseRate: number;
  };
  projects: Array<{
    id: string;
    title: string;
    status: string;
    students: string[];
    startDate: Date;
    endDate?: Date;
    duration: number;
    finalScore?: number;
    evaluationsCount: number;
  }>;
}
