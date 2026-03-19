import { useState, useEffect, forwardRef } from 'react';
import {
  Users, UserCheck, Bell, Package, Bike, Smartphone,
  TrendingUp, ArrowUpRight, ArrowDownRight, Award,
  BarChart2, Download, Activity, MapPin, ShieldCheck,
} from 'lucide-react';
import AlertsList from '@/components/AlertsList';
import { supabase } from '@/integrations/supabase/client';
import {
  format, subDays, formatDistanceToNow,
  subMonths, startOfMonth, endOfMonth,
} from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { useLanguage } from '@/context/LanguageContext';
import { useAppColors } from '@/hooks/useAppColors';
import { Button } from '@/components/ui/button';
import * as XLSX from '@e965/xlsx';

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── Skeleton ─────────────────────────────────────────────────────
const Skeleton = ({ h = 'h-16', w = 'w-full' }: { h?: string; w?: string }) => (
  <div className={`${h} ${w} bg-muted/40 rounded-xl animate-pulse`} />
);

// ─── Custom Tooltip ───────────────────────────────────────────────
const CustomTooltip = forwardRef<HTMLDivElement, any>(({ active, payload, label }, ref) => {
  if (!active || !payload?.length) return null;
  return (
    <div ref={ref} className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
});
CustomTooltip.displayName = 'CustomTooltip';

// ─── KPI Card ─────────────────────────────────────────────────────
interface KpiCardProps {
  label: string; value: string | number; icon: any;
  color: string; bg: string; sub?: string;
  trend?: { value: number; positive: boolean };
  loading?: boolean;
}
const KpiCard = ({ label, value, icon: Icon, color, bg, sub, trend, loading }: KpiCardProps) => (
  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3 hover:shadow-md transition-shadow">
    {loading ? (
      <>
        <div className="h-9 w-9 rounded-xl bg-muted/40 animate-pulse" />
        <div className="h-7 w-20 bg-muted/40 animate-pulse rounded-lg" />
        <div className="h-3 w-28 bg-muted/40 animate-pulse rounded" />
      </>
    ) : (
      <>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
          <Icon size={18} className={color} />
        </div>
        <div>
          <p className="text-2xl font-black text-gray-900 leading-none">{value}</p>
          {trend && (
            <div className={`flex items-center gap-0.5 mt-1 text-[11px] font-semibold ${trend.positive ? 'text-emerald-600' : 'text-rose-500'}`}>
              {trend.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-700">{label}</p>
          {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </>
    )}
  </div>
);

// ─── Platform Card ────────────────────────────────────────────────
const PlatformCard = ({ name, orders, totalOrders, brandColor, textColor, riders }: {
  name: string; orders: number; totalOrders: number;
  brandColor: string; textColor: string; riders: number;
}) => {
  const pct = totalOrders > 0 ? Math.round((orders / totalOrders) * 100) : 0;
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: brandColor, color: textColor }}>{name}</span>
        <span className="text-lg font-black text-gray-900">{orders.toLocaleString()}</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-[11px] text-gray-400">
          <span>{pct}% من الإجمالي</span>
          <span>{riders} مندوب</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: brandColor }} />
        </div>
      </div>
    </div>
  );
};

// ─── Leaderboard ──────────────────────────────────────────────────
interface LeaderEntry { employeeId: string; name: string; orders: number; appColor: string; app: string; }
const RANK_COLORS = ['bg-amber-100 text-amber-600', 'bg-slate-100 text-slate-500', 'bg-orange-100 text-orange-500'];

const Leaderboard = ({ leaders, loading }: { leaders: LeaderEntry[]; loading: boolean }) => {
  const max = leaders[0]?.orders || 1;
  return (
    <div className="space-y-2">
      {loading
        ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-muted/40 rounded-xl animate-pulse" />)
        : leaders.length === 0
          ? <p className="text-sm text-muted-foreground text-center py-10">لا توجد بيانات طلبات هذا الشهر</p>
          : leaders.map((l, i) => (
            <div key={l.employeeId} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${RANK_COLORS[i] || 'bg-gray-100 text-gray-500'}`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 truncate">{l.name}</span>
                  <span className="text-sm font-black text-gray-900 flex-shrink-0 mr-2">{l.orders.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.appColor }} />
                  <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(l.orders / max) * 100}%`, backgroundColor: l.appColor }} />
                  </div>
                </div>
              </div>
            </div>
          ))
      }
    </div>
  );
};

