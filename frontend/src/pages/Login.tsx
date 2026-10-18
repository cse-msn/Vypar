import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { api, getApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

const schema = z.object({
  name: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
});
type FormValues = z.infer<typeof schema>;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [setupMode, setSetupMode] = useState(false);
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      if (setupMode) {
        await api.post('/auth/register', { name: values.name || 'Owner', email: values.email, password: values.password });
        toast.success('Owner account created');
      }
      await login(values.email, values.password);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(getApiError(err).message);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* One subtle brand treatment: soft berry + gold glows. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-16 right-[-3rem] h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary font-display text-3xl font-semibold text-primary-foreground shadow-xl shadow-primary/25 ring-1 ring-gold/40">
            M
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">MNM Fashion</h1>
          <div className="mt-2.5 flex items-center gap-3 text-muted-foreground">
            <span className="h-px w-7 bg-gold/70" />
            <span className="text-sm">Inventory &amp; billing</span>
            <span className="h-px w-7 bg-gold/70" />
          </div>
        </div>

        <Card className="border-border/70 shadow-xl shadow-primary/5">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {setupMode && (
                <div>
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" placeholder="Owner name" {...register('name')} />
                </div>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="you@shop.com" {...register('email')} />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={setupMode ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  {...register('password')}
                />
                {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting && <Spinner className="h-4 w-4" />}
                {setupMode ? 'Create owner & sign in' : 'Sign in'}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setSetupMode((v) => !v)}
              className="mt-4 w-full text-center text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              {setupMode ? '← Back to sign in' : 'First time here? Set up the owner account'}
            </button>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">Wagholi, Pune · Maharashtra</p>
      </div>
    </div>
  );
}
