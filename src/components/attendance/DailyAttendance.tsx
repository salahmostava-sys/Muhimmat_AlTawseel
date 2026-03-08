import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  CalendarIcon, CheckCircle2, XCircle, Clock,
  Palmtree, Stethoscope, UserCheck, Save, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type AttendanceStatus = 'present' | 'absent' | 'leave' | 'sick' | 'late' | 'unpaid_leave';

interface AttendanceRecord {
  employeeId: string;
  status: AttendanceStatus | null;
  checkIn: string;
  checkOut: string;
  note: string;
  customStatus: string;
  showCustomInput: boolean;
}

type Employee = { id: string; name: string; salary_type: string; job_title?: string | null };

const statusConfig: Record<AttendanceStatus, { label: string; icon: typeof CheckCircle2; activeClass: string; hoverClass: string }> = {
  present:      { label: 'حاضر',             icon: CheckCircle2, activeClass: 'bg-green-100 text-green-700 border-green-400 dark:bg-green-900/30 dark:text-green-400',   hoverClass: 'hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:hover:bg-green-900/20' },
  absent:       { label: 'غائب',             icon: XCircle,      activeClass: 'bg-red-100 text-red-700 border-red-400 dark:bg-red-900/30 dark:text-red-400',             hoverClass: 'hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:hover:bg-red-900/20' },
  leave:        { label: 'إجازة',            icon: Palmtree,     activeClass: 'bg-yellow-100 text-yellow-700 border-yellow-400 dark:bg-yellow-900/30 dark:text-yellow-400', hoverClass: 'hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-300' },
  sick:         { label: 'مريض',             icon: Stethoscope,  activeClass: 'bg-purple-100 text-purple-700 border-purple-400 dark:bg-purple-900/30 dark:text-purple-400', hoverClass: 'hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300' },
  late:         { label: 'متأخر',            icon: Clock,        activeClass: 'bg-orange-100 text-orange-700 border-orange-400 dark:bg-orange-900/30 dark:text-orange-400', hoverClass: 'hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300' },
  unpaid_leave: { label: 'إجازة بدون راتب',  icon: Palmtree,     activeClass: 'bg-muted text-muted-foreground border-border',                                              hoverClass: 'hover:bg-muted/70 hover:text-foreground' },
};

const STATUS_KEYS = Object.keys(statusConfig) as AttendanceStatus[];

interface Props {
  selectedMonth: number;
  selectedYear: number;
}

