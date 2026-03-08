import { Users, Wallet, CreditCard, UserCheck, TrendingUp, DollarSign } from 'lucide-react';
import StatCard from '@/components/StatCard';
import AlertsList from '@/components/AlertsList';
import { kpis, ordersByApp, attendanceWeek, plRecords } from '@/data/mock';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['hsl(217,72%,45%)', 'hsl(152,60%,40%)', 'hsl(38,92%,50%)', 'hsl(0,72%,51%)', 'hsl(280,60%,50%)'];

const Dashboard = () => {
  const plChart = [...plRecords].reverse().map(r => ({
    month: r.month.split('-')[1],
    ربح: r.netProfit,
  }));

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">لوحة التحكم</h1>
        <p className="page-subtitle mt-1">نظرة عامة على النظام</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard title="المناديب النشطين" value={kpis.activeEmployees} icon={Users} color="primary" subtitle="من أصل 8" />
        <StatCard title="رواتب الشهر" value={`${kpis.totalSalaries.toLocaleString()} ر.س`} icon={Wallet} color="success" />
        <StatCard title="الحاضرين اليوم" value={kpis.presentToday} icon={UserCheck} color="info" subtitle={`غائب: ${kpis.absentToday}`} />
        <StatCard title="السلف القائمة" value={`${kpis.totalAdvancesAmount.toLocaleString()} ر.س`} icon={CreditCard} color="warning" subtitle={`${kpis.activeAdvances} سلف`} />
        <StatCard title="إيرادات الشهر" value={`${kpis.monthRevenue.toLocaleString()} ر.س`} icon={DollarSign} color="primary" />
        <StatCard title="صافي الربح" value={`${kpis.monthProfit.toLocaleString()} ر.س`} icon={TrendingUp} color="success" />
      </div>

      {/* Charts + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border/50 shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">الحضور هذا الأسبوع</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={attendanceWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="present" name="حاضر" fill="hsl(152,60%,40%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" name="غائب" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="leave" name="إجازة" fill="hsl(38,92%,50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <AlertsList />
      </div>

      {/* Orders + P&L */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">الطلبات حسب التطبيق</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={ordersByApp} dataKey="orders" nameKey="app" cx="50%" cy="50%" outerRadius={80} label={({ app, percent }) => `${app} ${(percent * 100).toFixed(0)}%`}>
                {ordersByApp.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">صافي الربح — آخر 6 شهور</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={plChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="ربح" stroke="hsl(152,60%,40%)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm p-4 sm:p-5">
        <h3 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">آخر النشاطات</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {[
            { text: 'تسجيل حضور 6 مناديب', time: 'منذ ساعة', icon: UserCheck },
            { text: 'إدخال طلبات هنقرستيشن', time: 'منذ 3 ساعات', icon: TrendingUp },
            { text: 'اعتماد خصومات كيتا', time: 'أمس', icon: CreditCard },
            { text: 'إضافة سلفة لأحمد العمري', time: 'أمس', icon: Wallet },
            { text: 'تعيين دراجة DRG-050', time: 'منذ يومين', icon: Users },
            { text: 'اعتماد رواتب فبراير', time: 'منذ يومين', icon: DollarSign },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 sm:p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <item.icon size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{item.text}</p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
