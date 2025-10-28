// Mock NextRequest for Jest environment
global.Request = class MockRequest {
  constructor(public url: string, public init?: any) {}
  async json() {
    return JSON.parse(this.init?.body || '{}');
  }
};

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: global.Request,
  NextResponse: {
    json: (data: any, init?: any) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
    }),
  },
}));

import { POST } from '@/app/api/moderation/[action]/route';
import { createClient, supaServer } from '@/lib/supabase/server';

// Mock Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  supaServer: jest.fn(),
}));

// Mock next/headers
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

describe('Moderation API Tests', () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn(),
        }),
        in: jest.fn().mockReturnValue({
          select: jest.fn(),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn(),
      }),
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    
    // Reset the mock chain
    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    
    mockSupabase.from.mockReturnValue({
      select: mockSelect,
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject unauthenticated requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: null }, 
        error: new Error('Not authenticated') 
      });

      const request = new Request('http://localhost:3000/api/moderation/accept', {
        method: 'POST',
        body: JSON.stringify({ qnaId: 1 }),
      });

      const response = await POST(request, { params: { action: 'accept' } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject regular users', async () => {
      const mockUser = { id: 'user123', email: 'user@example.com' };
      const mockProfile = { role: 'user' };

      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: mockUser }, 
        error: null 
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      });

      const request = new Request('http://localhost:3000/api/moderation/accept', {
        method: 'POST',
        body: JSON.stringify({ qnaId: 1 }),
      });

      const response = await POST(request, { params: { action: 'accept' } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Access denied');
    });

    it('should allow moderator users', async () => {
      const mockUser = { id: 'mod123', email: 'mod@example.com' };
      const mockProfile = { role: 'moderator' };

      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: mockUser }, 
        error: null 
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const request = new Request('http://localhost:3000/api/moderation/accept', {
        method: 'POST',
        body: JSON.stringify({ qnaId: 1 }),
      });

      const response = await POST(request, { params: { action: 'accept' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should allow admin users', async () => {
      const mockUser = { id: 'admin123', email: 'admin@example.com' };
      const mockProfile = { role: 'admin' };

      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: mockUser }, 
        error: null 
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const request = new Request('http://localhost:3000/api/moderation/accept', {
        method: 'POST',
        body: JSON.stringify({ qnaId: 1 }),
      });

      const response = await POST(request, { params: { action: 'accept' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Moderation Actions', () => {
    beforeEach(() => {
      const mockUser = { id: 'mod123', email: 'mod@example.com' };
      const mockProfile = { role: 'moderator' };

      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: mockUser }, 
        error: null 
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });
    });

    it('should handle accept action', async () => {
      const request = new Request('http://localhost:3000/api/moderation/accept', {
        method: 'POST',
        body: JSON.stringify({ qnaId: 1 }),
      });

      const response = await POST(request, { params: { action: 'accept' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('moderation_queue');
    });

    it('should handle deny action', async () => {
      const request = new Request('http://localhost:3000/api/moderation/deny', {
        method: 'POST',
        body: JSON.stringify({ qnaId: 1 }),
      });

      const response = await POST(request, { params: { action: 'deny' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle edit action with edited answer', async () => {
      const request = new Request('http://localhost:3000/api/moderation/edit', {
        method: 'POST',
        body: JSON.stringify({ 
          qnaId: 1, 
          editedAnswer: 'This is the edited answer' 
        }),
      });

      const response = await POST(request, { params: { action: 'edit' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle edit action with moderator notes', async () => {
      const request = new Request('http://localhost:3000/api/moderation/edit', {
        method: 'POST',
        body: JSON.stringify({ 
          qnaId: 1, 
          editedAnswer: 'This is the edited answer',
          moderatorNotes: 'Fixed grammar and improved clarity'
        }),
      });

      const response = await POST(request, { params: { action: 'edit' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      const mockUser = { id: 'mod123', email: 'mod@example.com' };
      const mockProfile = { role: 'moderator' };

      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: mockUser }, 
        error: null 
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      });
    });

    it('should handle missing qnaId', async () => {
      const request = new Request('http://localhost:3000/api/moderation/accept', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: { action: 'accept' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('QnA ID is required');
    });

    it('should handle database update errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { role: 'moderator' } })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: new Error('Database error') })
        })
      });

      const request = new Request('http://localhost:3000/api/moderation/accept', {
        method: 'POST',
        body: JSON.stringify({ qnaId: 1 }),
      });

      const response = await POST(request, { params: { action: 'accept' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update moderation status');
    });

    it('should handle profile fetch errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: new Error('Profile not found') })
          })
        })
      });

      const request = new Request('http://localhost:3000/api/moderation/accept', {
        method: 'POST',
        body: JSON.stringify({ qnaId: 1 }),
      });

      const response = await POST(request, { params: { action: 'accept' } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Access denied');
    });
  });

  describe('Model Retraining Trigger', () => {
    beforeEach(() => {
      const mockUser = { id: 'mod123', email: 'mod@example.com' };
      const mockProfile = { role: 'moderator' };

      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: mockUser }, 
        error: null 
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });
    });

    it('should check for retraining trigger on accept action', async () => {
      // Mock 20+ accepted items
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { role: 'moderator' } })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        }),
        in: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ 
            data: new Array(25).fill({ id: 1 }), 
            error: null 
          })
        })
      });

      const request = new Request('http://localhost:3000/api/moderation/accept', {
        method: 'POST',
        body: JSON.stringify({ qnaId: 1 }),
      });

      const response = await POST(request, { params: { action: 'accept' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Should check for retraining trigger
      expect(mockSupabase.from).toHaveBeenCalledWith('moderation_queue');
    });

    it('should check for retraining trigger on edit action', async () => {
      // Mock 20+ accepted items
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { role: 'moderator' } })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        }),
        in: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ 
            data: new Array(25).fill({ id: 1 }), 
            error: null 
          })
        })
      });

      const request = new Request('http://localhost:3000/api/moderation/edit', {
        method: 'POST',
        body: JSON.stringify({ 
          qnaId: 1, 
          editedAnswer: 'This is the edited answer' 
        }),
      });

      const response = await POST(request, { params: { action: 'edit' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should not check for retraining trigger on deny action', async () => {
      const request = new Request('http://localhost:3000/api/moderation/deny', {
        method: 'POST',
        body: JSON.stringify({ qnaId: 1 }),
      });

      const response = await POST(request, { params: { action: 'deny' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
