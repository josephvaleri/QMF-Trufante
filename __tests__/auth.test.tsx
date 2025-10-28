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

describe('AuthPage Component', () => {
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

  describe('Rendering', () => {
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

    it('renders signup form when toggled', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      render(<AuthPage />);
      
      // Click sign up button
      const signUpButton = screen.getByRole('button', { name: 'Sign Up' });
      fireEvent.click(signUpButton);

      await waitFor(() => {
        expect(screen.getByText('Join Question My Faith')).toBeInTheDocument();
        expect(screen.getByLabelText('What would you like to be called?')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
      });
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

  describe('Form Validation', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });
    });

    it('validates email field is required', async () => {
      render(<AuthPage />);
      
      const submitButton = screen.getByRole('button', { name: 'Sign In' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue('')).toBeInTheDocument();
      });
    });

    it('validates password requirements', async () => {
      render(<AuthPage />);
      
      const passwordInput = screen.getByLabelText('Password');
      fireEvent.change(passwordInput, { target: { value: '123' } });
      
      const submitButton = screen.getByRole('button', { name: 'Sign In' });
      fireEvent.click(submitButton);

      // The form should not submit with invalid password
      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('shows password requirements text', () => {
      render(<AuthPage />);
      
      expect(screen.getByText('Password must be at least 8 characters with letters and numbers')).toBeInTheDocument();
    });

    it('validates preferred name field in signup mode', async () => {
      render(<AuthPage />);
      
      // Switch to signup mode
      const signUpButton = screen.getByRole('button', { name: 'Sign Up' });
      fireEvent.click(signUpButton);

      await waitFor(() => {
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

    it('handles successful login', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: '123' } }, error: null });

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

    it('handles successful signup', async () => {
      const mockUser = { id: '123' };
      mockSupabase.auth.signUp.mockResolvedValue({ data: { user: mockUser }, error: null });
      
      // Mock profiles table
      const mockProfilesTable = {
        upsert: jest.fn().mockResolvedValue({ error: null })
      };
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
          id: '123',
          preferred_name: 'John',
          email: 'test@example.com'
        });
        expect(screen.getByText('Check your email for the confirmation link!')).toBeInTheDocument();
      });
    });

    it('handles signup error', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({ 
        data: { user: null }, 
        error: { message: 'Email already exists' } 
      });

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

      await waitFor(() => {
        expect(screen.getByText('Email already exists')).toBeInTheDocument();
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

    it('shows loading state during authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });
      mockSupabase.auth.signInWithPassword.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: { user: null }, error: null }), 100))
      );

      render(<AuthPage />);
      
      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // Should show loading state
      expect(screen.getByText('Signing In...')).toBeInTheDocument();
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

      // Click back to sign in
      const signInLink = screen.getByText('Already have an account? Sign in');
      fireEvent.click(signInLink);

      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
      });
    });

    it('clears form fields when toggling', async () => {
      render(<AuthPage />);
      
      const emailInput = screen.getByLabelText('Email Address');
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      // Switch to signup and back
      const signUpButton = screen.getByRole('button', { name: 'Sign Up' });
      fireEvent.click(signUpButton);

      await waitFor(() => {
        const signInLink = screen.getByText('Already have an account? Sign in');
        fireEvent.click(signInLink);
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('')).toBeInTheDocument();
      });
    });
  });

  describe('UI Elements', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });
    });

    it('disables submit button when loading', async () => {
      mockSupabase.auth.signInWithPassword.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: { user: null }, error: null }), 100))
      );

      render(<AuthPage />);
      
      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // Button should be disabled during loading
      expect(screen.getByRole('button', { name: 'Signing In...' })).toBeDisabled();
    });

    it('shows signup encouragement text', () => {
      render(<AuthPage />);
      
      expect(screen.getByText("Don't Have an account?")).toBeInTheDocument();
      expect(screen.getByText('Creating an account ensures the history of your chats is maintained and the faith agent can provide better advice tailored to your needs')).toBeInTheDocument();
    });

    it('has proper form styling and layout', () => {
      render(<AuthPage />);
      
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
      
      const inputs = screen.getAllByRole('textbox');
      inputs.forEach(input => {
        expect(input).toHaveClass('w-full', 'px-4', 'py-3', 'border', 'border-gray-300', 'rounded-2xl');
      });
    });
  });
});
