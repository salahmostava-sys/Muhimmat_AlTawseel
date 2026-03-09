import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, FileText, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

type TradeRegister = {
  id: string;
  name: string;
  name_en: string | null;
  cr_number: string | null;
  notes: string | null;
  created_at: string;
  _employeeCount?: number;
};

const emptyForm = { name: '', name_en: '', cr_number: '', notes: '' };

const TradeRegisters = () => {
  const { toast } = useToast();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [registers, setRegisters] = useState<TradeRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TradeRegister | null>(null);
  const [deleteLinkedCount, setDeleteLinkedCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const fetchRegisters = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trade_registers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { toast({ title: 'خطأ في تحميل السجلات', variant: 'destructive' }); setLoading(false); return; }

    const { data: empData } = await supabase
      .from('employees')
      .select('trade_register_id')
      .eq('status', 'active');

    const countMap: Record<string, number> = {};
    empData?.forEach(e => { if (e.trade_register_id) countMap[e.trade_register_id] = (countMap[e.trade_register_id] || 0) + 1; });

    setRegisters((data || []).map(r => ({ ...r, _employeeCount: countMap[r.id] || 0 })));
    setLoading(false);
  };

  useEffect(() => { fetchRegisters(); }, []);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (r: TradeRegister) => {
    setEditingId(r.id);
    setForm({ name: r.name, name_en: r.name_en || '', cr_number: r.cr_number || '', notes: r.notes || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: 'اسم السجل مطلوب', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      name_en: form.name_en.trim() || null,
      cr_number: form.cr_number.trim() || null,
      notes: form.notes.trim() || null,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from('trade_registers').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('trade_registers').insert(payload));
    }
    setSaving(false);
    if (error) { toast({ title: 'حدث خطأ أثناء الحفظ', variant: 'destructive' }); return; }
    toast({ title: editingId ? 'تم تحديث السجل التجاري' : 'تم إضافة السجل التجاري بنجاح' });
    setDialogOpen(false);
    fetchRegisters();
  };

  const openDelete = async (r: TradeRegister) => {
    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('trade_register_id', r.id);
    setDeleteLinkedCount(count || 0);
    setDeleteTarget(r);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Unlink employees first
    if (deleteLinkedCount > 0) {
      await supabase.from('employees').update({ trade_register_id: null }).eq('trade_register_id', deleteTarget.id);
    }
    const { error } = await supabase.from('trade_registers').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) { toast({ title: 'خطأ في الحذف', variant: 'destructive' }); return; }
    toast({ title: 'تم حذف السجل التجاري' });
    fetchRegisters();
  };

  const filtered = registers.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.cr_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.name_en || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>الإعدادات</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="text-foreground font-medium">السجلات التجارية</span>
          </nav>
          <h1 className="page-title">السجلات التجارية</h1>
        </div>
        {isAdmin && (
          <Button onClick={openAdd} className="gap-2 shadow-brand-sm">
            <Plus size={15} />
            إضافة سجل
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none right-3" />
        <Input
          placeholder="بحث بالاسم أو رقم السجل..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-8 h-9 text-sm"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا توجد سجلات تجارية</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(reg => (
            <div key={reg.id} className="bg-card border border-border/50 rounded-xl p-5 flex flex-col gap-3 hover:shadow-card-hover transition-shadow group">
              <div className="flex items-start justify-between">
                <div className="icon-box bg-brand-50 dark:bg-primary/10">
                  <FileText size={18} className="text-primary" />
                </div>
                {isAdmin && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(reg)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <Edit size={13} />
                    </button>
                    <button onClick={() => openDelete(reg)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm leading-tight">{reg.name}</h3>
                {reg.name_en && <p className="text-xs text-muted-foreground mt-0.5">{reg.name_en}</p>}
                {reg.cr_number && (
                  <p className="mt-2 font-mono text-xs bg-muted/60 rounded-md px-2 py-1 inline-block tracking-wide">
                    رقم السجل: {reg.cr_number}
                  </p>
                )}
                {reg.notes && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{reg.notes}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-border/30">
                <Users size={12} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">👤 {reg._employeeCount} موظف مرتبط</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل السجل التجاري' : 'إضافة سجل تجاري جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>اسم السجل (عربي) <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: شركة النجوم للتوصيل" />
            </div>
            <div className="space-y-1.5">
              <Label>اسم السجل (إنجليزي)</Label>
              <Input value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="e.g. Al-Nujoom Delivery Co." dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>رقم السجل التجاري</Label>
              <Input value={form.cr_number} onChange={e => setForm(p => ({ ...p, cr_number: e.target.value }))} placeholder="1234567890" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="أي ملاحظات إضافية عن السجل..." />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف السجل التجاري</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteLinkedCount > 0
                ? `يوجد ${deleteLinkedCount} موظف مرتبطون بهذا السجل. سيتم إلغاء الربط عند الحذف.`
                : 'هل أنت متأكد من حذف هذا السجل التجاري؟ لا يمكن التراجع عن هذا الإجراء.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90 gap-2">
              {deleting && <Loader2 size={13} className="animate-spin" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TradeRegisters;