// ─── Chart wrapper ────────────────────────────────────────────────
const Card = ({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
      <div>
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

// ─── Analytics Tab ────────────────────────────────────────────────
const MONTHS_BACK = 6;
interface AppStat { id: string; name: string; brand_color: string; text_color: string; orders: number; }
interface MonthlyTrend { month: string; orders: number; }

const AnalyticsTab = () => {
  const [loading, setLoading] = useState(true);
  const [appStats, setAppStats] = useState<AppStat[]>([]);
  const [topRiders, setTopRiders] = useState<{ id: string; name: string; orders: number; app: string; appColor: string }[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [prevMonthOrders, setPrevMonthOrders] = useState(0);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const currentMonth = format(new Date(), 'yyyy-MM');
  const prevMonth = format(subMonths(new Date(), 1), 'yyyy-MM');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [appsRes, empRes, prevOrdersRes, empOrdersRes, empNamesRes] = await Promise.all([
        supabase.from('apps').select('id, name, brand_color, text_color').eq('is_active', true),
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('daily_orders').select('orders_count').gte('date', `${prevMonth}-01`).lte('date', format(endOfMonth(new Date(`${prevMonth}-01`)), 'yyyy-MM-dd')),
        supabase.from('daily_orders').select('employee_id, orders_count, app_id').gte('date', `${currentMonth}-01`).lte('date', format(endOfMonth(new Date(`${currentMonth}-01`)), 'yyyy-MM-dd')),
        supabase.from('employees').select('id, name').eq('status', 'active'),
      ]);

      setTotalEmployees(empRes.count || 0);
      setPrevMonthOrders(prevOrdersRes.data?.reduce((s, r) => s + r.orders_count, 0) || 0);

      const apps = appsRes.data || [];
      const appMap = Object.fromEntries(apps.map(a => [a.id, { name: a.name, color: a.brand_color }]));
      const empMap = Object.fromEntries((empNamesRes.data || []).map(e => [e.id, e.name]));

      const trendMonths = Array.from({ length: MONTHS_BACK }, (_, i) => {
        const d = subMonths(new Date(), MONTHS_BACK - 1 - i);
        return { label: format(d, 'MMM yy'), start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd') };
      });

      const trendResults = await Promise.all(
        trendMonths.map(m => supabase.from('daily_orders').select('orders_count').gte('date', m.start).lte('date', m.end))
      );

      const appStatsData = apps.map(app => {
        const appOrders = (empOrdersRes.data || []).filter(o => o.app_id === app.id).reduce((s, r) => s + r.orders_count, 0);
        return { ...app, orders: appOrders };
      }).sort((a, b) => b.orders - a.orders);

      setAppStats(appStatsData);
      const total = appStatsData.reduce((s, a) => s + a.orders, 0);
      setTotalOrders(total);

      const riderTotals: Record<string, { orders: number; app: string; appColor: string }> = {};
      (empOrdersRes.data || []).forEach(o => {
        if (!riderTotals[o.employee_id]) riderTotals[o.employee_id] = { orders: 0, app: appMap[o.app_id]?.name || '—', appColor: appMap[o.app_id]?.color || '#888' };
        riderTotals[o.employee_id].orders += o.orders_count;
      });
      setTopRiders(Object.entries(riderTotals).map(([id, v]) => ({ id, name: empMap[id] || '—', ...v })).sort((a, b) => b.orders - a.orders).slice(0, 10));
      setMonthlyTrend(trendMonths.map((m, i) => ({ month: m.label, orders: (trendResults[i] as any).data?.reduce((s: number, r: any) => s + r.orders_count, 0) || 0 })));
      setLoading(false);
    };
    load();
  }, []);

  const growth = prevMonthOrders > 0 ? ((totalOrders - prevMonthOrders) / prevMonthOrders) * 100 : 0;

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appStats.map(a => ({ المنصة: a.name, الطلبات: a.orders }))), 'المنصات');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topRiders.map((r, i) => ({ '#': i + 1, المندوب: r.name, المنصة: r.app, الطلبات: r.orders }))), 'أفضل المناديب');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyTrend.map(m => ({ الشهر: m.month, الطلبات: m.orders }))), 'الاتجاه الشهري');
    XLSX.writeFile(wb, `تحليلات_${currentMonth}.xlsx`);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-3">
        <BarChart2 size={40} className="mx-auto text-primary animate-pulse" />
        <p className="text-muted-foreground text-sm">جارٍ تحميل التحليلات...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm">
            <p className="text-[11px] text-gray-400">إجمالي الطلبات</p>
            <p className="text-2xl font-black text-gray-900">{totalOrders.toLocaleString()}</p>
            <div className={`flex items-center gap-0.5 text-[11px] font-semibold ${growth >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {growth >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(growth).toFixed(1)}% مقارنة بالشهر السابق
            </div>
          </div>
          <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm">
            <p className="text-[11px] text-gray-400">المناديب النشطون</p>
            <p className="text-2xl font-black text-gray-900">{totalEmployees}</p>
            <p className="text-[11px] text-gray-400">متوسط {totalEmployees > 0 ? Math.round(totalOrders / totalEmployees) : 0} طلب/مندوب</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport} className="gap-2" size="sm">
          <Download size={14} /> تصدير Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card title="اتجاه الطلبات الشهري" subtitle={`آخر ${MONTHS_BACK} أشهر`}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyTrend} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: 12 }} />
                <Line type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: 'hsl(var(--primary))', r: 4, strokeWidth: 0 }} name="الطلبات" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
        <Card title="توزيع المنصات">
          {appStats.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={appStats} dataKey="orders" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                    {appStats.map(a => <Cell key={a.id} fill={a.brand_color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: 12 }} formatter={(v: any) => [v.toLocaleString(), 'طلب']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {appStats.map(a => (
                  <div key={a.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.brand_color }} /><span className="text-gray-700 font-medium">{a.name}</span></div>
                    <span className="text-gray-400">{a.orders.toLocaleString()} طلب</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>}
        </Card>
      </div>

      <Card title="أداء المنصات هذا الشهر">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={appStats} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: 12 }} formatter={(v: any) => [v.toLocaleString(), 'طلب']} />
            <Bar dataKey="orders" radius={[8, 8, 0, 0]} name="الطلبات">
              {appStats.map(a => <Cell key={a.id} fill={a.brand_color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="أفضل 10 مناديب" subtitle="حسب عدد الطلبات هذا الشهر">
        <div className="divide-y divide-gray-50">
          {topRiders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>
          ) : topRiders.map((rider, idx) => (
            <div key={rider.id} className="flex items-center gap-4 py-3 hover:bg-gray-50 rounded-xl px-2 transition-colors">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${RANK_COLORS[idx] || 'bg-gray-100 text-gray-500'}`}>{idx + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{rider.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rider.appColor }} />
                  <p className="text-xs text-gray-400">{rider.app}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-black text-gray-900">{rider.orders.toLocaleString()}</p>
                <p className="text-xs text-gray-400">طلب</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── Main Dashboard ────────────────────────────────────────────────
