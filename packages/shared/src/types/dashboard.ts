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
  newThisMonth: number;
};

export type InventoryKpis = {
  totalItems: number;
  belowMinimum: number;
  totalValueCents: number;
};

export type EmployeeKpis = {
  total: number;
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
  };
  generatedAt: string;
};
