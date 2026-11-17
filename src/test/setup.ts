import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock env variables used by the app
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SUPABASE_URL: 'https://mock.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
    VITE_GEMINI_API_KEY: 'mock-gemini-key',
  },
  writable: true,
});

// Silence console.error during tests (we assert on thrown errors directly)
vi.spyOn(console, 'error').mockImplementation(() => {});