const Dashboard = () => {
  const { lang } = useLanguage();
  const { apps: appColors } = useAppColors();
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');

  const [kpis, setKpis] = useState({
    activeEmployees: 0, presentToday: 0, absentToday: 0,
    totalOrders: 0, prevMonthOrders: 0,
    activeVehicles: 0, activeAlerts: 0, activeApps: 0,
    hasLicense: 0, appliedLicense: 0, noLicense: 0,
    makkahCount: 0, jeddahCount: 0,
  });
  const [ordersByApp, setOrdersByApp] = useState<{ app: string; orders: number; appId: string; riders: number; brandColor: string; textColor: string }[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [attendanceWeek, setAttendanceWeek] = useState<{ day: string; present: number; absent: number; leave: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ text: string; time: string; icon: any }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      const currentMonth = format(new Date(), 'yyyy-MM');
      const prevMonth = format(subMonths(new Date(), 1), 'yyyy-MM');
      const sixDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');
      const prevStart = `${prevMonth}-01`;
      const prevEnd = format(endOfMonth(new Date(`${prevMonth}-01`)), 'yyyy-MM-dd');

      const [empRes, attRes, ordersRes, prevOrdersRes, weekAttRes, auditRes, empAppsRes, empDetailsRes, vehiclesRes, alertsRes, appsRes] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('attendance').select('status').eq('date', today),
        supabase.from('daily_orders').select('employee_id, app_id, orders_count, apps(id, name, brand_color, text_color), employees(name)').gte('date', currentMonth + '-01').lte('date', today),
        supabase.from('daily_orders').select('orders_count').gte('date', prevStart).lte('date', prevEnd),
        supabase.from('attendance').select('date, status').gte('date', sixDaysAgo).lte('date', today),
        supabase.from('audit_log').select('action, table_name, created_at, user_id, profiles(name, email)').order('created_at', { ascending: false }).limit(8),
        supabase.from('employee_apps').select('app_id, employee_id, apps(name, brand_color, text_color)').eq('status', 'active'),
        supabase.from('employees').select('city, license_status').eq('status', 'active'),
        supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('is_resolved', false),
        supabase.from('apps').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);

      const todayAtt = attRes.data || [];
      const presentToday = todayAtt.filter(a => a.status === 'present' || a.status === 'late').length;
      const absentToday = todayAtt.filter(a => a.status === 'absent').length;

      const empDetails = empDetailsRes.data || [];
      const prevTotal = prevOrdersRes.data?.reduce((s, r) => s + r.orders_count, 0) || 0;

      // Build app order totals + rider counts
      const appTotals: Record<string, { orders: number; appId: string; riders: Set<string>; brandColor: string; textColor: string }> = {};
      const empOrderMap: Record<string, { name: string; orders: number; appColor: string; app: string }> = {};

      ordersRes.data?.forEach(r => {
        const app = r.apps as any;
        const appName = app?.name || 'غير معروف';
        const appId = app?.id || r.app_id;
        const brandColor = app?.brand_color || '#6366f1';
        const textColor = app?.text_color || '#fff';
        if (!appTotals[appName]) appTotals[appName] = { orders: 0, appId, riders: new Set(), brandColor, textColor };
        appTotals[appName].orders += r.orders_count;
        appTotals[appName].riders.add(r.employee_id);

        const empName = (r.employees as any)?.name || '';
        if (empName) {
          if (!empOrderMap[r.employee_id]) empOrderMap[r.employee_id] = { name: empName, orders: 0, appColor: brandColor, app: appName };
          empOrderMap[r.employee_id].orders += r.orders_count;
        }
      });

      const ordersArr = Object.entries(appTotals).map(([app, d]) => ({
        app, orders: d.orders, appId: d.appId, riders: d.riders.size,
        brandColor: d.brandColor, textColor: d.textColor,
      }));
      const totalOrders = ordersArr.reduce((s, r) => s + r.orders, 0);
      setOrdersByApp(ordersArr.sort((a, b) => b.orders - a.orders));

      setKpis({
        activeEmployees: empRes.count || 0,
        presentToday, absentToday,
        totalOrders, prevMonthOrders: prevTotal,
        activeVehicles: vehiclesRes.count || 0,
        activeAlerts: alertsRes.count || 0,
        activeApps: appsRes.count || 0,
        hasLicense: empDetails.filter(e => e.license_status === 'has_license').length,
        appliedLicense: empDetails.filter(e => e.license_status === 'applied').length,
        noLicense: empDetails.filter(e => !e.license_status || e.license_status === 'no_license').length,
        makkahCount: empDetails.filter(e => e.city === 'makkah').length,
        jeddahCount: empDetails.filter(e => e.city === 'jeddah').length,
      });

      setLeaderboard(
        Object.entries(empOrderMap)
          .map(([id, d]) => ({ employeeId: id, name: d.name, orders: d.orders, appColor: d.appColor, app: d.app }))
          .sort((a, b) => b.orders - a.orders).slice(0, 5)
      );

      // Attendance week
      const weekMap: Record<string, { present: number; absent: number; leave: number }> = {};
      weekAttRes.data?.forEach(r => {
        if (!weekMap[r.date]) weekMap[r.date] = { present: 0, absent: 0, leave: 0 };
        if (r.status === 'present' || r.status === 'late') weekMap[r.date].present++;
        else if (r.status === 'absent') weekMap[r.date].absent++;
        else if (r.status === 'leave' || r.status === 'sick') weekMap[r.date].leave++;
      });
      const dayNames = lang === 'ar' ? ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      setAttendanceWeek(
        Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b))
          .map(([date, counts]) => ({ day: dayNames[new Date(date + 'T12:00:00').getDay()], ...counts }))
      );

      // Recent activity
      if (auditRes.data?.length) {
        const iconMap: Record<string, any> = {
          employees: Users, attendance: UserCheck, daily_orders: Package,
          vehicles: Bike, apps: Smartphone, alerts: Bell,
        };
        const tableAr: Record<string, string> = {
          employees: 'الموظفون', attendance: 'الحضور', advances: 'السلف',
          salary_records: 'الرواتب', daily_orders: 'الطلبات', vehicles: 'المركبات',
          apps: 'التطبيقات', user_roles: 'الأدوار', system_settings: 'الإعدادات', alerts: 'التنبيهات',
        };
        const actionAr: Record<string, string> = { INSERT: 'إضافة', UPDATE: 'تعديل', DELETE: 'حذف' };
        setRecentActivity(auditRes.data.map((a: any) => {
          const profile = a.profiles as any;
          const userName = profile?.name || profile?.email?.split('@')[0] || 'مستخدم';
          return {
            text: `${userName} — ${actionAr[a.action] || a.action} في ${tableAr[a.table_name] || a.table_name}`,
            time: formatDistanceToNow(new Date(a.created_at), { locale: ar, addSuffix: true }),
            icon: iconMap[a.table_name] || Activity,
          };
        }));
      }

      setLoading(false);
    };
    fetch();
  }, [lang]);

  const orderGrowth = kpis.prevMonthOrders > 0 ? ((kpis.totalOrders - kpis.prevMonthOrders) / kpis.prevMonthOrders) * 100 : 0;

  const kpiCards = [
    { label: 'المناديب النشطون', value: kpis.activeEmployees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', sub: 'موظف نشط' },
    { label: 'حاضرون اليوم', value: kpis.presentToday, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: `${kpis.absentToday} غائب` },
    { label: 'طلبات الشهر', value: kpis.totalOrders.toLocaleString(), icon: Package, color: 'text-orange-500', bg: 'bg-orange-50', trend: { value: orderGrowth, positive: orderGrowth >= 0 }, sub: 'هذا الشهر' },
    { label: 'متوسط طلبات/مندوب', value: kpis.activeEmployees > 0 ? Math.round(kpis.totalOrders / kpis.activeEmployees) : 0, icon: Award, color: 'text-amber-600', bg: 'bg-amber-50', sub: 'طلب هذا الشهر' },
    { label: 'المركبات النشطة', value: kpis.activeVehicles, icon: Bike, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'التنبيهات', value: kpis.activeAlerts, icon: Bell, color: 'text-rose-500', bg: 'bg-rose-50', sub: 'غير مقروءة' },
    { label: 'التطبيقات النشطة', value: kpis.activeApps, icon: Smartphone, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'مناديب بدون رخصة', value: kpis.noLicense, icon: ShieldCheck, color: 'text-red-500', bg: 'bg-red-50', sub: `${kpis.hasLicense} لديهم رخصة` },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1 text-xs text-gray-400 mb-1">
            <span>{lang === 'ar' ? 'الرئيسية' : 'Home'}</span>
            <span>/</span>
            <span className="text-gray-600 font-medium">{lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</span>
          </nav>
          <h1 className="text-xl font-black text-gray-900">{lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{format(new Date(), 'EEEE، d MMMM yyyy', { locale: ar })}</p>
        </div>
        <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
          {(['overview', 'analytics'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn('px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5',
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab === 'analytics' && <TrendingUp size={13} />}
              {tab === 'overview' ? (lang === 'ar' ? 'النظرة العامة' : 'Overview') : (lang === 'ar' ? 'التحليلات' : 'Analytics')}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'analytics' ? <AnalyticsTab /> : (
        <div className="space-y-5">
          {/* ── KPI Grid ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
            {kpiCards.map((kpi, i) => (
              <KpiCard key={i} {...kpi} loading={loading} />
            ))}
          </div>

          {/* ── Orders by Platform ─────────────────────────────── */}
          <Card title="طلبات الشهر حسب المنصة" subtitle={!loading ? `الإجمالي: ${kpis.totalOrders.toLocaleString()} طلب` : undefined}>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} h="h-24" />)}</div>
            ) : ordersByApp.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات طلبات لهذا الشهر</p>
            ) : (
              <div className={`grid gap-3 ${ordersByApp.length <= 2 ? 'grid-cols-2' : ordersByApp.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                {ordersByApp.map(({ app, orders, brandColor, textColor, riders }) => (
                  <PlatformCard key={app} name={app} orders={orders} totalOrders={kpis.totalOrders}
                    brandColor={brandColor} textColor={textColor} riders={riders} />
                ))}
              </div>
            )}
          </Card>

          {/* ── Attendance Chart + Alerts ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card title={lang === 'ar' ? 'الحضور — آخر 7 أيام' : 'Attendance — Last 7 Days'}>
                {attendanceWeek.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-gray-400 text-sm">لا توجد بيانات حضور</div>
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={attendanceWeek} barGap={4} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="present" name="حاضر" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="absent" name="غائب" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="leave" name="إجازة" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>
            <AlertsList />
          </div>

          {/* ── Leaderboard + Distribution ──────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="أفضل 5 مناديب" subtitle="حسب طلبات الشهر الحالي">
              <Leaderboard leaders={leaderboard} loading={loading} />
            </Card>

            <Card title="توزيع المناديب">
              {loading ? (
                <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} h="h-20" />)}</div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">المناطق</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'مكة المكرمة', value: kpis.makkahCount, color: 'bg-purple-50 text-purple-700' },
                        { label: 'جدة', value: kpis.jeddahCount, color: 'bg-blue-50 text-blue-700' },
                      ].map(item => (
                        <div key={item.label} className={`rounded-xl p-3 ${item.color}`}>
                          <p className="text-2xl font-black leading-none">{item.value}</p>
                          <p className="text-xs font-semibold mt-1 opacity-80">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">حالة الرخص</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'لديه رخصة', value: kpis.hasLicense, color: 'bg-emerald-50 text-emerald-700' },
                        { label: 'تم التقديم', value: kpis.appliedLicense, color: 'bg-amber-50 text-amber-700' },
                        { label: 'بدون رخصة', value: kpis.noLicense, color: 'bg-red-50 text-red-700' },
                      ].map(item => (
                        <div key={item.label} className={`rounded-xl p-3 ${item.color}`}>
                          <p className="text-xl font-black leading-none">{item.value}</p>
                          <p className="text-[10px] font-semibold mt-1 opacity-80">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* ── Recent Activity ──────────────────────────────────── */}
          <Card title="آخر النشاطات" subtitle="آخر 8 إجراءات في النظام">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">لا توجد نشاطات</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <item.icon size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{item.text}</p>
                      {item.time && <p className="text-[10px] text-gray-400">{item.time}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