const DailyAttendance = ({ selectedMonth, selectedYear }: Props) => {
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setMonth(selectedMonth);
    d.setFullYear(selectedYear);
    // clamp to valid day
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    if (d.getDate() > lastDay) d.setDate(lastDay);
    return d;
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Update date when month/year changes
  useEffect(() => {
    setDate(prev => {
      const d = new Date(prev);
      d.setFullYear(selectedYear);
      d.setMonth(selectedMonth);
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      if (d.getDate() > lastDay) d.setDate(lastDay);
      return d;
    });
  }, [selectedMonth, selectedYear]);

  // Fetch employees once
  useEffect(() => {
    supabase.from('employees').select('id, name, salary_type, job_title')
      .eq('status', 'active').order('name')
      .then(({ data }) => {
        if (data) setEmployees(data as Employee[]);
        setLoading(false);
      });
  }, []);

  // Fetch existing records when date changes
  useEffect(() => {
    if (employees.length === 0) return;
    const dateStr = format(date, 'yyyy-MM-dd');

    supabase.from('attendance').select('*').eq('date', dateStr)
      .then(({ data }) => {
        const initial: Record<string, AttendanceRecord> = {};
        employees.forEach(emp => {
          const existing = data?.find(r => r.employee_id === emp.id);
          initial[emp.id] = {
            employeeId: emp.id,
            status: (existing?.status as AttendanceStatus) ?? null,
            checkIn: existing?.check_in ?? '',
            checkOut: existing?.check_out ?? '',
            note: existing?.note ?? '',
            customStatus: '',
            showCustomInput: false,
          };
        });
        setRecords(initial);
      });
  }, [date, employees]);

  const updateRecord = (empId: string, field: keyof AttendanceRecord, value: string | boolean | null) => {
    setRecords(prev => ({ ...prev, [empId]: { ...prev[empId], [field]: value } }));
  };

  const markAllPresent = () => {
    setRecords(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(id => { updated[id] = { ...updated[id], status: 'present' }; });
      return updated;
    });
    toast({ title: 'تم تسجيل الكل حاضرين ✅' });
  };

  const handleSave = async () => {
    setSaving(true);
    const dateStr = format(date, 'yyyy-MM-dd');
    const toSave = Object.values(records).filter(r => r.status !== null);
    let saved = 0;

    // Map 'unpaid_leave' → 'leave' for DB compatibility (note saved alongside)
    const dbStatusMap: Record<AttendanceStatus, 'present' | 'absent' | 'leave' | 'sick' | 'late'> = {
      present: 'present', absent: 'absent', leave: 'leave',
      sick: 'sick', late: 'late', unpaid_leave: 'leave',
    };
    for (const r of toSave) {
      const noteText = [
        r.note,
        r.status === 'unpaid_leave' ? 'إجازة بدون راتب' : '',
        r.customStatus,
      ].filter(Boolean).join(' | ') || null;
      const payload = {
        employee_id: r.employeeId,
        date: dateStr,
        status: dbStatusMap[r.status!],
        check_in: r.checkIn || null,
        check_out: r.checkOut || null,
        note: noteText,
      };
      const { error } = await supabase.from('attendance').upsert([payload], {
        onConflict: 'employee_id,date',
      });
      if (!error) saved++;
    }

    setSaving(false);
    toast({ title: `تم حفظ حضور ${saved} مندوب بنجاح ✅`, description: `يوم ${format(date, 'dd MMMM yyyy', { locale: ar })}` });
  };

  const summary = Object.values(records).reduce((acc, r) => {
    if (r.status) acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const savedCount = Object.values(records).filter(r => r.status !== null).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-[210px] justify-start gap-2 font-normal')}>
                <CalendarIcon size={16} />
                {format(date, 'dd MMMM yyyy', { locale: ar })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={d => d && setDate(d)}
                initialFocus
                className="p-3 pointer-events-auto"
                fromDate={new Date(selectedYear, selectedMonth, 1)}
                toDate={new Date(selectedYear, selectedMonth + 1, 0)}
              />
            </PopoverContent>
          </Popover>
          <span className="text-sm text-muted-foreground">{employees.length} مندوب نشط</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAllPresent} className="gap-2">
            <UserCheck size={16} /> تسجيل الكل حاضرين
          </Button>
          <Button onClick={handleSave} disabled={saving || savedCount === 0} className="gap-2">
            <Save size={16} /> {saving ? 'جاري الحفظ...' : `حفظ الحضور (${savedCount})`}
          </Button>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_KEYS.map(key => (summary[key] ?? 0) > 0 ? (
          <span key={key} className={`px-3 py-1 rounded-full text-xs font-medium border ${statusConfig[key].activeClass}`}>
            {statusConfig[key].label}: {summary[key]}
          </span>
        ) : null)}
        {savedCount === 0 && <span className="text-xs text-muted-foreground">لم يُحدَّد أي حضور بعد</span>}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground sticky right-0 bg-muted/30 min-w-[160px]">المندوب</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground min-w-[420px]">الحالة</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">وقت الحضور</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">وقت الانصراف</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground min-w-[180px]">ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="p-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : employees.map(emp => {
                const record = records[emp.id] ?? { status: null, checkIn: '', checkOut: '', note: '', customStatus: '', showCustomInput: false, employeeId: emp.id };
                return (
                  <tr key={emp.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    {/* Name */}
                    <td className="p-4 sticky right-0 bg-card">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground whitespace-nowrap">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{emp.job_title || (emp.salary_type === 'orders' ? 'طلبات' : 'دوام')}</p>
                        </div>
                      </div>
                    </td>

                    {/* Status buttons */}
                    <td className="p-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-1.5 flex-wrap">
                          {STATUS_KEYS.map(key => {
                            const cfg = statusConfig[key];
                            const Icon = cfg.icon;
                            const isActive = record.status === key;
                            return (
                              <button
                                key={key}
                                onClick={() => updateRecord(emp.id, 'status', isActive ? null : key)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
                                  isActive ? cfg.activeClass : `border-border/50 text-muted-foreground ${cfg.hoverClass}`
                                }`}
                              >
                                <Icon size={12} />
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom status */}
                        {record.showCustomInput ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={record.customStatus}
                              onChange={e => updateRecord(emp.id, 'customStatus', e.target.value)}
                              placeholder="حالة مخصصة..."
                              className="text-xs h-7 max-w-[200px]"
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => updateRecord(emp.id, 'showCustomInput', true)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors w-fit"
                          >
                            <Plus size={11} /> إضافة حالة مخصصة
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Check in */}
                    <td className="p-3">
                      <Input
                        type="time"
                        value={record.checkIn}
                        onChange={e => updateRecord(emp.id, 'checkIn', e.target.value)}
                        className="w-28 text-sm"
                        dir="ltr"
                      />
                    </td>

                    {/* Check out */}
                    <td className="p-3">
                      <Input
                        type="time"
                        value={record.checkOut}
                        onChange={e => updateRecord(emp.id, 'checkOut', e.target.value)}
                        className="w-28 text-sm"
                        dir="ltr"
                      />
                    </td>

                    {/* Note */}
                    <td className="p-3">
                      <Input
                        placeholder="ملاحظة اختيارية..."
                        value={record.note}
                        onChange={e => updateRecord(emp.id, 'note', e.target.value)}
                        className="text-sm min-w-[160px]"
                      />
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

export default DailyAttendance;
