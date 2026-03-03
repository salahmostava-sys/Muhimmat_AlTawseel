import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Package, Eye, EyeOff } from 'lucide-react';

type Mode = 'login' | 'register' | 'forgot';

const Login = () => {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      const msg = error.message?.includes('Invalid login') ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : error.message;
      toast({ title: 'خطأ في تسجيل الدخول', description: msg, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-lg">
            <Package size={32} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">نظام إدارة التوصيل</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة مناديب التوصيل والرواتب</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-lg p-8">
          {mode === 'login' && (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-6">تسجيل الدخول</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="admin@delivery.sa" required dir="ltr" autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('password')}</Label>
                  <div className="relative">
                    <Input id="password" type={showPw ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                      className="pl-10" autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'تسجيل الدخول'}
                </Button>
              </form>
              <div className="mt-4 flex items-center justify-between text-sm">
                <button onClick={() => setMode('forgot')} className="text-primary hover:underline text-xs">
                  نسيت كلمة المرور؟
                </button>
              </div>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-6">استعادة كلمة المرور</h2>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">أدخل بريدك الإلكتروني وسيتم إرسال رابط إعادة تعيين كلمة المرور.</p>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@delivery.sa" dir="ltr" />
                </div>
                <Button className="w-full" onClick={() => {
                  toast({ title: 'تم الإرسال', description: 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني' });
                  setMode('login');
                }}>
                  إرسال رابط الاستعادة
                </Button>
                <button onClick={() => setMode('login')} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
                  ← العودة لتسجيل الدخول
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          نظام إدارة مناديب التوصيل © 2025
        </p>
      </div>
    </div>
  );
};

export default Login;
