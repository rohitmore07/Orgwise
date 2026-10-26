'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/app-shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Bell, Key, Monitor, Moon, Sun, Trash2, User } from 'lucide-react';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  viewer: 'Viewer',
};

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    if (profile?.name) setName(profile.name);
    // Load saved preferences
    try {
      const prefs = JSON.parse(localStorage.getItem('orgwise_prefs') || '{}');
      setNotificationsEnabled(prefs.notificationsEnabled ?? true);
      setTheme(prefs.theme ?? 'system');
    } catch {
      // Ignore storage errors
    }
  }, [profile]);

  const saveProfile = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.patch('/users/me', { name: name.trim() });
      await refreshProfile();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const savePreference = (key: string, value: unknown) => {
    try {
      const prefs = JSON.parse(localStorage.getItem('orgwise_prefs') || '{}');
      prefs[key] = value;
      localStorage.setItem('orgwise_prefs', JSON.stringify(prefs));
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your profile, preferences, and session."
      />

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <User className="size-4 text-muted-foreground" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
              <Input value={profile?.email ?? ''} disabled className="opacity-60" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Role</label>
              <div className="flex h-10 items-center">
                <Badge variant="secondary">
                  {ROLE_LABEL[profile?.role ?? ''] ?? profile?.role}
                </Badge>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Member since
              </label>
              <div className="flex h-10 items-center text-sm text-foreground">
                {profile?.createdAt ? formatDate(profile.createdAt) : '—'}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveProfile} disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Monitor className="size-4 text-muted-foreground" /> Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {[
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setTheme(opt.value as 'light' | 'dark' | 'system');
                  savePreference('theme', opt.value);
                  // Apply theme immediately
                  if (opt.value === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  } else if (opt.value === 'light') {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                  } else {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    document.documentElement.classList.toggle('dark', prefersDark);
                    document.documentElement.classList.toggle('light', !prefersDark);
                  }
                }}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  theme === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
                }`}
              >
                <opt.icon className="size-4" />
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="size-4 text-muted-foreground" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => {
                setNotificationsEnabled(e.target.checked);
                savePreference('notificationsEnabled', e.target.checked);
              }}
              className="size-4 rounded border-border accent-primary"
            />
            <div>
              <p className="text-sm font-medium text-foreground">Enable notifications</p>
              <p className="text-xs text-muted-foreground">
                Show alerts for imports, updates, and system events.
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Key className="size-4 text-muted-foreground" /> Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/50 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Password</p>
              <p className="text-xs text-muted-foreground">
                Manage your account password via your authentication provider.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/forgot-password">Reset password</a>
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/50 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Active session</p>
              <p className="text-xs text-muted-foreground">
                You are signed in as {profile?.email}.
              </p>
            </div>
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            >
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trash2 className="size-4 text-muted-foreground" /> About orgwise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">2.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Environment</span>
              <Badge variant="secondary">{process.env.NODE_ENV ?? 'development'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-medium">Enterprise Workforce Intelligence</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
