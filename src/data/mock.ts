export interface Employee {
  id: string;
  name: string;
  phone: string;
  nationalId: string;
  status: 'active' | 'suspended' | 'terminated';
  salaryType: 'shift' | 'orders';
  residencyExpiry: string;
  apps: string[];
  monthlySalary?: number;
  schemeName?: string;
}

export interface Alert {
  id: string;
  type: 'residency' | 'insurance' | 'registration' | 'license' | 'installment' | 'deduction';
  entityName: string;
  dueDate: string;
  daysLeft: number;
  severity: 'urgent' | 'warning' | 'info';
}

export const employees: Employee[] = [
  { id: '1', name: 'أحمد محمد العمري', phone: '0551234567', nationalId: '2123456789', status: 'active', salaryType: 'orders', residencyExpiry: '2025-08-15', apps: ['هنقرستيشن', 'جاهز'], schemeName: 'سكيمة هنقر' },
  { id: '2', name: 'خالد عبدالله السهلي', phone: '0559876543', nationalId: '2198765432', status: 'active', salaryType: 'shift', residencyExpiry: '2025-04-20', apps: ['كيتا', 'توبو'], monthlySalary: 3000 },
  { id: '3', name: 'عمر سعيد الحربي', phone: '0553456789', nationalId: '2134567890', status: 'active', salaryType: 'orders', residencyExpiry: '2026-01-10', apps: ['جاهز', 'نينجا'], schemeName: 'سكيمة جاهز' },
  { id: '4', name: 'فهد ناصر القحطاني', phone: '0557654321', nationalId: '2176543210', status: 'suspended', salaryType: 'shift', residencyExpiry: '2025-03-01', apps: ['هنقرستيشن'], monthlySalary: 2800 },
  { id: '5', name: 'سلطان بندر الدوسري', phone: '0552345678', nationalId: '2145678901', status: 'active', salaryType: 'orders', residencyExpiry: '2025-12-25', apps: ['كيتا', 'هنقرستيشن', 'جاهز'], schemeName: 'سكيمة كيتا' },
  { id: '6', name: 'ياسر محمد الزهراني', phone: '0558765432', nationalId: '2187654321', status: 'active', salaryType: 'shift', residencyExpiry: '2025-09-30', apps: ['توبو'], monthlySalary: 3200 },
  { id: '7', name: 'مشاري سعد الشمري', phone: '0554567890', nationalId: '2156789012', status: 'terminated', salaryType: 'orders', residencyExpiry: '2025-02-28', apps: ['نينجا'], schemeName: 'سكيمة نينجا' },
  { id: '8', name: 'عبدالرحمن فيصل المطيري', phone: '0556543210', nationalId: '2167890123', status: 'active', salaryType: 'orders', residencyExpiry: '2025-11-15', apps: ['جاهز', 'كيتا'], schemeName: 'سكيمة جاهز' },
];

export const alerts: Alert[] = [
  { id: '1', type: 'residency', entityName: 'فهد ناصر القحطاني', dueDate: '2025-03-01', daysLeft: 4, severity: 'urgent' },
  { id: '2', type: 'residency', entityName: 'مشاري سعد الشمري', dueDate: '2025-02-28', daysLeft: 1, severity: 'urgent' },
  { id: '3', type: 'insurance', entityName: 'دراجة DRG-012', dueDate: '2025-03-20', daysLeft: 23, severity: 'warning' },
  { id: '4', type: 'license', entityName: 'خالد عبدالله السهلي', dueDate: '2025-04-20', daysLeft: 54, severity: 'warning' },
  { id: '5', type: 'installment', entityName: 'أحمد محمد العمري', dueDate: '2025-03-01', daysLeft: 4, severity: 'info' },
  { id: '6', type: 'registration', entityName: 'دراجة DRG-045', dueDate: '2025-04-15', daysLeft: 49, severity: 'warning' },
];

export const kpis = {
  activeEmployees: 6,
  totalSalaries: 18500,
  activeAdvances: 3,
  totalAdvancesAmount: 8500,
  presentToday: 5,
  absentToday: 1,
};

export const ordersByApp = [
  { app: 'هنقرستيشن', orders: 1250 },
  { app: 'جاهز', orders: 980 },
  { app: 'كيتا', orders: 720 },
  { app: 'توبو', orders: 450 },
  { app: 'نينجا', orders: 320 },
];

export const attendanceWeek = [
  { day: 'سبت', present: 6, absent: 1, leave: 1 },
  { day: 'أحد', present: 7, absent: 0, leave: 1 },
  { day: 'اثنين', present: 5, absent: 2, leave: 1 },
  { day: 'ثلاثاء', present: 6, absent: 1, leave: 1 },
  { day: 'أربعاء', present: 7, absent: 1, leave: 0 },
  { day: 'خميس', present: 5, absent: 2, leave: 1 },
];
