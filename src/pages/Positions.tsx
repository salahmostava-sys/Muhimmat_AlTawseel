import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Briefcase, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';

type Department = { id: string; name: string };
type Position = {
  id: string;
  name: string;
  name_en: string | null;
  department_id: string | null;
  description: string | null;
  created_at: string;
  departments?: Department | null;
};

const emptyForm = { name: '', name_en: '', department_id: '', description: '' };

const Positions = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const { permissions } = usePermissions('employees');
  const canEdit = permissions.can_edit;
  const canDelete = permissions.can_delete;

  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [posRes, deptRes] = await Promise.all([
      supabase.from('positions').select('*, departments(id, name)').order('created_at', { ascending: false }),
      supabase.from('departments').select('id, name').order('name'),
    ]);
    setPositions(posRes.data || []);
    setDepartments(deptRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: Position) => {
    setEditingId(p.id);
    setForm({ name: p.name, name_en: p.name_en || '', department_id: p.department_id || '', description: p.description || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: 'اسم المسمى مطلوب', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      name_en: form.name_en.trim() || null,
      department_id: form.department_id || null,
      description: form.description.trim() || null,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from('positions').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('positions').insert(payload));
    }
    setSaving(false);
    if (error) { toast({ title: 'حدث خطأ أثناء الحفظ', variant: 'destructive' }); return; }
    toast({ title: editingId ? 'تم التحديث' : 'تم الإضافة بنجاح' });
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('positions').delete().eq('id', deleteId);
    setDeleteId(null);
    if (error) { toast({ title: 'خطأ في الحذف', variant: 'destructive' }); return; }
    toast({ title: 'تم الحذف' });
    fetchData();
  };

  const filtered = positions.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.name_en || '').toLowerCase().includes(search.toLowerCase());
    const matchDept = filterDept === 'all' || p.department_id === filterDept;
    return matchSearch && matchDept;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>{isRTL ? 'الموارد البشرية' : 'HR'}</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="text-foreground font-medium">{isRTL ? 'المسميات الوظيفية' : 'Positions'}</span>
          </nav>
          <h1 className="page-title">{isRTL ? 'المسميات الوظيفية' : 'Job Positions'}</h1>
        </div>
        {canEdit && (
          <Button onClick={openAdd} className="gap-2 shadow-brand-sm">
            <Plus size={15} />
            {isRTL ? 'إضافة مسمى' : 'Add Position'}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none ltr:left-3 rtl:right-3" />
          <Input
            placeholder={isRTL ? 'بحث...' : 'Search...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ltr:pl-8 rtl:pr-8 h-9 text-sm"
          />
        </div>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="h-9 w-48 text-sm">
            <SelectValue placeholder={isRTL ? 'كل الأقسام' : 'All Departments'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRTL ? 'كل الأقسام' : 'All Departments'}</SelectItem>
            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>{isRTL ? 'المسمى الوظيفي' : 'Position'}</th>
              <th>{isRTL ? 'القسم' : 'Department'}</th>
              <th>{isRTL ? 'الوصف' : 'Description'}</th>
              {canEdit && <th className="w-20">{isRTL ? 'إجراءات' : 'Actions'}</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(canEdit ? 4 : 3)].map((_, j) => (
                    <td key={j}><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 4 : 3} className="text-center py-12 text-muted-foreground">
                  <Briefcase size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{isRTL ? 'لا توجد مسميات وظيفية' : 'No positions found'}</p>
                </td>
              </tr>
            ) : filtered.map(pos => (
              <tr key={pos.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="icon-box-sm bg-primary/10">
                      <Briefcase size={13} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{pos.name}</p>
                      {pos.name_en && <p className="text-xs text-muted-foreground">{pos.name_en}</p>}
                    </div>
                  </div>
                </td>
                <td>
                  {pos.departments
                    ? <span className="badge-info text-xs">{pos.departments.name}</span>
                    : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="text-xs text-muted-foreground max-w-xs truncate">{pos.description || '—'}</td>
                {canEdit && (
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(pos)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Edit size={13} />
                      </button>
                      {canDelete && (
                        <button onClick={() => setDeleteId(pos.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{editingId ? (isRTL ? 'تعديل مسمى وظيفي' : 'Edit Position') : (isRTL ? 'إضافة مسمى وظيفي' : 'Add Position')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{isRTL ? 'الاسم (عربي)' : 'Name (Arabic)'} <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={isRTL ? 'مثال: مدير مبيعات' : 'e.g. Sales Manager'} />
            </div>
            <div className="space-y-1.5">
              <Label>{isRTL ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
              <Input value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="e.g. Sales Manager" />
            </div>
            <div className="space-y-1.5">
              <Label>{isRTL ? 'القسم' : 'Department'}</Label>
              <Select value={form.department_id || 'none'} onValueChange={v => setForm(p => ({ ...p, department_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر قسم' : 'Select department'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{isRTL ? 'بدون قسم' : 'No department'}</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{isRTL ? 'الوصف' : 'Description'}</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'حذف المسمى الوظيفي' : 'Delete Position'}</AlertDialogTitle>
            <AlertDialogDescription>{isRTL ? 'هل أنت متأكد؟ لا يمكن التراجع.' : 'Are you sure? This cannot be undone.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Positions;
