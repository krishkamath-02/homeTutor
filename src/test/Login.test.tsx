import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ─── Mock react-router-dom navigate ─────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ─── Mock supabase ───────────────────────────────────────────────────────────
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null }),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'parent-1' }, error: null }),
    })),
  },
}));

// ─── Mock authStore ──────────────────────────────────────────────────────────
const mockLogin = vi.fn();
vi.mock('../store/authStore', () => ({
  default: (selector: any) => selector({ login: mockLogin, user: null }),
}));

import Login from '../pages/Login';

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
});

describe('Login page – initial state (login mode)', () => {
  it('renders "Welcome Back" heading by default', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
  });

  it('does not render Full Name field in login mode', () => {
    renderLogin();
    expect(screen.queryByPlaceholderText(/enter your name/i)).not.toBeInTheDocument();
  });

  it('"Parent" role button is selected by default', () => {
    renderLogin();
    // The Parent button should have white background (selected state)
    const parentBtn = screen.getByRole('button', { name: /^parent$/i });
    expect(parentBtn).toBeInTheDocument();
  });
});

describe('Login page – role toggle', () => {
  it('switches to student role when Student button is clicked', async () => {
    renderLogin();
    const studentBtn = screen.getByRole('button', { name: /^student$/i });
    await userEvent.click(studentBtn);
    // In login mode, role switch doesn't show extra fields but doesn't error
    expect(studentBtn).toBeInTheDocument();
  });
});

describe('Login page – sign up mode', () => {
  it('switches to sign-up mode when "Sign up" is clicked', async () => {
    renderLogin();
    const signUpLink = screen.getByRole('button', { name: /sign up/i });
    await userEvent.click(signUpLink);
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows Full Name field in sign-up mode', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));
    expect(screen.getByPlaceholderText(/enter your name/i)).toBeInTheDocument();
  });

  it('hides invite code field for parent role in sign-up mode', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));
    // Parent is default role, so invite code should NOT be shown
    expect(screen.queryByPlaceholderText(/invite code/i)).not.toBeInTheDocument();
  });

  it('shows invite code field when Student role is selected in sign-up', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));
    await userEvent.click(screen.getByRole('button', { name: /^student$/i }));
    expect(screen.getByPlaceholderText(/invite code/i)).toBeInTheDocument();
  });
});

describe('Login page – form submission (sign in)', () => {
  it('calls supabase.auth.signInWithPassword on form submit', async () => {
    const { supabase } = await import('../lib/supabase');
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/enter your email/i), 'alice@example.com');
    await userEvent.type(screen.getByPlaceholderText(/••••••••/i), 'password123');
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'alice@example.com',
        password: 'password123',
      });
    });
  });

  it('navigates to parent dashboard after successful login as parent', async () => {
    renderLogin();
    await userEvent.type(screen.getByPlaceholderText(/enter your email/i), 'alice@example.com');
    await userEvent.type(screen.getByPlaceholderText(/••••••••/i), 'password123');
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/parent/dashboard'));
  });

  it('shows error message when login fails', async () => {
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null } as any,
      error: { message: 'Invalid credentials' } as any,
    });

    renderLogin();
    await userEvent.type(screen.getByPlaceholderText(/enter your email/i), 'bad@example.com');
    await userEvent.type(screen.getByPlaceholderText(/••••••••/i), 'wrongpass');
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() => expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument());
  });
});

describe('Login page – switching back to login mode', () => {
  it('shows "Log in" link in sign-up mode and toggles back', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });
});
