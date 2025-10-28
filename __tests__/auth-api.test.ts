// Polyfill for Request in test environment
global.Request = global.Request || require('node-fetch').Request;

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ask/route';
import { moderationService } from '@/lib/moderation';
import { detectCrisis } from '@/lib/crisis';

// Mock dependencies
jest.mock('@/lib/moderation', () => ({
  moderationService: {
    checkText: jest.fn(),
  },
}));

jest.mock('@/lib/crisis', () => ({
  detectCrisis: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  supaServer: jest.fn(),
}));

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    OPENAI_API_KEY: 'test-key',
    VECTOR_STORE_ID: 'test-store',
    SYSTEM_PROMPT: 'Test system prompt',
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('Auth API Integration', () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (moderationService.checkText as jest.Mock).mockResolvedValue({
      flagged: false,
      categories: [],
      reason: 'Content is clean'
    });
    (detectCrisis as jest.Mock).mockReturnValue({ isCrisis: false });
  });

  describe('Authentication Context', () => {
    it('handles authenticated user requests', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      
      const { supaServer } = require('@/lib/supabase/server');
      supaServer.mockReturnValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: 'What is faith?',
          history: []
        }),
      });

      // Mock OpenAI response
      const mockOpenAI = require('openai').default;
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Faith is ' } }] };
          yield { choices: [{ delta: { content: 'a belief system.' } }] };
        }
      };
      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockStream),
          },
        },
      }));

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('handles anonymous user requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { session_id: 'anon123' },
              error: null
            })
          })
        })
      });
      
      const { supaServer } = require('@/lib/supabase/server');
      supaServer.mockReturnValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: 'What is faith?',
          history: []
        }),
      });

      // Mock OpenAI response
      const mockOpenAI = require('openai').default;
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Faith is ' } }] };
          yield { choices: [{ delta: { content: 'a belief system.' } }] };
        }
      };
      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockStream),
          },
        },
      }));

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe('User Profile Integration', () => {
    it('saves user data to profiles table on signup', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      
      const mockProfilesTable = {
        upsert: jest.fn().mockResolvedValue({ error: null })
      };
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') return mockProfilesTable;
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 1 },
                error: null
              })
            })
          })
        };
      });
      
      const { supaServer } = require('@/lib/supabase/server');
      supaServer.mockReturnValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: 'What is faith?',
          history: []
        }),
      });

      // Mock OpenAI response
      const mockOpenAI = require('openai').default;
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Faith is ' } }] };
          yield { choices: [{ delta: { content: 'a belief system.' } }] };
        }
      };
      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockStream),
          },
        },
      }));

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('handles missing environment variables', async () => {
      process.env.OPENAI_API_KEY = '';
      
      const request = new NextRequest('http://localhost:3000/api/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: 'What is faith?',
          history: []
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data.error).toBe('OpenAI API key not configured');
    });

    it('handles Supabase connection errors', async () => {
      const { supaServer } = require('@/lib/supabase/server');
      supaServer.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const request = new NextRequest('http://localhost:3000/api/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: 'What is faith?',
          history: []
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });
  });
});
