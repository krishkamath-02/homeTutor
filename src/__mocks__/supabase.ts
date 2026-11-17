import { vi } from 'vitest';

// -----------------------------------------------------------------------
// Minimal Supabase mock.
// Each builder method returns `this` so callers can chain freely.
// The terminal methods (single, execute, etc.) are vi.fn() and can be
// overridden per-test with mockResolvedValueOnce / mockResolvedValue.
// -----------------------------------------------------------------------

const makeBuilder = () => {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    // Default: resolving query without .single()
    then: undefined as any,
  };

  // Make the builder itself thenable so `await supabase.from(...).select(...)` works
  let _resolve: (v: any) => void;
  let _promise = new Promise<{ data: any; error: any }>((resolve) => {
    _resolve = resolve;
  });

  // Expose a helper tests can call to flush the promise
  builder.__resolve = (value: any) => _resolve(value);
  builder.then = (onFulfilled: any) => _promise.then(onFulfilled);

  // Default: most chains resolve to empty success
  _promise = Promise.resolve({ data: [], error: null });

  return builder;
};

export const mockBuilder = makeBuilder();

export const supabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'test@test.com' } }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'test@test.com' } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  },
  from: vi.fn(() => makeBuilder()),
};

// Allow tests to import the same shape Zustand stores import:
// `import { supabase } from '../lib/supabase'`
export default supabase;
