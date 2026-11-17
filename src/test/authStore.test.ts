import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// ─── Mock the supabase module before importing the store ────────────────────
vi.mock('../lib/supabase', () => {
  const makeChain = (defaultResult: any = { data: null, error: null }) => {
    const obj: any = {};
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'single'];
    methods.forEach(m => { obj[m] = vi.fn().mockReturnThis(); });
    // Make it awaitable
    obj.then = (resolve: any) => Promise.resolve(defaultResult).then(resolve);
    return obj;
  };

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null }),
        signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
      from: vi.fn(() => makeChain()),
    },
  };
});

import useAuthStore from '../store/authStore';
import { supabase } from '../lib/supabase';

const MOCK_USER = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'parent' as const,
};

const MOCK_PROFILE = {
  id: 'u1',
  name: 'Alice',
  role: 'parent',
  invite_code: 'ABC123',
  parent_id: null,
  subjects: ['Math'],
  avatar_url: null,
};

// Reset store state before each test
beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true });
  vi.clearAllMocks();
});

describe('authStore – login', () => {
  it('sets user and isAuthenticated to true', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => { result.current.login(MOCK_USER); });

    expect(result.current.user).toEqual(MOCK_USER);
    expect(result.current.isAuthenticated).toBe(true);
  });
});

describe('authStore – updateUser', () => {
  it('merges partial updates into existing user', () => {
    useAuthStore.setState({ user: MOCK_USER, isAuthenticated: true });
    const { result } = renderHook(() => useAuthStore());
    act(() => { result.current.updateUser({ name: 'Bob' }); });

    expect(result.current.user?.name).toBe('Bob');
    expect(result.current.user?.email).toBe(MOCK_USER.email); // unchanged
  });

  it('does nothing when user is null', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => { result.current.updateUser({ name: 'Bob' }); });
    expect(result.current.user).toBeNull();
  });
});

describe('authStore – logout', () => {
  it('calls supabase.auth.signOut and clears state', async () => {
    useAuthStore.setState({ user: MOCK_USER, isAuthenticated: true });
    const { result } = renderHook(() => useAuthStore());

    await act(async () => { await result.current.logout(); });

    expect(supabase.auth.signOut).toHaveBeenCalledOnce();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe('authStore – checkSession', () => {
  it('sets isAuthenticated false and isLoading false when no session', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null }, error: null
    } as any);

    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.checkSession(); });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches profile and sets user when session exists', async () => {
    const session = { user: { id: 'u1', email: 'alice@example.com' } };
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session }, error: null
    } as any);

    // Mock profiles query
    const profileChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: MOCK_PROFILE, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValueOnce(profileChain);

    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.checkSession(); });

    expect(result.current.user).toMatchObject({ id: 'u1', name: 'Alice', role: 'parent' });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('signs out and clears state when profile is not found', async () => {
    const session = { user: { id: 'u1', email: 'alice@example.com' } };
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session }, error: null
    } as any);

    const profileChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValueOnce(profileChain);

    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.checkSession(); });

    expect(supabase.auth.signOut).toHaveBeenCalledOnce();
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('handles thrown errors gracefully', async () => {
    vi.mocked(supabase.auth.getSession).mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.checkSession(); });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});

describe('authStore – updateProfileData', () => {
  it('updates supabase and merges local state', async () => {
    useAuthStore.setState({ user: MOCK_USER, isAuthenticated: true });

    const updateChain: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    vi.mocked(supabase.from).mockReturnValueOnce(updateChain);

    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.updateProfileData({ name: 'Alice Updated' }); });

    expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alice Updated' }));
    expect(result.current.user?.name).toBe('Alice Updated');
  });

  it('does nothing when user is null', async () => {
    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.updateProfileData({ name: 'X' }); });
    // No error thrown, from() never called
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
