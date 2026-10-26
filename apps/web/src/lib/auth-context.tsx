'use client';

import { useRouter } from 'next/navigation';
import type { Role, User } from '@orgwise/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiClientError, purgeApiCache } from '@/lib/api';
import { setStoredRole, signOutNeon, syncOAuthSession, type NeonSession } from '@/lib/auth';

interface AuthState {
  session: NeonSession | null;
  /** Local user profile resolved from the API (id, role, employee link). */
  profile: User | null;
  role: Role | null;
  /** True while the initial session/profile sync is in flight. */
  initializing: boolean;
  /** Non-null when the profile could not be resolved (network/API issue). */
  profileError: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<User | null>;
}

const AuthContext = createContext<AuthState | null>(null);

const ROLE_ORDER: Role[] = ['admin', 'manager', 'viewer'];

/** True for 401/403 — a real session/authorization failure, not a network blip. */
function isAuthFailure(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 401 || error.status === 403);
}

/** Inactivity auto-logout — signs the user out after this many idle minutes. */
const IDLE_TIMEOUT_MINUTES = Number(process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES ?? 30);
// Activity events that reset the idle timer (browser supports all of these).
const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

/**
 * Signs out automatically after `minutes` of inactivity (protects sensitive
 * workforce data on shared devices). Every activity event resets the timer;
 * only a signed-in session arms it.
 */
function useIdleSignOut(minutes: number, active: boolean, signOut: () => Promise<void>): void {
  useEffect(() => {
    if (!active || minutes <= 0) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let signedOut = false;

    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () => {
          signedOut = true;
          void signOut().then(() => {
            // Hard redirect: clears client state and lets the middleware see the
            // removed marker cookie, bouncing to the sign-in page.
            window.location.assign('/signin');
          });
        },
        minutes * 60 * 1000,
      );
    };

    const onActivity = () => reset();
    const events: (keyof WindowEventMap)[] = [...IDLE_EVENTS];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    reset();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      // If the timeout fired and this cleanup runs afterwards, make sure the
      // sign-out isn't dropped by an unmount racing the navigation.
      if (signedOut) void signOut();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, minutes]);
}
// Client-side auth provider for the app shell. Boots from the persisted Neon session, resolves the platform…
// profile + RBAC role from `GET /users/me`, and stores the role back into the session marker so the edge…
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<NeonSession | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const refreshProfile = useCallback(async (): Promise<User | null> => {
    try {
      const me = await api.get<User>('/users/me');
      setProfile(me);
      setProfileError(null);
      setStoredRole(me.role);
      // Keep context + marker in sync with the freshest role.
      setSession((current) => (current ? { ...current, role: me.role } : current));
      return me;
    } catch (error) {
      if (isAuthFailure(error)) {
        // Session genuinely invalid — clear it.
        setSession(null);
        setProfile(null);
        setProfileError(null);
        return null;
      }
      // Network/API issue — keep the session, expose a retryable error.
      setProfile(null);
      setProfileError(error instanceof Error ? error.message : 'Could not load your profile');
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      // 1) Refresh the Neon session (picks up OAuth callbacks + fresh tokens).
      const synced = await syncOAuthSession();
      if (cancelled) return;

      if (!synced) {
        setSession(null);
        setProfile(null);
        setProfileError(null);
        setInitializing(false);
        // The marker cookie lied (or the Neon session expired) — don't leave
        // the user staring at an empty workspace; bounce to the sign-in page.
        router.replace('/signin');
        return;
      }

      setSession(synced);
      // 2) Resolve the platform profile + role from the API.
      await refreshProfile();
      if (cancelled) return;
      setInitializing(false);
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [refreshProfile, router]);

  const signOut = useCallback(async () => {
    await signOutNeon();
    // Drop the previous account's cached responses (belt-and-suspenders on top
    // of the per-user cache key).
    purgeApiCache();
    setSession(null);
    setProfile(null);
    setProfileError(null);
  }, []);

  // Auto-logout after inactivity once a real session exists. The signOut call
  // below clears the marker cookie, so the middleware bounces to /signin.
  useIdleSignOut(IDLE_TIMEOUT_MINUTES, Boolean(session), signOut);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      role: profile?.role ?? session?.role ?? null,
      initializing,
      profileError,
      signOut,
      refreshProfile,
    }),
    [session, profile, initializing, profileError, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

/** True when the current role may write (admin/manager); false for viewers. */
export function useCanWrite(): boolean {
  const { role } = useAuth();
  return role === 'admin' || role === 'manager';
}

/** Returns true when the current role is at least the given role in the hierarchy. */
export function hasMinRole(role: Role | null, required: Role): boolean {
  if (!role) return false;
  return ROLE_ORDER.indexOf(role) <= ROLE_ORDER.indexOf(required);
}
