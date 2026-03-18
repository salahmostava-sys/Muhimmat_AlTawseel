import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, ChevronUp, ChevronDown, ChevronsUpDown, Loader2, X, Check, Calendar, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays, parseISO, addMonths } from 'date-fns';
import { Layers } from 'lucide-react';

type Employee = { id: string; name: string; phone?: string | null; national_id?: string | null; city?: string | null; };
type TierRecord = {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_phone?: string | null;
  employee_national_id?: string | null;
  employee_city?: string | null;
  package_type: string;
  start_date: string;
  renewal_date: string;
  delivery_status: 'pending' | 'delivered' | 'absconded';
  notes?: string | null;
  created_at: string;
};

type SortDir = 'asc' | 'desc' | null;

const PACKAGE_TYPES = ['شريحة أساسية', 'شريحة متقدمة', 'شريحة بريميوم', 'شريحة مؤقتة', 'أخرى'];

const DELIVERY_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'في الانتظار', cls: 'badge-warning' },
  delivered: { label: 'مسلّمة',      cls: 'badge-success' },
  absconded: { label: 'مندوب هروب',  cls: 'badge-urgent'  },
};

const SortIcon = ({ field, sortField, sortDir }: { field: string; sortField: string | null; sortDir: SortDir }) => {
  if (sortField !== field) return <ChevronsUpDown size={11} className="text-muted-foreground/40 inline ms-1" />;
  if (sortDir === 'asc') return <ChevronUp size={11} className="text-primary inline ms-1" />;
  return <ChevronDown size={11} className="text-primary inline ms-1" />;
};

