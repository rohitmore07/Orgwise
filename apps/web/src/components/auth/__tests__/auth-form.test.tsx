import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthForm } from '@/components/auth/auth-form';

// Mock the Next router and the auth facade so the form can be tested in
// isolation without a real session or navigation.
const replace = vi.fn();
const push = vi.fn();

vi.mock('next/navigation', () => ({
  // Stable router object — an unstable reference would re-trigger the
  // AuthForm's session-sync effect on every render and redirect away.
  useRouter: vi.fn(() => ({ replace, push })),
  // No reset flag on the URL in these tests.
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('@/lib/auth', () => ({
  getStoredSession: () => null,
  syncOAuthSession: vi.fn().mockResolvedValue(null),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
}));

import * as auth from '@/lib/auth';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  replace.mockReset();
  push.mockReset();
});

describe('AuthForm', () => {
  it('renders the sign-in mode without a name field', () => {
    render(<AuthForm mode="signin" />);
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Work Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('renders the sign-up mode with a required name field', () => {
    render(<AuthForm mode="signup" />);
    expect(screen.getByText('Create your Enterprise Account')).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toBeRequired();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
  });

  it('requires an email, a password of at least 8 characters, and a name on signup (HTML validation)', () => {
    render(<AuthForm mode="signup" />);
    expect(screen.getByLabelText('Work Email')).toBeRequired();
    expect(screen.getByLabelText('Password')).toHaveAttribute('minLength', '8');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('calls signInWithEmail and navigates to the dashboard on a successful sign-in', async () => {
    vi.mocked(auth.signInWithEmail).mockResolvedValue({
      session: { user: { id: 'u1', email: 'a@b.co' } },
    });
    render(<AuthForm mode="signin" />);

    fireEvent.change(screen.getByLabelText('Work Email'), {
      target: { value: 'a@b.co' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'longenough' },
    });
    fireEvent.submit(screen.getAllByRole('button', { name: 'Sign In' })[0]!);

    await waitFor(() => expect(auth.signInWithEmail).toHaveBeenCalledWith('a@b.co', 'longenough'));
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('shows the server error message and does not navigate on failure', async () => {
    vi.mocked(auth.signInWithEmail).mockResolvedValue({ error: 'Invalid credentials' });
    render(<AuthForm mode="signin" />);

    fireEvent.change(screen.getByLabelText('Work Email'), {
      target: { value: 'a@b.co' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'longenough' },
    });
    fireEvent.submit(screen.getAllByRole('button', { name: 'Sign In' })[0]!);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials'));
    expect(push).not.toHaveBeenCalled();
  });
});
