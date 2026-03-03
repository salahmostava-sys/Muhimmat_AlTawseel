import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Wallet, Download, CheckCircle, Printer, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { salaryRecords } from '@/data/mock';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

const statusLabels: Record<string, string> = { pending: 'معلق', approved: 'معتمد', paid: 'مصروف' };
const statusStyles: Record<string, string> = { pending: 'badge-warning', approved: 'badge-info', paid: 'badge-success' };

const months = [
  { v: '2025-02', l: 'فبراير 2025' }, { v: '2025-01', l: 'يناير 2025' },
  { v: '2024-12', l: 'ديسمبر 2024' }, { v: '2024-11', l: 'نوفمبر 2024' },
];

// ─── Payslip ──────────────────────────────────────────────────────
const PayslipModal = ({ record, onClose }: { record: (typeof salaryRecords)[0]; onClose: () => void }) => {
  const printPayslip = () => {
    const html = `
      <html dir="rtl"><head><meta charset="utf-8"><title>كشف راتب</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;max-width:600px;margin:0 auto}
        .header{text-align:center;border-bottom:2px solid #333;padding-bottom:15px;margin-bottom:20px}
        .logo{font-size:24px;font-weight:bold}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        td{padding:8px 12px;border:1px solid #ddd}
        .label{background:#f5f5f5;font-weight:600;width:50%}
        .value{text-align:left}
        .total-row{background:#e8f4fd;font-weight:bold;font-size:16px}
        .footer{margin-top:30px;display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:20px}
      </style>
      </head><body>
      <div class="header"><div class="logo">🚀 نظام التوصيل</div>
      <p style="color:#666;margin:5px 0">كشف راتب — ${months.find(m => m.v === record.month)?.l || record.month}</p></div>
      <h3>بيانات الموظف</h3>
      <table>
        <tr><td class="label">الاسم</td><td class="value">${record.employeeName}</td></tr>
        <tr><td class="label">نوع الراتب</td><td class="value">${record.salaryType === 'orders' ? 'راتب طلبات' : 'راتب دوام'}</td></tr>
        <tr><td class="label">الشهر</td><td class="value">${months.find(m => m.v === record.month)?.l}</td></tr>
      </table>
      <h3 style="margin-top:20px">تفاصيل الراتب</h3>
      <table>
        <tr><td class="label">الراتب الأساسي</td><td class="value">${record.baseSalary.toLocaleString()} ر.س</td></tr>
        <tr><td class="label">البدلات</td><td class="value" style="color:green">+ ${record.allowances.toLocaleString()} ر.س</td></tr>
        ${record.absenceDeduction > 0 ? `<tr><td class="label">خصم الغياب</td><td class="value" style="color:red">- ${record.absenceDeduction.toLocaleString()} ر.س</td></tr>` : ''}
        ${record.advanceDeduction > 0 ? `<tr><td class="label">خصم السلفة</td><td class="value" style="color:red">- ${record.advanceDeduction.toLocaleString()} ر.س</td></tr>` : ''}
        ${record.externalDeduction > 0 ? `<tr><td class="label">خصم خارجي</td><td class="value" style="color:red">- ${record.externalDeduction.toLocaleString()} ر.س</td></tr>` : ''}
        ${record.manualDeduction > 0 ? `<tr><td class="label">خصم يدوي</td><td class="value" style="color:red">- ${record.manualDeduction.toLocaleString()} ر.س</td></tr>` : ''}
        <tr class="total-row"><td class="label">صافي الراتب</td><td class="value">${record.netSalary.toLocaleString()} ر.س</td></tr>
      </table>
      <div class="footer">
        <div>توقيع الموظف: _______________</div>
        <div>اعتماد الإدارة: _______________</div>
      </div>
      </body></html>`;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
    win?.print();
  };

  const totalDeductions = record.absenceDeduction + record.advanceDeduction + record.externalDeduction + record.manualDeduction;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>كشف راتب — {record.employeeName}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">الشهر:</span> <span className="font-medium">{months.find(m => m.v === record.month)?.l}</span></div>
            <div><span className="text-muted-foreground">النوع:</span> <span className="font-medium">{record.salaryType === 'orders' ? 'طلبات' : 'دوام'}</span></div>
            <div><span className="text-muted-foreground">الحالة:</span> <span className={statusStyles[record.status]}>{statusLabels[record.status]}</span></div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">الراتب الأساسي</span>
              <span className="font-semibold">{record.baseSalary.toLocaleString()} ر.س</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-success">+ البدلات</span>
              <span className="font-semibold text-success">+{record.allowances.toLocaleString()} ر.س</span>
            </div>
            {record.absenceDeduction > 0 && (
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-destructive">- خصم الغياب</span>
                <span className="font-semibold text-destructive">-{record.absenceDeduction.toLocaleString()} ر.س</span>
              </div>
            )}
            {record.advanceDeduction > 0 && (
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-destructive">- خصم السلفة</span>
                <span className="font-semibold text-destructive">-{record.advanceDeduction.toLocaleString()} ر.س</span>
              </div>
            )}
            {record.externalDeduction > 0 && (
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-destructive">- خصم خارجي</span>
                <span className="font-semibold text-destructive">-{record.externalDeduction.toLocaleString()} ر.س</span>
              </div>
            )}
            {record.manualDeduction > 0 && (
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-destructive">- خصم يدوي</span>
                <span className="font-semibold text-destructive">-{record.manualDeduction.toLocaleString()} ر.س</span>
              </div>
            )}
            <div className="flex justify-between items-center py-3 bg-primary/5 rounded-lg px-3 mt-2">
              <span className="font-bold text-foreground">صافي الراتب</span>
              <span className="text-xl font-bold text-primary">{record.netSalary.toLocaleString()} ر.س</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <Button onClick={printPayslip} className="gap-2"><Printer size={14} /> طباعة PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Month Accounting ─────────────────────────────────────────────
const MonthAccounting = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('2025-02');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [payslipRecord, setPayslipRecord] = useState<(typeof salaryRecords)[0] | null>(null);
  const [records, setRecords] = useState(salaryRecords);

  const filtered = records.filter(r => {
    const matchSearch = r.employeeName.includes(search);
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchType = typeFilter === 'all' || r.salaryType === typeFilter;
    const matchMonth = r.month === selectedMonth;
    return matchSearch && matchStatus && matchType && matchMonth;
  });

  const totalNet = filtered.reduce((s, r) => s + r.netSalary, 0);
  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(r => r.id)));

  const approveSelected = () => {
    setRecords(prev => prev.map(r => selected.has(r.id) ? { ...r, status: 'approved' as const } : r));
    toast({ title: `✅ تم اعتماد ${selected.size} راتب` });
    setSelected(new Set());
  };

  const exportExcel = () => {
    const data = filtered.map(r => ({
      'الاسم': r.employeeName, 'نوع الراتب': r.salaryType === 'orders' ? 'طلبات' : 'دوام',
      'الراتب الأساسي': r.baseSalary, 'البدلات': r.allowances,
      'إجمالي الخصومات': r.absenceDeduction + r.advanceDeduction + r.externalDeduction + r.manualDeduction,
      'صافي الراتب': r.netSalary, 'الحالة': statusLabels[r.status],
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الرواتب');
    XLSX.writeFile(wb, `رواتب_${selectedMonth}.xlsx`);
    toast({ title: 'تم التصدير' });
  };

  return (
    <div className="space-y-4">
      {/* Month selector + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-background text-sm">
          {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." className="pr-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'الكل' }, { v: 'shift', l: 'دوام' }, { v: 'orders', l: 'طلبات' }].map(t => (
            <button key={t.v} onClick={() => setTypeFilter(t.v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === t.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{t.l}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'الكل' }, { v: 'pending', l: 'معلق' }, { v: 'approved', l: 'معتمد' }, { v: 'paid', l: 'مصروف' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{s.l}</button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-xs text-muted-foreground">إجمالي الرواتب</p><p className="text-2xl font-bold text-primary mt-1">{totalNet.toLocaleString()}<span className="text-xs mr-1">ر.س</span></p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">عدد الموظفين</p><p className="text-2xl font-bold text-foreground mt-1">{filtered.length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">معتمد</p><p className="text-2xl font-bold text-success mt-1">{filtered.filter(r => r.status === 'approved').length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">في انتظار الاعتماد</p><p className="text-2xl font-bold text-warning mt-1">{filtered.filter(r => r.status === 'pending').length}</p></div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="p-3 w-8">
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll} className="cursor-pointer" />
                </th>
                <th className="text-right p-3 text-sm font-semibold text-muted-foreground">المندوب</th>
                <th className="text-right p-3 text-sm font-semibold text-muted-foreground">النوع</th>
                <th className="text-center p-3 text-sm font-semibold text-muted-foreground">الأساسي</th>
                <th className="text-center p-3 text-sm font-semibold text-success">البدلات</th>
                <th className="text-center p-3 text-sm font-semibold text-destructive">الخصومات</th>
                <th className="text-center p-3 text-sm font-semibold text-primary">الصافي</th>
                <th className="text-center p-3 text-sm font-semibold text-muted-foreground">الحالة</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const totalDed = r.absenceDeduction + r.advanceDeduction + r.externalDeduction + r.manualDeduction;
                return (
                  <tr key={r.id} className={`border-b border-border/30 hover:bg-muted/20 ${selected.has(r.id) ? 'bg-primary/5' : ''}`}>
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="cursor-pointer" />
                    </td>
                    <td className="p-3 text-sm font-medium text-foreground">{r.employeeName}</td>
                    <td className="p-3 text-sm text-muted-foreground">{r.salaryType === 'orders' ? 'طلبات' : 'دوام'}</td>
                    <td className="p-3 text-center text-sm">{r.baseSalary.toLocaleString()}</td>
                    <td className="p-3 text-center text-sm text-success">+{r.allowances}</td>
                    <td className="p-3 text-center text-sm text-destructive">{totalDed > 0 ? `-${totalDed}` : '—'}</td>
                    <td className="p-3 text-center text-sm font-bold text-primary">{r.netSalary.toLocaleString()}</td>
                    <td className="p-3 text-center"><span className={statusStyles[r.status]}>{statusLabels[r.status]}</span></td>
                    <td className="p-3">
                      <button onClick={() => setPayslipRecord(r)} className="text-xs text-primary hover:underline">
                        كشف راتب
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3 justify-between">
        <p className="text-sm text-muted-foreground">{selected.size > 0 && `${selected.size} محدد`}</p>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={exportExcel}><Download size={15} /> Excel</Button>
          {selected.size > 0 && (
            <Button className="gap-2" onClick={approveSelected}><CheckCircle size={15} /> اعتماد المحددين ({selected.size})</Button>
          )}
        </div>
      </div>

      {payslipRecord && <PayslipModal record={payslipRecord} onClose={() => setPayslipRecord(null)} />}
    </div>
  );
};

const Salaries = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Wallet size={24} /> الرواتب</h1>
      <p className="text-sm text-muted-foreground mt-1">محاسبة الشهر وكشف الرواتب القابل للطباعة</p>
    </div>
    <Tabs defaultValue="accounting" dir="rtl">
      <TabsList>
        <TabsTrigger value="accounting">محاسبة الشهر</TabsTrigger>
        <TabsTrigger value="history">سجل الصرف</TabsTrigger>
      </TabsList>
      <TabsContent value="accounting" className="mt-4"><MonthAccounting /></TabsContent>
      <TabsContent value="history" className="mt-4">
        <div className="text-center py-16 text-muted-foreground">
          <Wallet size={48} className="mx-auto mb-3 opacity-20" />
          <p>سجل الصرف للأشهر السابقة</p>
        </div>
      </TabsContent>
    </Tabs>
  </div>
);

export default Salaries;