const EmployeeTiers = () => {
  const { toast } = useToast();
  const [records, setRecords] = useState<TierRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TierRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [empId, setEmpId] = useState('');
  const [packageType, setPackageType] = useState('شريحة أساسية');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [renewalDate, setRenewalDate] = useState(format(addMonths(new Date(), 12), 'yyyy-MM-dd'));
  const [deliveryStatus, setDeliveryStatus] = useState<'pending' | 'delivered' | 'absconded'>('pending');
  const [notes, setNotes] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: tiersData }, { data: empsData }] = await Promise.all([
      (supabase as any).from('employee_tiers').select('*').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, name, phone, national_id, city').eq('status', 'active').order('name'),
    ]);
    setEmployees((empsData || []) as Employee[]);
    if (tiersData) {
      const empMap: Record<string, Employee> = {};
      (empsData || []).forEach((e: Employee) => { empMap[e.id] = e; });
      setRecords((tiersData as any[]).map(t => ({
        ...t,
        employee_name: empMap[t.employee_id]?.name || '—',
        employee_phone: empMap[t.employee_id]?.phone,
        employee_national_id: empMap[t.employee_id]?.national_id,
        employee_city: empMap[t.employee_id]?.city,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openAdd = () => {
    setEditing(null);
    setEmpId(''); setPackageType('شريحة أساسية');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setRenewalDate(format(addMonths(new Date(), 12), 'yyyy-MM-dd'));
    setDeliveryStatus('pending'); setNotes('');
    setShowModal(true);
  };

  const openEdit = (r: TierRecord) => {
    setEditing(r);
    setEmpId(r.employee_id); setPackageType(r.package_type);
    setStartDate(r.start_date); setRenewalDate(r.renewal_date);
    setDeliveryStatus(r.delivery_status); setNotes(r.notes || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!empId) { toast({ title: 'خطأ', description: 'يرجى اختيار موظف', variant: 'destructive' }); return; }
    setSaving(true);
    const db = supabase as any;
    const payload = { employee_id: empId, package_type: packageType, start_date: startDate, renewal_date: renewalDate, delivery_status: deliveryStatus, notes: notes || null };
    if (editing) {
      const { error } = await db.from('employee_tiers').update(payload).eq('id', editing.id);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      toast({ title: '✅ تم التعديل' });
    } else {
      const { error } = await db.from('employee_tiers').insert(payload);
      if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      toast({ title: '✅ تمت الإضافة' });
    }
    setSaving(false);
    setShowModal(false);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await (supabase as any).from('employee_tiers').delete().eq('id', deleteId);
    toast({ title: 'تم الحذف' });
    setDeleteId(null);
    fetchAll();
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortField(null); setSortDir(null); }
      else setSortDir('asc');
    } else { setSortField(field); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let list = records.filter(r => {
      const matchSearch = !search || r.employee_name.includes(search) || (r.employee_national_id || '').includes(search);
      const matchStatus = statusFilter === 'all' || r.delivery_status === statusFilter;
      return matchSearch && matchStatus;
    });
    if (sortField && sortDir) {
      list = [...list].sort((a, b) => {
        let va: any = (a as any)[sortField] || '';
        let vb: any = (b as any)[sortField] || '';
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [records, search, statusFilter, sortField, sortDir]);

  // Stats
  const total = records.length;
  const delivered = records.filter(r => r.delivery_status === 'delivered').length;
  const absconded = records.filter(r => r.delivery_status === 'absconded').length;
  const renewingSoon = records.filter(r => {
    const days = differenceInDays(parseISO(r.renewal_date), new Date());
    return days >= 0 && days <= 30;
  }).length;

  const ThSort = ({ field, label }: { field: string; label: string }) => (
    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors border-b border-border/50" onClick={() => handleSort(field)}>
      {label} <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </th>
  );

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <nav className="page-breadcrumb">
            <span>العمليات</span>
            <span className="page-breadcrumb-sep">/</span>
            <span>شرائح الشركة</span>
          </nav>
          <h1 className="page-title flex items-center gap-2"><Layers size={20} /> شرائح الشركة</h1>
        </div>
        <Button className="gap-2" onClick={openAdd}><Plus size={15} /> إضافة شريحة</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border/50 rounded-xl p-4 flex items-center justify-between">
          <div><p className="text-xs text-muted-foreground">إجمالي الشرائح</p><p className="text-2xl font-bold text-foreground mt-0.5">{total}</p></div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"><Layers size={17} className="text-primary" /></div>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-4 flex items-center justify-between">
          <div><p className="text-xs text-muted-foreground">شرائح مسلّمة</p><p className="text-2xl font-bold text-success mt-0.5">{delivered}</p></div>
          <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center"><CheckCircle2 size={17} className="text-success" /></div>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-4 flex items-center justify-between">
          <div><p className="text-xs text-muted-foreground">مندوب هروب</p><p className="text-2xl font-bold text-destructive mt-0.5">{absconded}</p></div>
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle size={17} className="text-destructive" /></div>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-4 flex items-center justify-between">
          <div><p className="text-xs text-muted-foreground">تجديد قريب (≤30 يوم)</p><p className="text-2xl font-bold text-warning mt-0.5">{renewingSoon}</p></div>
          <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center"><Calendar size={17} className="text-warning" /></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو الهوية..." className="pr-9 h-9 w-56" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {[{ v: 'all', l: 'الكل' }, { v: 'pending', l: 'في الانتظار' }, { v: 'delivered', l: 'مسلّمة' }, { v: 'absconded', l: 'هروب' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {s.l}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground mr-auto">{filtered.length} سجل</span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" /> جارٍ التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Layers size={32} className="opacity-30" />
            <p>لا توجد شرائح — أضف شريحة جديدة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/50 border-b border-border/50">
                <tr>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-right whitespace-nowrap border-b border-border/50">#</th>
                  <ThSort field="employee_name" label="المندوب" />
                  <ThSort field="employee_national_id" label="رقم الهاتف" />
                  <ThSort field="package_type" label="نوع الباقة" />
                  <ThSort field="renewal_date" label="تاريخ التجديد" />
                  <ThSort field="delivery_status" label="حالة التسليم" />
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const days = differenceInDays(parseISO(r.renewal_date), new Date());
                  const soonWarning = days >= 0 && days <= 30;
                  const expired = days < 0;
                  const ds = DELIVERY_STATUS_MAP[r.delivery_status];
                  return (
                    <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-sm text-foreground">{r.employee_name}</span>
                          {r.employee_city && <span className="text-[10px] text-muted-foreground">{r.employee_city === 'makkah' ? 'مكة' : 'جدة'}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground" dir="ltr">{r.employee_phone || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{r.package_type}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-xs font-medium ${expired ? 'text-destructive' : soonWarning ? 'text-warning' : 'text-foreground'}`}>
                            {r.renewal_date}
                          </span>
                          {expired
                            ? <span className="text-[10px] text-destructive">منتهية منذ {Math.abs(days)} يوم</span>
                            : soonWarning
                            ? <span className="text-[10px] text-warning">تجديد خلال {days} يوم</span>
                            : <span className="text-[10px] text-muted-foreground">متبقي {days} يوم</span>
                          }
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><span className={ds?.cls}>{ds?.label}</span></td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="تعديل">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="حذف">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل الشريحة' : 'إضافة شريحة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>المندوب *</Label>
              <Select value={empId} onValueChange={setEmpId}>
                <SelectTrigger><SelectValue placeholder="اختر مندوباً" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>نوع الباقة *</Label>
              <Select value={packageType} onValueChange={setPackageType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PACKAGE_TYPES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>تاريخ البداية</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>تاريخ التجديد</Label>
                <Input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>حالة التسليم</Label>
              <Select value={deliveryStatus} onValueChange={v => setDeliveryStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">في الانتظار</SelectItem>
                  <SelectItem value="delivered">مسلّمة</SelectItem>
                  <SelectItem value="absconded">مندوب هروب</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات اختيارية..." />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin ml-1" />}
              {editing ? 'حفظ التعديلات' : 'إضافة الشريحة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الشريحة</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmployeeTiers;
