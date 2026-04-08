export type FinancialKpis = {
  pendingArCents: number;
  overdueArCents: number;
  monthRevenueCents: number;
  monthExpensesCents: number;
  cashFlowCents: number;
};

export type JobKpis = {
  active: number;
  completed: number;
  overdue: number;
  pending: number;
};

export type ClientKpis = {
  total: number;
  active: number;        // status = 'active' AND deletedAt IS NULL
  newThisMonth: number;
};

export type InventoryKpis = {
  totalItems: number;
  belowMinimum: number;
  totalValueCents: number;
};

export type EmployeeKpis = {
  total: number;
  commissionPendingCents: number;  // commission_payments pendentes do mês
  pendingAssignments: number;      // job_assignments em trabalhos ativos
};

export type RecentJob = {
  id: number;
  code: string;
  clientName: string;
  status: string;
  dueDate: string | null;
  totalCents: number;
  createdAt: string;
};

export type TodayDeliveries = {
  scheduled: number;
  inTransit: number;
  delivered: number;
  failed: number;
  total: number;
};

export type MonthRevenue = {
  period: string; // 'YYYY-MM'
  totalAmountCents: number;
};

export type ServiceDistribution = {
  name: string;
  totalCents: number;
};

export type JobsTrend = {
  period: string; // 'YYYY-MM'
  created: number;
  delivered: number;
};

// 4 pontos semanais (semana mais antiga primeiro, mais recente por último)
export type SparklineData = {
  points: number[];
  trend: 'up' | 'down' | 'neutral';
  changePercent: number;
};

export type DashboardSparklines = {
  revenue: SparklineData;
  activeJobs: SparklineData;
  newClients: SparklineData;
};

export type DashboardSummary = {
  financial: FinancialKpis;
  jobs: JobKpis;
  clients: ClientKpis;
  inventory: InventoryKpis;
  employees: EmployeeKpis;
  recentJobs: RecentJob[];
  todayDeliveries: TodayDeliveries;
  charts: {
    monthlyRevenue: MonthRevenue[];
    serviceDistribution: ServiceDistribution[];
    jobsTrend: JobsTrend[];
  };
  sparklines: DashboardSparklines;
  generatedAt: string;
};
