export type TimesheetEntry = {
  id: number;
  tenantId: number;
  employeeId: number;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  hoursWorked: string | null;
  notes: string | null;
  createdAt: Date;
};

export type TimesheetMonthlySummary = {
  totalHours: number;
  totalDays: number;
  openDays: number;
  workedDays: number;
};

export type EmployeePerformanceMetrics = {
  osCompleted: number;
  avgCompletionDays: number;
  overdueRate: number;
  commissionsTotalCents: number;
  hoursThisMonth: number;
};
