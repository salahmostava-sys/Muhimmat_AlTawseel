import { Construction } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/attendance': 'الحضور والانصراف',
  '/orders': 'الطلبات اليومية',
  '/salaries': 'الرواتب',
  '/advances': 'السلف والأقساط',
  '/vehicles': 'المركبات',
  '/deductions': 'الخصومات',
  '/apps': 'التطبيقات',
  '/alerts': 'التنبيهات',
  '/reports': 'التقارير',
  '/settings': 'الإعدادات',
};

const ComingSoon = () => {
  const { pathname } = useLocation();
  const title = pageTitles[pathname] || 'الصفحة';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        <Construction size={32} />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        هذا القسم قيد التطوير وسيتم إضافته قريباً. يمكنك استخدام لوحة التحكم وإدارة الموظفين حالياً.
      </p>
    </div>
  );
};

export default ComingSoon;
