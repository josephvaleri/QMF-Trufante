import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import AuthPage from '@/app/auth/page';
import HomePage from '@/app/page';
import ModerationPage from '@/app/moderation/page';
import { supaBrowser } from '@/lib/supabase/client';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  supaBrowser: jest.fn(),
}));

// Mock Next.js Image component
jest.mock('next/image', () => {
  return function MockImage(props: any) {
    // Remove Next.js specific props that cause warnings in tests
    const { fill, priority, ...imgProps } = props;
    return React.createElement('img', imgProps);
  };
});

describe('Comprehensive Authentication System Tests', () => {
  const mockPush = jest.fn();
  
  // Create a proper mock chain for Supabase queries
  const createMockQuery = (data: any, error: any = null) => ({
    data,
    error,
    then: jest.fn().mockResolvedValue({ data, error }),
  });

  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn(),
        }),
        order: jest.fn(),
        limit: jest.fn(),
        in: jest.fn().mockReturnValue({
          select: jest.fn(),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn(),
      }),
      upsert: jest.fn(),
      insert: jest.fn(),
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    (supaBrowser as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('Login Flow', () => {
    it('should handle successful login with proper state management', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      const mockProfile = { role: 'user' };

      mockSupabase.auth.getUser
        .mockResolvedValueOnce({ data: { user: null } }) // Initial check
        .mockResolvedValueOnce({ data: { user: mockUser } }); // After login

      mockSupabase.auth.signInWithPassword.mockResolvedValue({ 
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

      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      render(<AuthPage />);

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('should handle login errors gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({ 
        data: { user: null }, 
        error: { message: 'Invalid email or password' } 
      });

      render(<AuthPage />);

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
      });
    });
  });

  describe('Signup Flow with Profile Creation', () => {
    it('should create profile with preferred name during signup', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      const mockProfilesTable = {
        upsert: jest.fn().mockResolvedValue({ error: null })
      };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      mockSupabase.auth.signUp.mockResolvedValue({ 
        data: { user: mockUser }, 
        error: null 
      });
      mockSupabase.from.mockReturnValue(mockProfilesTable);

      render(<AuthPage />);

      // Switch to signup mode
      const signUpButton = screen.getByRole('button', { name: 'Sign Up' });
      fireEvent.click(signUpButton);

      await waitFor(() => {
        const emailInput = screen.getByLabelText('Email Address');
        const passwordInput = screen.getByLabelText('Password');
        const preferredNameInput = screen.getByLabelText('What would you like to be called?');
        const submitButton = screen.getByRole('button', { name: 'Create Account' });

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.change(preferredNameInput, { target: { value: 'John Doe' } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
        expect(mockProfilesTable.upsert).toHaveBeenCalledWith({
          user_id: 'user123',
          email: 'test@example.com',
          preferred_name: 'John Doe'
        });
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('should create profile without preferred name during signup', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      const mockProfilesTable = {
        upsert: jest.fn().mockResolvedValue({ error: null })
      };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      mockSupabase.auth.signUp.mockResolvedValue({ 
        data: { user: mockUser }, 
        error: null 
      });
      mockSupabase.from.mockReturnValue(mockProfilesTable);

      render(<AuthPage />);

      // Switch to signup mode
      const signUpButton = screen.getByRole('button', { name: 'Sign Up' });
      fireEvent.click(signUpButton);

      await waitFor(() => {
        const emailInput = screen.getByLabelText('Email Address');
        const passwordInput = screen.getByLabelText('Password');
        const submitButton = screen.getByRole('button', { name: 'Create Account' });

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        // Leave preferred name empty
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockProfilesTable.upsert).toHaveBeenCalledWith({
          user_id: 'user123',
          email: 'test@example.com'
        });
      });
    });

    it('should handle signup errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      mockSupabase.auth.signUp.mockResolvedValue({ 
        data: { user: null }, 
        error: { message: 'Email already registered' } 
      });

      render(<AuthPage />);

      // Switch to signup mode
      const signUpButton = screen.getByRole('button', { name: 'Sign Up' });
      fireEvent.click(signUpButton);

      await waitFor(() => {
        const emailInput = screen.getByLabelText('Email Address');
        const passwordInput = screen.getByLabelText('Password');
        const submitButton = screen.getByRole('button', { name: 'Create Account' });

        fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Email already registered')).toBeInTheDocument();
      });
    });
  });

  describe('Home Page Authentication', () => {
    it('should show login button for unauthenticated users', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
        expect(screen.queryByText('Logout')).not.toBeInTheDocument();
      });
    });

    it('should show user controls for authenticated users', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      const mockProfile = { role: 'user' };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
        expect(screen.getByText('My Profile')).toBeInTheDocument();
        expect(screen.queryByText('Login')).not.toBeInTheDocument();
      });
    });

    it('should show moderation button for admin users', async () => {
      const mockUser = { id: 'admin123', email: 'admin@example.com' };
      const mockProfile = { role: 'admin' };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('Moderation')).toBeInTheDocument();
        expect(screen.getByText('Logout')).toBeInTheDocument();
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });
    });

    it('should show moderation button for moderator users', async () => {
      const mockUser = { id: 'mod123', email: 'mod@example.com' };
      const mockProfile = { role: 'moderator' };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('Moderation')).toBeInTheDocument();
      });
    });
  });

  describe('Logout Flow', () => {
    it('should handle successful logout', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      const mockProfile = { role: 'user' };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      });

      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      render(<HomePage />);

      await waitFor(() => {
        const logoutButton = screen.getByText('Logout');
        fireEvent.click(logoutButton);
      });

      await waitFor(() => {
        expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      });
    });

    it('should handle logout errors gracefully', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      const mockProfile = { role: 'user' };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      });

      mockSupabase.auth.signOut.mockRejectedValue(new Error('Network error'));

      render(<HomePage />);

      await waitFor(() => {
        const logoutButton = screen.getByText('Logout');
        fireEvent.click(logoutButton);
      });

      // Should still attempt logout even if it fails
      await waitFor(() => {
        expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      });
    });
  });

  describe('Moderation Page Access Control', () => {
    it('should redirect unauthenticated users to auth page', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

      render(<ModerationPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth');
      });
    });

    it('should redirect regular users to auth page', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      const mockProfile = { role: 'user' };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      });

      render(<ModerationPage />);

      await waitFor(() => {
        expect(screen.getByText('Access denied. Moderator or Admin role required.')).toBeInTheDocument();
      });
    });

    it('should allow access for admin users', async () => {
      const mockUser = { id: 'admin123', email: 'admin@example.com' };
      const mockProfile = { role: 'admin' };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      });

      // Mock moderation queue data
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });

      render(<ModerationPage />);

      await waitFor(() => {
        expect(screen.getByText('Moderation Queue')).toBeInTheDocument();
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      });
    });

    it('should allow access for moderator users', async () => {
      const mockUser = { id: 'mod123', email: 'mod@example.com' };
      const mockProfile = { role: 'moderator' };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      });

      // Mock moderation queue data
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });

      render(<ModerationPage />);

      await waitFor(() => {
        expect(screen.getByText('Moderation Queue')).toBeInTheDocument();
        expect(screen.getByText('Moderator Dashboard')).toBeInTheDocument();
      });
    });

    it('should handle auth state changes and redirect on logout', async () => {
      const mockUser = { id: 'admin123', email: 'admin@example.com' };
      const mockProfile = { role: 'admin' };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });

      let authStateCallback: any;
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authStateCallback = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      });

      // Mock moderation queue data
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      });

      render(<ModerationPage />);

      await waitFor(() => {
        expect(screen.getByText('Moderation Queue')).toBeInTheDocument();
      });

      // Simulate logout
      act(() => {
        authStateCallback('SIGNED_OUT', null);
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth');
      });
    });
  });

  describe('Profile Creation Edge Cases', () => {
    it('should handle profile creation errors gracefully', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      const mockProfilesTable = {
        upsert: jest.fn().mockResolvedValue({ error: { message: 'Database error' } })
      };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      mockSupabase.auth.signUp.mockResolvedValue({ 
        data: { user: mockUser }, 
        error: null 
      });
      mockSupabase.from.mockReturnValue(mockProfilesTable);

      render(<AuthPage />);

      // Switch to signup mode
      const signUpButton = screen.getByRole('button', { name: 'Sign Up' });
      fireEvent.click(signUpButton);

      await waitFor(() => {
        const emailInput = screen.getByLabelText('Email Address');
        const passwordInput = screen.getByLabelText('Password');
        const submitButton = screen.getByRole('button', { name: 'Create Account' });

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Should still redirect even if profile creation fails
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Hydration and State Management', () => {
    it('should handle hydration properly for authenticated users', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      const mockProfile = { role: 'user' };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile })
          })
        })
      });

      render(<HomePage />);

      // Should show loading state initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Should show user controls after hydration
      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });
    });

    it('should handle hydration properly for unauthenticated users', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      render(<HomePage />);

      // Should show loading state initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Should show login button after hydration
      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
        expect(screen.queryByText('Logout')).not.toBeInTheDocument();
      });
    });
  });
});
