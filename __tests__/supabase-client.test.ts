import { supaBrowser } from '@/lib/supabase/client';
import { supaServer } from '@/lib/supabase/server';

// Mock @supabase/ssr
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(),
  createServerClient: jest.fn(),
}));

// Mock next/headers
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

describe('Supabase Client Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Browser Client', () => {
    it('creates browser client with correct configuration', () => {
      const { createBrowserClient } = require('@supabase/ssr');
      const mockClient = { auth: {}, from: jest.fn() };
      createBrowserClient.mockReturnValue(mockClient);

      const client = supaBrowser();

      expect(createBrowserClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key'
      );
      expect(client).toBe(mockClient);
    });

    it('handles missing environment variables', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // The function should still work but with undefined values
      expect(() => supaBrowser()).not.toThrow();
    });
  });

  describe('Server Client', () => {
    it('creates server client with correct configuration', () => {
      // Ensure environment variables are set
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
      
      // Clear the module cache to ensure fresh import
      jest.resetModules();
      
      const { createServerClient } = require('@supabase/ssr');
      const { cookies } = require('next/headers');
      const mockClient = { auth: {}, from: jest.fn() };
      const mockCookieStore = {
        get: jest.fn(),
        set: jest.fn(),
      };
      
      createServerClient.mockReturnValue(mockClient);
      cookies.mockReturnValue(mockCookieStore);

      const { supaServer } = require('@/lib/supabase/server');
      const client = supaServer();

      expect(createServerClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        {
          cookies: {
            get: expect.any(Function),
            set: expect.any(Function),
            remove: expect.any(Function),
          },
        }
      );
      expect(client).toBe(mockClient);
    });

    it('handles missing environment variables', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Clear the module cache to ensure fresh import
      jest.resetModules();

      const { createServerClient } = require('@supabase/ssr');
      const { cookies } = require('next/headers');
      const mockClient = { auth: {}, from: jest.fn() };
      const mockCookieStore = {
        get: jest.fn(),
        set: jest.fn(),
      };
      
      createServerClient.mockReturnValue(mockClient);
      cookies.mockReturnValue(mockCookieStore);

      const { supaServer } = require('@/lib/supabase/server');
      const client = supaServer();

      expect(createServerClient).toHaveBeenCalledWith(
        undefined,
        undefined,
        {
          cookies: {
            get: expect.any(Function),
            set: expect.any(Function),
            remove: expect.any(Function),
          },
        }
      );
    });
  });
});
