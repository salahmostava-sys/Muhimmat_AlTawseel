import { useState, useRef, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Search, Save, Package, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { employees, dailyOrders, appsList, salarySchemes } from '@/data/mock';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

// ─── Salary calculator ─────────────────────────────────────────────
const calcSalary = (orders: number, schemeName?: string) => {
  const scheme = salarySchemes.find(s => s.name === schemeName && s.status === 'active');
  if (!scheme) return orders * 5;
  let salary = 0;
  for (const tier of scheme.tiers) {
    if (orders <= 0) break;
    const tierMax = tier.to === 9999 ? orders : Math.min(orders, tier.to);
    const inTier = Math.max(0, tierMax - tier.from + 1);
    salary += inTier * tier.pricePerOrder;
    orders -= inTier;
  }
  if (scheme.targetBonus) {
    const original = scheme.tiers.reduce((t, tier) => {
      return t + Math.max(0, (Math.min(orders + t, tier.to) - tier.from + 1)) * tier.pricePerOrder;
    }, 0);
    const totalOrders = scheme.tiers.reduce((s, t) => s + Math.max(0, Math.min(orders + s, t.to === 9999 ? orders + s : t.to) - t.from + 1), 0);
    if (totalOrders >= scheme.targetBonus.target) salary += scheme.targetBonus.bonus;
  }
  return Math.round(salary);
};

const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

// ─── Spreadsheet Grid ──────────────────────────────────────────────
const SpreadsheetGrid = () => {
  const { toast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedApp, setSelectedApp] = useState('الكل');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ empId: string; day: number } | null>(null);
  const [editVal, setEditVal] = useState('');
  const [data, setData] = useState<Record<string, Record<number, number>>>(() => {
    const init: Record<string, Record<number, number>> = {};
    const orderDrivers = employees.filter(e => e.salaryType === 'orders' && e.status !== 'terminated');
    orderDrivers.forEach(e => {
      init[e.id] = {};
      dailyOrders.filter(o => o.employeeId === e.id).forEach(o => {
        const d = new Date(o.date);
        if (d.getFullYear() === year && d.getMonth() + 1 === month) {
          init[e.id][d.getDate()] = (init[e.id][d.getDate()] || 0) + o.orders;
        }
      });
    });
    return init;
  });

  const days = getDaysInMonth(year, month);
  const dayArr = Array.from({ length: days }, (_, i) => i + 1);
  const orderDrivers = employees.filter(e => e.salaryType === 'orders' && e.status !== 'terminated' && e.name.includes(search));

  const getValue = (empId: string, day: number) => data[empId]?.[day] || 0;
  const monthTotal = (empId: string) => dayArr.reduce((s, d) => s + getValue(empId, d), 0);

  const handleDblClick = (empId: string, day: number) => {
    setEditing({ empId, day });
    setEditVal(String(getValue(empId, day) || ''));
  };

  const commitEdit = useCallback(() => {
    if (!editing) return;
    const val = parseInt(editVal) || 0;
    setData(prev => ({
      ...prev,
      [editing.empId]: { ...(prev[editing.empId] || {}), [editing.day]: val },
    }));
    setEditing(null);
  }, [editing, editVal]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setEditing(null); }
  };

  const handleSave = () => {
    toast({ title: '✅ تم الحفظ', description: `تم حفظ بيانات شهر ${month}/${year}` });
  };

  const exportExcel = () => {
    const rows = orderDrivers.map(e => {
      const row: Record<string, any> = { 'الاسم': e.name, 'السكيمة': e.schemeName || '—' };
      dayArr.forEach(d => { row[`${d}`] = getValue(e.id, d) || ''; });
      row['المجموع'] = monthTotal(e.id);
      row['الراتب المحتسب'] = calcSalary(monthTotal(e.id), e.schemeName);
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الطلبات');
    XLSX.writeFile(wb, `طلبات_${month}_${year}.xlsx`);
    toast({ title: 'تم التصدير' });
  };

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}
            className="p-1.5 rounded hover:bg-background transition-colors"><ChevronRight size={16} /></button>
          <span className="px-3 text-sm font-medium min-w-28 text-center">{monthLabel}</span>
          <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}
            className="p-1.5 rounded hover:bg-background transition-colors"><ChevronLeft size={16} /></button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['الكل', ...appsList].map(app => (
            <button key={app} onClick={() => setSelectedApp(app)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedApp === app ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {app}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." className="pr-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="mr-auto flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportExcel}><Download size={14} /> Excel</Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave}><Save size={14} /> حفظ</Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">💡 انقر مرتين على أي خلية لتعديلها — Enter للحفظ، Esc للإلغاء</p>

      {/* Grid */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <table className="w-full border-collapse text-xs" style={{ minWidth: `${200 + days * 44}px` }}>
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted/60 border-b border-border">
              <th className="sticky right-0 z-30 bg-muted/80 backdrop-blur text-right px-3 py-2.5 font-semibold text-foreground min-w-[180px] border-l border-border">المندوب</th>
              <th className="sticky bg-muted/80 backdrop-blur text-center px-2 py-2.5 font-semibold text-muted-foreground min-w-[90px] border-l border-border" style={{ right: '180px', zIndex: 29 }}>السكيمة</th>
              {dayArr.map(d => {
                const dow = new Date(year, month - 1, d).getDay();
                const isWeekend = dow === 5 || dow === 6;
                return (
                  <th key={d} className={`text-center px-1 py-2.5 font-medium min-w-[40px] border-l border-border/30 ${isWeekend ? 'text-destructive bg-destructive/5' : 'text-muted-foreground'}`}>{d}</th>
                );
              })}
              <th className="text-center px-2 py-2.5 font-semibold text-primary min-w-[70px] border-l border-border bg-primary/5">المجموع</th>
              <th className="text-center px-2 py-2.5 font-semibold text-success min-w-[90px] bg-success/5">الراتب</th>
            </tr>
          </thead>
          <tbody>
            {orderDrivers.map((emp, idx) => {
              const total = monthTotal(emp.id);
              const salary = calcSalary(total, emp.schemeName);
              return (
                <tr key={emp.id} className={`border-b border-border/30 hover:bg-muted/20 ${idx % 2 === 0 ? '' : 'bg-muted/5'}`}>
                  <td className="sticky right-0 z-10 bg-card px-3 py-2 border-l border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0">{emp.name.charAt(0)}</div>
                      <span className="font-medium text-foreground truncate max-w-[130px]">{emp.name}</span>
                    </div>
                  </td>
                  <td className="sticky bg-card text-center px-2 py-2 text-muted-foreground border-l border-border truncate max-w-[80px]" style={{ right: '180px', zIndex: 9 }}>
                    {emp.schemeName ? <span className="badge-info text-xs">{emp.schemeName.split(' ')[1] || emp.schemeName}</span> : '—'}
                  </td>
                  {dayArr.map(d => {
                    const val = getValue(emp.id, d);
                    const isEditing = editing?.empId === emp.id && editing?.day === d;
                    const dow = new Date(year, month - 1, d).getDay();
                    const isWeekend = dow === 5 || dow === 6;
                    return (
                      <td key={d} className={`text-center p-0 border-l border-border/30 ${isWeekend ? 'bg-destructive/5' : ''}`}
                        onDoubleClick={() => handleDblClick(emp.id, d)}>
                        {isEditing ? (
                          <input type="number" min={0} value={editVal} onChange={e => setEditVal(e.target.value)}
                            onBlur={commitEdit} onKeyDown={handleKeyDown} autoFocus
                            className="w-full h-9 text-center bg-primary/10 border-2 border-primary outline-none text-sm font-medium" />
                        ) : (
                          <div className={`h-9 flex items-center justify-center cursor-pointer hover:bg-muted/40 font-medium ${val > 0 ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                            {val > 0 ? val : '·'}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center px-2 py-2 font-bold text-primary bg-primary/5 border-l border-border">{total}</td>
                  <td className="text-center px-2 py-2 font-bold text-success bg-success/5">{salary.toLocaleString()}</td>
                </tr>
              );
            })}
            {/* Footer totals */}
            <tr className="border-t-2 border-border bg-muted/30 font-semibold sticky bottom-0">
              <td className="sticky right-0 z-10 bg-muted/50 px-3 py-2 text-sm border-l border-border">الإجمالي</td>
              <td className="sticky bg-muted/50 border-l border-border" style={{ right: '180px', zIndex: 9 }}></td>
              {dayArr.map(d => {
                const dayTotal = orderDrivers.reduce((s, e) => s + getValue(e.id, d), 0);
                return (
                  <td key={d} className="text-center px-1 py-2 text-xs text-muted-foreground border-l border-border/30">
                    {dayTotal > 0 ? dayTotal : ''}
                  </td>
                );
              })}
              <td className="text-center px-2 py-2 text-primary bg-primary/5 border-l border-border">
                {orderDrivers.reduce((s, e) => s + monthTotal(e.id), 0)}
              </td>
              <td className="text-center px-2 py-2 text-success bg-success/5">
                {orderDrivers.reduce((s, e) => s + calcSalary(monthTotal(e.id), e.schemeName), 0).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Month Summary ─────────────────────────────────────────────────
const MonthSummary = () => {
  const orderDrivers = employees.filter(e => e.salaryType === 'orders' && e.status !== 'terminated');
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">المندوب</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">السكيمة</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">إجمالي الطلبات</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">الراتب المحتسب</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">متوسط يومي</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">Target</th>
              </tr>
            </thead>
            <tbody>
              {orderDrivers.map(emp => {
                const monthOrders = dailyOrders.filter(o => o.employeeId === emp.id && o.date.startsWith('2025-02')).reduce((s, o) => s + o.orders, 0);
                const salary = calcSalary(monthOrders, emp.schemeName);
                const scheme = salarySchemes.find(s => s.name === emp.schemeName);
                const reachedTarget = scheme?.targetBonus && monthOrders >= scheme.targetBonus.target;
                const avgDaily = Math.round(monthOrders / 25);
                return (
                  <tr key={emp.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="p-4 text-sm font-medium text-foreground">{emp.name}</td>
                    <td className="p-4 text-sm text-muted-foreground">{emp.schemeName || '—'}</td>
                    <td className="p-4 text-center font-semibold text-foreground">{monthOrders}</td>
                    <td className="p-4 text-center font-bold text-primary">{salary.toLocaleString()} ر.س</td>
                    <td className="p-4 text-center text-muted-foreground">{avgDaily}</td>
                    <td className="p-4 text-center">
                      {scheme?.targetBonus ? (
                        <span className={reachedTarget ? 'badge-success' : 'badge-warning'}>
                          {reachedTarget ? `✅ وصل (+${scheme.targetBonus.bonus})` : `${monthOrders}/${scheme.targetBonus.target}`}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Orders = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <Package size={24} /> الطلبات اليومية
      </h1>
      <p className="text-sm text-muted-foreground mt-1">إدخال ومتابعة طلبات المناديب — Grid الشهري</p>
    </div>
    <Tabs defaultValue="grid" dir="rtl">
      <TabsList>
        <TabsTrigger value="grid">📊 Grid الشهري</TabsTrigger>
        <TabsTrigger value="summary">ملخص الشهر</TabsTrigger>
      </TabsList>
      <TabsContent value="grid" className="mt-4"><SpreadsheetGrid /></TabsContent>
      <TabsContent value="summary" className="mt-4"><MonthSummary /></TabsContent>
    </Tabs>
  </div>
);

export default Orders;
