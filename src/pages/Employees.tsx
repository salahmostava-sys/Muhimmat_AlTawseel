import { useState } from 'react';
import { employees } from '@/data/mock';
import { Search, Plus, Filter, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const statusLabels: Record<string, string> = {
  active: 'نشط',
  suspended: 'موقوف',
  terminated: 'منتهي',
};

const statusStyles: Record<string, string> = {
  active: 'badge-success',
  suspended: 'badge-warning',
  terminated: 'badge-urgent',
};

const Employees = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = employees.filter((e) => {
    const matchesSearch = e.name.includes(search) || e.phone.includes(search) || e.nationalId.includes(search);
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الموظفون</h1>
          <p className="text-sm text-muted-foreground mt-1">{employees.length} مندوب مسجل</p>
        </div>
        <Button className="gap-2">
          <Plus size={16} />
          إضافة مندوب
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم، الهاتف أو رقم الهوية..."
            className="pr-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'suspended', 'terminated'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {s === 'all' ? 'الكل' : statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">الاسم</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">الهاتف</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">رقم الهوية</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">نوع الراتب</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">التطبيقات</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">الإقامة</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">الحالة</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                        {emp.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-foreground">{emp.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground" dir="ltr">{emp.phone}</td>
                  <td className="p-4 text-sm text-muted-foreground font-mono" dir="ltr">{emp.nationalId}</td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {emp.salaryType === 'orders' ? `طلبات — ${emp.schemeName}` : `دوام — ${emp.monthlySalary?.toLocaleString()} ر.س`}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1 flex-wrap">
                      {emp.apps.map((app) => (
                        <span key={app} className="badge-info">{app}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{emp.residencyExpiry}</td>
                  <td className="p-4">
                    <span className={statusStyles[emp.status]}>{statusLabels[emp.status]}</span>
                  </td>
                  <td className="p-4">
                    <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Employees;
