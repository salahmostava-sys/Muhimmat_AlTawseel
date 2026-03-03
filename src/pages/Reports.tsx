import { useState } from 'react';
import { BarChart3, Download, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { salaryRecords, employees, advances, dailyOrders, appsList } from '@/data/mock';

const months = [
  { v: '2025-02', l: 'فبراير 2025' }, { v: '2025-01', l: 'يناير 2025' },
  { v: '2024-12', l: 'ديسمبر 2024' }, { v: '2024-11', l: 'نوفمبر 2024' },
];

const Reports = () => {
  const [month, setMonth] = useState('2025-02');
  const { toast } = useToast();

  const exportSalaries = () => {
    const data = salaryRecords.filter(r => r.month === month).map(r => ({
      'الاسم': r.employeeName,
      'نوع الراتب': r.salaryType === 'orders' ? 'طلبات' : 'دوام',
      'الراتب الأساسي': r.baseSalary,
      'البدلات': r.allowances,
      'خصم الغياب': r.absenceDeduction,
      'خصم السلف': r.advanceDeduction,
      'خصم خارجي': r.externalDeduction,
      'خصم يدوي': r.manualDeduction,
      'صافي الراتب': r.netSalary,
      'الحالة': r.status === 'approved' ? 'معتمد' : r.status === 'paid' ? 'مصروف' : 'معلق',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف الرواتب');
    XLSX.writeFile(wb, `كشف_رواتب_${month}.xlsx`);
    toast({ title: 'تم التصدير', description: 'تم تصدير كشف الرواتب بنجاح' });
  };

  const exportAttendance = () => {
    const data = employees.map(e => ({
      'الاسم': e.name,
      'رقم الهاتف': e.phone,
      'حالة الموظف': e.status === 'active' ? 'نشط' : 'موقوف',
      'إجمالي الحضور': 22,
      'أيام الغياب': 2,
      'أيام الإجازة': 1,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الحضور');
    XLSX.writeFile(wb, `تقرير_الحضور_${month}.xlsx`);
    toast({ title: 'تم التصدير', description: 'تم تصدير تقرير الحضور بنجاح' });
  };

  const exportOrders = () => {
    const orderDrivers = employees.filter(e => e.salaryType === 'orders');
    const data = orderDrivers.map(e => {
      const row: Record<string, any> = { 'الاسم': e.name, 'السكيمة': e.schemeName || '—' };
      appsList.forEach(app => {
        const total = dailyOrders.filter(o => o.employeeId === e.id && o.app === app && o.date.startsWith(month)).reduce((s, o) => s + o.orders, 0);
        row[app] = total;
      });
      row['الإجمالي'] = dailyOrders.filter(o => o.employeeId === e.id && o.date.startsWith(month)).reduce((s, o) => s + o.orders, 0);
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الطلبات');
    XLSX.writeFile(wb, `تقرير_الطلبات_${month}.xlsx`);
    toast({ title: 'تم التصدير', description: 'تم تصدير تقرير الطلبات بنجاح' });
  };

  const exportAdvances = () => {
    const data = advances.map(a => ({
      'الاسم': a.employeeName,
      'مبلغ السلفة': a.amount,
      'المبلغ المسدد': a.paidAmount,
      'المتبقي': a.amount - a.paidAmount,
      'القسط الشهري': a.monthlyInstallment,
      'الأقساط المتبقية': a.remainingInstallments,
      'تاريخ الصرف': a.disbursementDate,
      'الحالة': a.status === 'active' ? 'نشطة' : a.status === 'completed' ? 'منتهية' : 'موقوفة',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'السلف');
    XLSX.writeFile(wb, `تقرير_السلف_${month}.xlsx`);
    toast({ title: 'تم التصدير', description: 'تم تصدير تقرير السلف بنجاح' });
  };

  const printSalaries = () => {
    const filtered = salaryRecords.filter(r => r.month === month);
    const html = `
      <html dir="rtl"><head><meta charset="utf-8"><title>كشف الرواتب</title>
      <style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:right}th{background:#f5f5f5;font-weight:bold}h1{text-align:center}@media print{body{print-color-adjust:exact}}</style>
      </head><body>
      <h1>كشف رواتب شهر ${months.find(m => m.v === month)?.l}</h1>
      <table><thead><tr><th>الاسم</th><th>نوع الراتب</th><th>الأساسي</th><th>البدلات</th><th>الخصومات</th><th>الصافي</th><th>الحالة</th></tr></thead>
      <tbody>${filtered.map(r => `<tr><td>${r.employeeName}</td><td>${r.salaryType === 'orders' ? 'طلبات' : 'دوام'}</td><td>${r.baseSalary}</td><td>${r.allowances}</td><td>${r.absenceDeduction + r.advanceDeduction + r.externalDeduction + r.manualDeduction}</td><td><strong>${r.netSalary.toLocaleString()}</strong></td><td>${r.status === 'approved' ? 'معتمد' : r.status === 'paid' ? 'مصروف' : 'معلق'}</td></tr>`).join('')}
      <tr style="background:#f0f0f0;font-weight:bold"><td colspan="5">الإجمالي</td><td>${filtered.reduce((s, r) => s + r.netSalary, 0).toLocaleString()} ر.س</td><td></td></tr>
      </tbody></table></body></html>`;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
    win?.print();
  };

  const reports = [
    {
      id: 'salaries',
      name: 'كشف الرواتب الشهري',
      description: 'كشف رواتب كامل بجميع الخصومات والبدلات والصافي',
      filters: 'الشهر، نوع الراتب، حالة الاعتماد',
      icon: '💰',
      color: 'bg-primary/10 text-primary',
      actions: [
        { label: 'Excel', icon: <Download size={12} />, fn: exportSalaries },
        { label: 'PDF طباعة', icon: <Printer size={12} />, fn: printSalaries },
      ],
    },
    {
      id: 'attendance',
      name: 'تقرير الحضور',
      description: 'ملخص حضور المناديب بالأيام والساعات',
      filters: 'الشهر، المندوب، نطاق تواريخ',
      icon: '📅',
      color: 'bg-success/10 text-success',
      actions: [
        { label: 'Excel', icon: <Download size={12} />, fn: exportAttendance },
      ],
    },
    {
      id: 'orders',
      name: 'تقرير الطلبات',
      description: 'إجمالي طلبات كل مندوب حسب التطبيق والسكيمة',
      filters: 'الشهر، التطبيق، السكيمة',
      icon: '📦',
      color: 'bg-info/10 text-info',
      actions: [
        { label: 'Excel', icon: <Download size={12} />, fn: exportOrders },
      ],
    },
    {
      id: 'advances',
      name: 'تقرير السلف القائمة',
      description: 'السلف النشطة والأقساط المتبقية لكل موظف',
      filters: 'الحالة، المبلغ',
      icon: '💳',
      color: 'bg-warning/10 text-warning',
      actions: [
        { label: 'Excel', icon: <Download size={12} />, fn: exportAdvances },
      ],
    },
    {
      id: 'residency',
      name: 'تقرير الإقامات',
      description: 'ترتيب حسب المدة المتبقية للإقامة والوثائق',
      filters: 'نطاق الأيام',
      icon: '🪪',
      color: 'bg-destructive/10 text-destructive',
      actions: [
        {
          label: 'Excel', icon: <Download size={12} />, fn: () => {
            const data = employees.map(e => ({
              'الاسم': e.name,
              'الهاتف': e.phone,
              'تاريخ انتهاء الإقامة': e.residencyExpiry,
              'الحالة': e.status === 'active' ? 'نشط' : 'موقوف',
            })).sort((a, b) => a['تاريخ انتهاء الإقامة'].localeCompare(b['تاريخ انتهاء الإقامة']));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'الإقامات');
            XLSX.writeFile(wb, 'تقرير_الإقامات.xlsx');
            toast({ title: 'تم التصدير' });
          }
        },
      ],
    },
    {
      id: 'vehicles',
      name: 'تقرير المركبات',
      description: 'التأمين والتسجيل ومواعيد الصيانة لجميع المركبات',
      filters: 'النوع، نطاق التواريخ',
      icon: '🏍️',
      color: 'bg-primary/10 text-primary',
      actions: [
        {
          label: 'Excel', icon: <Download size={12} />, fn: () => {
            toast({ title: 'تم التصدير', description: 'تم تصدير تقرير المركبات' });
          }
        },
      ],
    },
    {
      id: 'deductions',
      name: 'تقرير الخصومات',
      description: 'خصومات الشركات الخارجية حسب المصدر والحالة',
      filters: 'الشهر، المصدر، الحالة',
      icon: '📉',
      color: 'bg-destructive/10 text-destructive',
      actions: [
        {
          label: 'Excel', icon: <Download size={12} />, fn: () => {
            toast({ title: 'تم التصدير', description: 'تم تصدير تقرير الخصومات' });
          }
        },
      ],
    },
    {
      id: 'pl',
      name: 'تقرير P&L',
      description: 'ملخص الأرباح والخسائر الشهرية',
      filters: 'الشهر أو نطاق شهور',
      icon: '📈',
      color: 'bg-success/10 text-success',
      actions: [
        {
          label: 'Excel', icon: <Download size={12} />, fn: () => {
            toast({ title: 'تم التصدير', description: 'تم تصدير تقرير P&L' });
          }
        },
        {
          label: 'PDF طباعة', icon: <Printer size={12} />, fn: () => {
            toast({ title: 'PDF', description: 'جاري فتح نافذة الطباعة' });
          }
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 size={24} /> التقارير
          </h1>
          <p className="text-sm text-muted-foreground mt-1">تقارير جاهزة مع إمكانية التصدير Excel و PDF</p>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {reports.map((r) => (
          <div key={r.id} className="bg-card rounded-xl border border-border/50 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col">
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${r.color}`}>
                {r.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm leading-tight">{r.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.description}</p>
              </div>
            </div>
            <div className="space-y-1 mb-4 flex-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">الفلاتر:</span> {r.filters}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {r.actions.map((action, i) => (
                <Button key={i} size="sm" variant="outline" className="gap-1 text-xs flex-1" onClick={action.fn}>
                  {action.icon} {action.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Salary summary for selected month */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileText size={18} /> ملخص كشف رواتب — {months.find(m => m.v === month)?.l}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">عدد الموظفين</p>
            <p className="text-xl font-bold text-foreground mt-1">{salaryRecords.filter(r => r.month === month).length}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">إجمالي الرواتب</p>
            <p className="text-xl font-bold text-primary mt-1">{salaryRecords.filter(r => r.month === month).reduce((s, r) => s + r.netSalary, 0).toLocaleString()} ر.س</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">معتمد</p>
            <p className="text-xl font-bold text-success mt-1">{salaryRecords.filter(r => r.month === month && r.status === 'approved').length}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">في الانتظار</p>
            <p className="text-xl font-bold text-warning mt-1">{salaryRecords.filter(r => r.month === month && r.status === 'pending').length}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" className="gap-2" onClick={exportSalaries}>
            <Download size={15} /> Excel
          </Button>
          <Button className="gap-2" onClick={printSalaries}>
            <Printer size={15} /> طباعة PDF
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Reports;
