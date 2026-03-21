import { useSystemSettings } from '@/context/SystemSettingsContext';
import { Settings2 } from 'lucide-react';
import ProjectSettings from '@/components/settings/ProjectSettings';

export default function GeneralSettings() {
  const { projectName } = useSystemSettings();

  document.title = `${projectName} | الإعدادات العامة`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Settings2 size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            الإعدادات العامة
          </h1>
          <p className="text-sm text-muted-foreground">
            إدارة اسم المشروع والشعار والمظهر
          </p>
        </div>
      </div>
      <ProjectSettings />
    </div>
  );
}
