import { useState, useEffect } from 'react';
import { FileText, Download, Users, Clock, DollarSign, TrendingUp, Calendar, Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { format, subMonths } from 'date-fns';
import * as XLSX from '@e965/xlsx';

type ReportType = 'employees' | 'attendance' | 'financial';

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
});

const Reports = () => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();

  const [reportType, setReportType] = useState<ReportType>('employees');
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0].value);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewCols, setPreviewCols] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reportTypes = [
    { key: 'employees' as ReportType, label: isRTL ? 'تقرير الموظفين' : 'Employee Report', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', desc: isRTL ? 'قائمة شاملة بكافة بيانات الموظفين' : 'Full employee data list' },
    { key: 'attendance' as ReportType, label: isRTL ? 'تقرير الحضور' : 'Attendance Report', icon: Clock, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10', desc: isRTL ? 'سجل حضور وغياب الموظفين للشهر' : 'Monthly attendance records' },
    { key: 'financial' as ReportType, label: isRTL ? 'التقرير المالي' : 'Financial Report', icon: DollarSign, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10', desc: isRTL ? 'ملخص الرواتب والسلف للشهر' : 'Salary & advances summary' },
  ];

  const loadReport = async () => {
    setLoading(true);
    setLoaded(false);

    if (reportType === 'employees') {
      const { data } = await supabase
        .from('employees')
        .select('employee_code, name, name_en, job_title, phone, email, national_id, city, join_date, status, salary_type, base_salary, nationality')
        .order('name');
      const cols = ['الكود', 'الاسم', 'الاسم الإنجليزي', 'المسمى الوظيفي', 'الجوال', 'الإيميل', 'رقم الهوية', 'المدينة', 'تاريخ الالتحاق', 'الحالة', 'نوع الراتب', 'الراتب', 'الجنسية'];
      setPreviewCols(cols);
      setPreviewData((data || []).map(e => ({
        'الكود': e.employee_code || '—',
        'الاسم': e.name,
        'الاسم الإنجليزي': e.name_en || '—',
        'المسمى الوظيفي': e.job_title || '—',
        'الجوال': e.phone || '—',
        'الإيميل': e.email || '—',
        'رقم الهوية': e.national_id || '—',
        'المدينة': e.city === 'makkah' ? 'مكة' : e.city === 'jeddah' ? 'جدة' : '—',
        'تاريخ الالتحاق': e.join_date || '—',
        'الحالة': e.status === 'active' ? 'نشط' : e.status === 'inactive' ? 'موقوف' : 'منتهي',
        'نوع الراتب': e.salary_type === 'orders' ? 'طلبات' : 'شيفت',
        'الراتب': e.base_salary,
        'الجنسية': e.nationality || '—',
      })));
    } else if (reportType === 'attendance') {
      const start = `${selectedMonth}-01`;
      const end = `${selectedMonth}-31`;
      const { data: attData } = await supabase
        .from('attendance')
        .select('date, status, note, employees(name)')
        .gte('date', start).lte('date', end)
        .order('date');
      const cols = ['الموظف', 'التاريخ', 'الحالة', 'ملاحظات'];
      setPreviewCols(cols);
      setPreviewData((attData || []).map(a => ({
        'الموظف': (a.employees as any)?.name || '—',
        'التاريخ': a.date,
        'الحالة': a.status === 'present' ? 'حاضر' : a.status === 'absent' ? 'غائب' : a.status === 'leave' ? 'إجازة' : a.status === 'sick' ? 'مريض' : 'متأخر',
        'ملاحظات': a.note || '—',
      })));
    } else {
      const { data: salaries } = await supabase
        .from('salary_records')
        .select('employee_id, base_salary, allowances, attendance_deduction, advance_deduction, external_deduction, manual_deduction, net_salary, payment_method, is_approved, employees(name)')
        .eq('month_year', selectedMonth);
      const { data: advances } = await supabase
        .from('advances')
        .select('employee_id, amount, monthly_amount, status, employees(name)')
        .eq('status', 'active');
      const cols = ['الموظف', 'الراتب الأساسي', 'البدلات', 'خصم الغياب', 'خصم السلفة', 'خصومات أخرى', 'صافي الراتب', 'طريقة الدفع', 'معتمد'];
      setPreviewCols(cols);
      setPreviewData((salaries || []).map(s => ({
        'الموظف': (s.employees as any)?.name || '—',
        'الراتب الأساسي': s.base_salary,
        'البدلات': s.allowances,
        'خصم الغياب': s.attendance_deduction,
        'خصم السلفة': s.advance_deduction,
        'خصومات أخرى': (Number(s.external_deduction) + Number(s.manual_deduction)),
        'صافي الراتب': s.net_salary,
        'طريقة الدفع': s.payment_method === 'bank' ? 'بنك' : 'ماش',
        'معتمد': s.is_approved ? 'نعم' : 'لا',
      })));
    }

    setLoaded(true);
    setLoading(false);
  };

  const exportExcel = () => {
    if (!previewData.length) return;
    const ws = XLSX.utils.json_to_sheet(previewData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    const label = reportTypes.find(r => r.key === reportType)?.label || 'report';
    XLSX.writeFile(wb, `${label}-${selectedMonth}.xlsx`);
    toast({ title: isRTL ? 'تم تصدير التقرير' : 'Report exported' });
  };

  const needsMonth = reportType !== 'employees';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <nav className="page-breadcrumb">
          <span>{isRTL ? 'الرئيسية' : 'Home'}</span>
          <span className="page-breadcrumb-sep">/</span>
          <span className="text-foreground font-medium">{isRTL ? 'التقارير' : 'Reports'}</span>
        </nav>
        <h1 className="page-title">{isRTL ? 'مركز التقارير' : 'Reports Center'}</h1>
      </div>

      {/* Report type cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {reportTypes.map(r => (
          <button
            key={r.key}
            onClick={() => { setReportType(r.key); setLoaded(false); setPreviewData([]); }}
            className={`text-start p-4 rounded-xl border transition-all duration-150 ${reportType === r.key ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-card hover:border-primary/30 hover:bg-muted/30'}`}
          >
            <div className={`icon-box-sm ${r.bg} mb-3`}>
              <r.icon size={16} className={r.color} />
            </div>
            <p className="font-semibold text-sm text-foreground">{r.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-card border border-border/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {needsMonth && (
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-muted-foreground flex-shrink-0" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-9 w-44 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button onClick={loadReport} disabled={loading} className="gap-2">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
          {isRTL ? 'تحميل التقرير' : 'Load Report'}
        </Button>
        {loaded && previewData.length > 0 && (
          <Button variant="outline" onClick={exportExcel} className="gap-2">
            <Download size={14} />
            {isRTL ? 'تصدير Excel' : 'Export Excel'}
          </Button>
        )}
        {loaded && (
          <span className="text-xs text-muted-foreground ltr:ml-auto rtl:mr-auto">
            {previewData.length} {isRTL ? 'سجل' : 'records'}
          </span>
        )}
      </div>

      {/* Preview table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : loaded && previewData.length > 0 ? (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>{previewCols.map(c => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {previewData.slice(0, 50).map((row, i) => (
                <tr key={i}>
                  {previewCols.map(c => (
                    <td key={c} className="text-xs whitespace-nowrap">
                      {typeof row[c] === 'number' ? row[c].toLocaleString() : row[c]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {previewData.length > 50 && (
            <p className="text-xs text-muted-foreground text-center py-3 border-t border-border">
              {isRTL ? `يعرض 50 من ${previewData.length} سجل — صدّر Excel لرؤية الكل` : `Showing 50 of ${previewData.length} — export Excel to see all`}
            </p>
          )}
        </div>
      ) : loaded && previewData.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm text-muted-foreground">{isRTL ? 'لا توجد بيانات لهذه الفترة' : 'No data for this period'}</p>
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
          <TrendingUp size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm text-muted-foreground">{isRTL ? 'اختر نوع التقرير واضغط "تحميل التقرير"' : 'Select a report type and click "Load Report"'}</p>
        </div>
      )}
    </div>
  );
};

export default Reports;
