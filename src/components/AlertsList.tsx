import { alerts } from '@/data/mock';
import { AlertTriangle, Clock, Shield, CreditCard } from 'lucide-react';

const typeLabels: Record<string, string> = {
  residency: 'إقامة',
  insurance: 'تأمين',
  registration: 'تسجيل',
  license: 'رخصة',
  installment: 'قسط سلفة',
  deduction: 'خصم',
};

const typeIcons: Record<string, typeof AlertTriangle> = {
  residency: AlertTriangle,
  insurance: Shield,
  registration: Clock,
  license: Clock,
  installment: CreditCard,
  deduction: CreditCard,
};

const severityStyles: Record<string, string> = {
  urgent: 'badge-urgent',
  warning: 'badge-warning',
  info: 'badge-info',
};

const AlertsList = () => {
  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-sm">
      <div className="p-5 border-b border-border/50">
        <h3 className="font-semibold text-foreground">التنبيهات العاجلة</h3>
      </div>
      <div className="divide-y divide-border/50">
        {alerts.sort((a, b) => a.daysLeft - b.daysLeft).map((alert) => {
          const Icon = typeIcons[alert.type] || AlertTriangle;
          return (
            <div key={alert.id} className="p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                alert.severity === 'urgent' ? 'bg-destructive/10 text-destructive' :
                alert.severity === 'warning' ? 'bg-warning/10 text-warning' : 'bg-info/10 text-info'
              }`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{alert.entityName}</p>
                <p className="text-xs text-muted-foreground">انتهاء {typeLabels[alert.type]} — {alert.dueDate}</p>
              </div>
              <span className={severityStyles[alert.severity]}>
                {alert.daysLeft === 0 ? 'اليوم' : `${alert.daysLeft} يوم`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AlertsList;
