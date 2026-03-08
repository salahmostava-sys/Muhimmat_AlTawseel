import { ReactNode, useEffect } from 'react';
import AppSidebar from './AppSidebar';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import { useMobileSidebar, MobileSidebarProvider } from '@/context/MobileSidebarContext';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, Languages, Sun, Moon, Menu } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import GlobalSearch from '@/components/GlobalSearch';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

const routeTitles: Record<string, string> = {
  '/': 'dashboard',
  '/employees': 'employees',
  '/attendance': 'attendance',
  '/orders': 'orders',
  '/salaries': 'payroll',
  '/advances': 'advances',
  '/vehicles': 'vehicles',
  '/vehicle-tracking': 'vehicleTracking',
  '/fuel': 'fuel',
  '/deductions': 'deductions',
  '/apps': 'apps',
  '/alerts': 'alerts',
  '/settings/schemes': 'schemes',
  '/settings/users': 'users',
  '/settings/permissions': 'permissions',
  '/settings/general': 'generalSettings',
};

const AppLayoutInner = ({ children }: AppLayoutProps) => {
  const { lang, toggleLang } = useLanguage();
  const { signOut, role } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const { projectName } = useSystemSettings();
  const { toggle } = useMobileSidebar();
  const { t } = useTranslation();
  const location = useLocation();

  const roleLabels: Record<string, string> = {
    admin: 'مدير النظام', hr: 'موارد بشرية', finance: 'مالية',
    operations: 'عمليات', viewer: 'عارض',
  };

  const isRtl = lang === 'ar';

  useEffect(() => {
    const pageKey = routeTitles[location.pathname] || 'dashboard';
    document.title = `${projectName} | ${t(pageKey)}`;
  }, [location.pathname, projectName, t]);

  return (
    <div className="min-h-screen bg-background" dir={isRtl ? 'rtl' : 'ltr'}>
      <AppSidebar />

      <main className={cn(
        'min-h-screen flex flex-col transition-all duration-300',
        isRtl ? 'lg:mr-64' : 'lg:ml-64'
      )}>
        {/* Header */}
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Hamburger — mobile only */}
            <button
              onClick={toggle}
              className="lg:hidden h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              <Menu size={18} />
            </button>

            {role && (
              <span className="badge-info text-xs hidden sm:inline-flex">{roleLabels[role] || role}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 lg:gap-2">
            {/* Global search — hidden on very small screens */}
            <div className="hidden sm:block">
              <GlobalSearch />
            </div>

            {/* Notifications */}
            <NotificationCenter />

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Language toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLang}
              className="text-xs font-medium h-8 px-2 lg:px-3 gap-1"
            >
              <Languages size={13} />
              <span className="hidden sm:inline">{lang === 'ar' ? 'English' : 'عربي'}</span>
              <span className="sm:hidden">{lang === 'ar' ? 'EN' : 'ع'}</span>
            </Button>

            {/* Logout */}
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="h-8 px-2 lg:px-3 text-muted-foreground hover:text-destructive gap-1 text-xs"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">{t('logout')}</span>
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-4 sm:p-5 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

const AppLayout = ({ children }: AppLayoutProps) => (
  <MobileSidebarProvider>
    <AppLayoutInner>{children}</AppLayoutInner>
  </MobileSidebarProvider>
);

export default AppLayout;
