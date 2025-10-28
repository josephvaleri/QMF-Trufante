import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import AuthPage from '@/app/auth/page';
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
    return React.createElement('img', props);
  };
});

describe('AuthPage Component - Core Functionality', () => {
  const mockPush = jest.fn();
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    (supaBrowser as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('Basic Rendering', () => {
    it('renders login form by default', () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      render(<AuthPage />);
      
      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });

    it('shows logo above the form', () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      render(<AuthPage />);
      
      const logo = screen.getByAltText('Question My Faith');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', '/qmf-logo.png');
    });

    it('shows back link in top left', () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      render(<AuthPage />);
      
      const backLink = screen.getByText('← Back');
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/');
    });
  });

  describe('Form Toggle', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });
    });

    it('toggles between login and signup forms', async () => {
      render(<AuthPage />);
      
      // Initially shows login form
      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();

      // Click sign up button
      const signUpButton = screen.getByRole('button', { name: 'Sign Up' });
      fireEvent.click(signUpButton);

      await waitFor(() => {
        expect(screen.getByText('Join Question My Faith')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
        expect(screen.getByLabelText('What would you like to be called?')).toBeInTheDocument();
      });
    });
  });

  describe('Authentication Flow', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });
    });

    it('handles successful login and redirects to home page', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({ 
        data: { user: { id: '123' } }, 
        error: null 
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
        // Verify redirect to home page
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('handles login error', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({ 
        data: { user: null }, 
        error: { message: 'Invalid credentials' } 
      });

      render(<AuthPage />);
      
      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });
    });

    it('handles successful signup with profile creation and redirects to home page', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      const mockProfilesTable = {
        upsert: jest.fn().mockResolvedValue({ error: null })
      };

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
        fireEvent.change(preferredNameInput, { target: { value: 'John' } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
        expect(mockProfilesTable.upsert).toHaveBeenCalledWith({
          user_id: 'user123',
          preferred_name: 'John',
          email: 'test@example.com'
        });
        // Verify redirect to home page
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('User State Management', () => {
    it('redirects logged in users to home page', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      render(<AuthPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });
    });

    it('shows password requirements text', () => {
      render(<AuthPage />);
      
      expect(screen.getByText('Password must be at least 8 characters with letters and numbers')).toBeInTheDocument();
    });

    it('shows signup encouragement text', () => {
      render(<AuthPage />);
      
      expect(screen.getByText("Don't Have an account?")).toBeInTheDocument();
      expect(screen.getByText('Creating an account ensures the history of your chats is maintained and the faith agent can provide better advice tailored to your needs')).toBeInTheDocument();
    });
  });
});
