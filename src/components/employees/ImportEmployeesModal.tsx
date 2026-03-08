import { useState, useRef, useCallback } from 'react';
import { X, Upload, CheckCircle, AlertTriangle, XCircle, Info, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from '@e965/xlsx';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ParsedEmployee {
  employee_code?: string;
  national_id?: string;
  base_salary?: number | null;
  city?: 'makkah' | 'jeddah' | null;
  job_title?: string;
  sponsorship_status?: 'sponsored' | 'not_sponsored' | 'absconded' | 'terminated';
  name: string;
  platform?: string | null;
  status: 'active' | 'inactive';
  phone?: string;
  nationality?: string;
  birth_date?: string | null;
  email?: string;
  salary_type: 'orders' | 'shift';
  rowCategory: 'active_delivery' | 'accident' | 'absconded' | 'supervisor';
  _rowIndex: number;
  _error?: string;
}

interface ImportSummary {
  active_delivery: number;
  accident: number;
  absconded: number;
  supervisor: number;
  errors: number;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const parseCity = (val: string | undefined): 'makkah' | 'jeddah' | null => {
  if (!val) return null;
  const v = val.trim();
  if (['جدة', 'جده', 'جدّة'].includes(v)) return 'jeddah';
  if (['مكة', 'مكه', 'مكّة', 'مكه المكرمة', 'مكة المكرمة'].includes(v)) return 'makkah';
  return null;
};

const parseSponsorFromCol7 = (val: string | undefined): 'sponsored' | 'not_sponsored' | null => {
  if (!val) return null;
  const v = val.trim();
  if (v.includes('على الكفال')) return 'sponsored';
  if (v.includes('مش على') || v.includes('ليس على')) return 'not_sponsored';
  return null;
};

const PLATFORM_MAP: Record<string, string> = {
  'هنجر': 'هنقرستيشن',
  'هنقرستيشن': 'هنقرستيشن',
  'جاهز': 'جاهز',
  'كيتا': 'كيتا',
  'تويو': 'توبو',
  'توبو': 'توبو',
  'نينجا': 'نينجا',
};

const SUPERVISOR_KEYWORDS = ['ميكانيكى', 'ميكانيكي', 'مشرف', 'مشرف تشغيل', 'مشرف ميداني', 'غرفه عمليات', 'غرفة عمليات'];

const parseDate = (val: any): string | null => {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const d = new Date(date.y, date.m - 1, date.d);
      return d.toISOString().split('T')[0];
    }
    return null;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return null;
    // Try common Arabic/English formats
    const formats = [
      // dd/mm/yyyy or d/m/yyyy
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // yyyy-mm-dd
      /^(\d{4})-(\d{2})-(\d{2})$/,
    ];
    const match1 = s.match(formats[0]);
    if (match1) {
      const d = new Date(`${match1[3]}-${match1[2].padStart(2,'0')}-${match1[1].padStart(2,'0')}`);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    const match2 = s.match(formats[1]);
    if (match2) return s;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return null;
};

const parseRow = (row: any[], rowIndex: number): ParsedEmployee | null => {
  // Columns are 1-indexed in spec, 0-indexed in array
  // Row might have headers or start from row 2; we handle raw row array
  const col = (i: number) => {
    const v = row[i - 1];
    return v !== undefined && v !== null ? String(v).trim() : undefined;
  };
  const colRaw = (i: number) => row[i - 1];

  const name = col(8);
  if (!name) return null;

  const employee_code = col(2) || undefined;
  const national_id = col(3) || undefined;
  const salaryRaw = colRaw(4);
  const base_salary = salaryRaw !== undefined && salaryRaw !== '' && salaryRaw !== null
    ? parseFloat(String(salaryRaw)) || null
    : null;

  const cityCol5 = parseCity(col(5));
  const cityCol10 = parseCity(col(10));
  const city = cityCol5 || cityCol10;

  const job_title = col(6) || undefined;
  const sponsorCol7 = parseSponsorFromCol7(col(7));

  const platformRaw = col(9) || '';
  const phone = col(11) ? col(11)!.replace(/\s/g, '') : undefined;
  const nationality = col(12) || undefined;
  const birth_date = parseDate(colRaw(13));
  const email = col(14) || undefined;

  // salary_type
  const salary_type: 'orders' | 'shift' = job_title?.includes('مندوب') ? 'orders' : 'shift';

  // Platform / status logic from col 9
  let platform: string | null = null;
  let status: 'active' | 'inactive' = 'active';
  let sponsorship_status: 'sponsored' | 'not_sponsored' | 'absconded' | 'terminated' = sponsorCol7 || 'not_sponsored';
  let rowCategory: ParsedEmployee['rowCategory'] = 'active_delivery';

  if (PLATFORM_MAP[platformRaw]) {
    platform = PLATFORM_MAP[platformRaw];
    status = 'active';
    rowCategory = 'active_delivery';
  } else if (platformRaw === 'حادث') {
    status = 'inactive';
    platform = null;
    rowCategory = 'accident';
  } else if (platformRaw === 'هروب') {
    status = 'inactive';
    sponsorship_status = 'absconded';
    platform = null;
    rowCategory = 'absconded';
  } else if (SUPERVISOR_KEYWORDS.some(k => platformRaw.includes(k))) {
    status = 'active';
    platform = null;
    rowCategory = 'supervisor';
  } else if (platformRaw === '') {
    // No platform info
    rowCategory = 'supervisor';
  }

  return {
    employee_code,
    national_id,
    base_salary,
    city,
    job_title,
    sponsorship_status,
    name,
    platform,
    status,
    phone,
    nationality,
    birth_date,
    email,
    salary_type,
    rowCategory,
    _rowIndex: rowIndex,
  };
};

// ─── Component ────────────────────────────────────────────────────────────────
const ImportEmployeesModal = ({ onClose, onSuccess }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedEmployee[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [errors, setErrors] = useState<{ name: string; error: string }[]>([]);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Find first row with actual name data (skip headers)
        let startRow = 1;
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const nameCell = rows[i][7]; // col 8 = index 7
          if (nameCell && typeof nameCell === 'string' && nameCell.trim().length > 1 && !/اسم|name/i.test(nameCell)) {
            startRow = i;
            break;
          }
        }

        const employees: ParsedEmployee[] = [];
        for (let i = startRow; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((c: any) => !c)) continue;
          const emp = parseRow(row, i + 1);
          if (emp) employees.push(emp);
        }

        const sum: ImportSummary = {
          active_delivery: employees.filter(e => e.rowCategory === 'active_delivery').length,
          accident: employees.filter(e => e.rowCategory === 'accident').length,
          absconded: employees.filter(e => e.rowCategory === 'absconded').length,
          supervisor: employees.filter(e => e.rowCategory === 'supervisor').length,
          errors: employees.filter(e => e._error).length,
        };

        setParsed(employees);
        setSummary(sum);
        setStep(2);
      } catch (err: any) {
        toast({ title: 'خطأ في قراءة الملف', description: err.message, variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  }, [toast]);

  const handleConfirm = async () => {
    setImporting(true);
    setStep(3);
    setProgress(0);
    const importErrors: { name: string; error: string }[] = [];
    const total = parsed.length;
    const BATCH = 20;

    // Fetch apps for platform linking
    const { data: appsData } = await supabase.from('apps').select('id, name').eq('is_active', true);
    const appsMap: Record<string, string> = {};
    (appsData || []).forEach(a => { appsMap[a.name] = a.id; });

    let done = 0;

    for (let i = 0; i < parsed.length; i += BATCH) {
      const batch = parsed.slice(i, i + BATCH);

      for (const emp of batch) {
        try {
          const payload: Record<string, any> = {
            name: emp.name,
            status: emp.status,
            salary_type: emp.salary_type,
            base_salary: emp.base_salary ?? 0,
            sponsorship_status: emp.sponsorship_status,
          };
          if (emp.employee_code) payload.employee_code = emp.employee_code;
          if (emp.national_id) payload.national_id = emp.national_id;
          if (emp.city) payload.city = emp.city;
          if (emp.job_title) payload.job_title = emp.job_title;
          if (emp.phone) payload.phone = emp.phone;
          if (emp.nationality) payload.nationality = emp.nationality;
          if (emp.birth_date) payload.birth_date = emp.birth_date;
          if (emp.email) payload.email = emp.email;

          let empId: string | null = null;

          // Check by employee_code first
          if (emp.employee_code) {
            const { data: existing } = await supabase
              .from('employees')
              .select('id')
              .eq('employee_code', emp.employee_code)
              .maybeSingle();
            if (existing) {
              await supabase.from('employees').update(payload).eq('id', existing.id);
              empId = existing.id;
            }
          }

          // Check by national_id
          if (!empId && emp.national_id) {
            const { data: existing } = await supabase
              .from('employees')
              .select('id')
              .eq('national_id', emp.national_id)
              .maybeSingle();
            if (existing) {
              await supabase.from('employees').update(payload).eq('id', existing.id);
              empId = existing.id;
            }
          }

          // Insert new
          if (!empId) {
            payload.status = payload.status || 'active';
            const { data: newEmp, error: insErr } = await supabase
              .from('employees')
              .insert([payload] as any)
              .select('id')
              .single();
            if (insErr) throw insErr;
            empId = (newEmp as any).id;
          }

          // Link platform → employee_apps
          if (empId && emp.platform && appsMap[emp.platform]) {
            const appId = appsMap[emp.platform];
            await supabase
              .from('employee_apps')
              .upsert({ employee_id: empId, app_id: appId, status: 'active' }, { onConflict: 'employee_id,app_id' });
          }
        } catch (err: any) {
          importErrors.push({ name: emp.name, error: err.message });
        }

        done++;
        const pct = Math.round((done / total) * 100);
        setProgress(pct);
        setProgressLabel(`جاري الاستيراد... ${done}/${total}`);
      }
    }

    setErrors(importErrors);
    setImporting(false);

    if (importErrors.length === 0) {
      toast({ title: `✅ تم استيراد ${total} موظف بنجاح` });
      onSuccess();
    } else {
      toast({
        title: `⚠️ فشل ${importErrors.length} موظف`,
        description: 'يمكنك تحميل تقرير الأخطاء',
        variant: 'destructive',
      });
    }
  };

  const downloadErrorReport = () => {
    const ws = XLSX.utils.json_to_sheet(errors);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'أخطاء');
    XLSX.writeFile(wb, 'import_errors.xlsx');
  };

  const previewRows = parsed.slice(0, 10);

  const statusLabel = (emp: ParsedEmployee) => {
    if (emp.rowCategory === 'active_delivery') return { text: 'نشط — مندوب', cls: 'badge-success' };
    if (emp.rowCategory === 'accident') return { text: 'موقوف — حادث', cls: 'badge-warning' };
    if (emp.rowCategory === 'absconded') return { text: 'هروب', cls: 'badge-urgent' };
    return { text: 'مشرف/ميكانيكي', cls: 'bg-muted text-muted-foreground text-xs font-medium px-2 py-0.5 rounded-full' };
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-border/50">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-foreground">استيراد بيانات الموظفين</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-2 shrink-0">
          {['رفع الملف', 'معاينة', 'استيراد'].map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i + 1 < step ? 'bg-success text-success-foreground' : i + 1 === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {i + 1 < step ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i + 1 === step ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>{s}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-px mx-2 ${i + 1 < step ? 'bg-success' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── Step 1: Upload ── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                يدعم الملف بصيغة بيانات الموظفين الحالية (78 موظف أو أكثر)
              </p>
              <div
                className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-10 text-center cursor-pointer transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">اضغط لاختيار ملف أو اسحبه هنا</p>
                <p className="text-xs text-muted-foreground mt-1">xlsx أو xls فقط</p>
                {fileName && <p className="mt-2 text-sm text-primary font-medium">📄 {fileName}</p>}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 2 && summary && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-success/10 rounded-xl p-3 text-center">
                  <CheckCircle size={18} className="text-success mx-auto mb-1" />
                  <p className="text-xl font-bold text-success">{summary.active_delivery}</p>
                  <p className="text-xs text-muted-foreground">مندوب توصيل نشط</p>
                </div>
                <div className="bg-warning/10 rounded-xl p-3 text-center">
                  <AlertTriangle size={18} className="text-warning mx-auto mb-1" />
                  <p className="text-xl font-bold text-warning">{summary.accident}</p>
                  <p className="text-xs text-muted-foreground">حادث (موقوف)</p>
                </div>
                <div className="bg-destructive/10 rounded-xl p-3 text-center">
                  <XCircle size={18} className="text-destructive mx-auto mb-1" />
                  <p className="text-xl font-bold text-destructive">{summary.absconded}</p>
                  <p className="text-xs text-muted-foreground">هروب (غير نشط)</p>
                </div>
                <div className="bg-muted rounded-xl p-3 text-center">
                  <Info size={18} className="text-muted-foreground mx-auto mb-1" />
                  <p className="text-xl font-bold text-foreground">{summary.supervisor}</p>
                  <p className="text-xs text-muted-foreground">مشرف/ميكانيكي</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">معاينة أول 10 صفوف:</p>

              {/* Preview table */}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium">الاسم</th>
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium">الكود</th>
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium">المنصة</th>
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium">المدينة</th>
                      <th className="px-3 py-2 text-start text-muted-foreground font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((emp, i) => {
                      const st = statusLabel(emp);
                      return (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium text-foreground">{emp.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{emp.employee_code || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{emp.platform || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {emp.city === 'makkah' ? 'مكة' : emp.city === 'jeddah' ? 'جدة' : '—'}
                          </td>
                          <td className="px-3 py-2"><span className={st.cls}>{st.text}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {parsed.length > 10 && (
                <p className="text-xs text-muted-foreground text-center">... و {parsed.length - 10} موظف آخر</p>
              )}
            </div>
          )}

          {/* ── Step 3: Progress / Done ── */}
          {step === 3 && (
            <div className="space-y-5 py-4">
              {importing ? (
                <>
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 size={20} className="animate-spin text-primary" />
                    <p className="font-medium text-foreground">{progressLabel}</p>
                  </div>
                  <Progress value={progress} className="h-3" />
                  <p className="text-xs text-muted-foreground text-center">{progress}%</p>
                </>
              ) : (
                <div className="text-center space-y-3">
                  {errors.length === 0 ? (
                    <>
                      <CheckCircle size={48} className="text-success mx-auto" />
                      <p className="text-lg font-bold text-foreground">✅ تم استيراد {parsed.length} موظف بنجاح</p>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={48} className="text-warning mx-auto" />
                      <p className="text-lg font-bold text-foreground">
                        ✅ نجح {parsed.length - errors.length} | ⚠️ فشل {errors.length}
                      </p>
                      <Button variant="outline" size="sm" onClick={downloadErrorReport} className="gap-2">
                        <Download size={14} /> تحميل تقرير الأخطاء
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          {step === 1 && (
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>رجوع</Button>
              <Button onClick={handleConfirm} className="gap-2">
                تأكيد استيراد {parsed.length} موظف
              </Button>
            </>
          )}
          {step === 3 && !importing && (
            <Button onClick={onClose}>إغلاق</Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportEmployeesModal;
