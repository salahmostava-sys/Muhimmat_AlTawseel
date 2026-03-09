import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Building2, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';

type Department = {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  created_at: string;
  _employeeCount?: number;
};

const emptyForm = { name: '', name_en: '', description: '' };

const Departments = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const { permissions } = usePermissions('employees');
  const canEdit = permissions.can_edit;
  const canDelete = permissions.can_delete;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDepartments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { toast({ title: 'خطأ في تحميل الأقسام', variant: 'destructive' }); setLoading(false); return; }

    // Fetch employee counts per department
    const { data: empData } = await supabase
      .from('employees')
      .select('department_id')
      .eq('status', 'active');

    const countMap: Record<string, number> = {};
    empData?.forEach(e => { if (e.department_id) countMap[e.department_id] = (countMap[e.department_id] || 0) + 1; });

    setDepartments((data || []).map(d => ({ ...d, _employeeCount: countMap[d.id] || 0 })));
    setLoading(false);
  };

  useEffect(() => { fetchDepartments(); }, []);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (d: Department) => { setEditingId(d.id); setForm({ name: d.name, name_en: d.name_en || '', description: d.description || '' }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: 'اسم القسم مطلوب', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), name_en: form.name_en.trim() || null, description: form.description.trim() || null };
    let error;
    if (editingId) {
      ({ error } = await supabase.from('departments').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('departments').insert(payload));
    }
    setSaving(false);
    if (error) { toast({ title: 'حدث خطأ أثناء الحفظ', variant: 'destructive' }); return; }
    toast({ title: editingId ? 'تم تحديث القسم' : 'تم إضافة القسم بنجاح' });
    setDialogOpen(false);
    fetchDepartments();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from('departments').delete().eq('id', deleteId);
    setDeleting(false);
    setDeleteId(null);
    if (error) { toast({ title: 'خطأ في الحذف', variant: 'destructive' }); return; }
    toast({ title: 'تم حذف القسم' });
    fetchDepartments();
  };

  const filtered = departments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.name_en || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>{isRTL ? 'الموارد البشرية' : 'HR'}</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="text-foreground font-medium">{isRTL ? 'الأقسام' : 'Departments'}</span>
          </nav>
          <h1 className="page-title">{isRTL ? 'إدارة الأقسام' : 'Departments'}</h1>
        </div>
        {canEdit && (
          <Button onClick={openAdd} className="gap-2 shadow-brand-sm">
            <Plus size={15} />
            {isRTL ? 'إضافة قسم' : 'Add Department'}
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none ltr:left-3 rtl:right-3" />
        <Input
          placeholder={isRTL ? 'بحث عن قسم...' : 'Search departments...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ltr:pl-8 rtl:pr-8 h-9 text-sm"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{isRTL ? 'لا توجد أقسام' : 'No departments found'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(dept => (
            <div key={dept.id} className="bg-card border border-border/50 rounded-xl p-5 flex flex-col gap-3 hover:shadow-card-hover transition-shadow group">
              <div className="flex items-start justify-between">
                <div className="icon-box bg-brand-50 dark:bg-primary/10">
                  <Building2 size={18} className="text-primary" />
                </div>
                {canEdit && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(dept)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <Edit size={13} />
                    </button>
                    {canDelete && (
                      <button onClick={() => setDeleteId(dept.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm leading-tight">{dept.name}</h3>
                {dept.name_en && <p className="text-xs text-muted-foreground mt-0.5">{dept.name_en}</p>}
                {dept.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{dept.description}</p>}
              </div>
              <div className="flex items-center gap-1.5 mt-auto">
                <Users size={12} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{dept._employeeCount} {isRTL ? 'موظف نشط' : 'active employees'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{editingId ? (isRTL ? 'تعديل القسم' : 'Edit Department') : (isRTL ? 'إضافة قسم جديد' : 'Add Department')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">{isRTL ? 'اسم القسم (عربي)' : 'Department Name (Arabic)'} <span className="text-destructive">*</span></Label>
              <Input id="name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={isRTL ? 'مثال: الموارد البشرية' : 'e.g. Human Resources'} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name_en">{isRTL ? 'اسم القسم (إنجليزي)' : 'Department Name (English)'}</Label>
              <Input id="name_en" value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="e.g. Human Resources" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">{isRTL ? 'الوصف' : 'Description'}</Label>
              <Textarea id="desc" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder={isRTL ? 'وصف مختصر للقسم...' : 'Brief description...'} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'حذف القسم' : 'Delete Department'}</AlertDialogTitle>
            <AlertDialogDescription>{isRTL ? 'هل أنت متأكد من حذف هذا القسم؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this department? This action cannot be undone.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90 gap-2">
              {deleting && <Loader2 size={13} className="animate-spin" />}
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Departments;
