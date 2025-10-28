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

describe('Auth System Integration Tests', () => {
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

  describe('Complete User Registration Flow', () => {
    it('completes full signup flow with profile creation', async () => {
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
        // Fill out the form
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
        // Verify signup was called
        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });

        // Verify profile was created
        expect(mockProfilesTable.upsert).toHaveBeenCalledWith({
          id: 'user123',
          preferred_name: 'John Doe',
          email: 'test@example.com'
        });
      });
    });

    it('handles signup without preferred name', async () => {
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
        // Fill out the form without preferred name
        const emailInput = screen.getByLabelText('Email Address');
        const passwordInput = screen.getByLabelText('Password');
        const submitButton = screen.getByRole('button', { name: 'Create Account' });

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        // Verify signup was called
        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });

        // Verify profile was NOT created (no preferred name)
        expect(mockProfilesTable.upsert).not.toHaveBeenCalled();
      });
    });
  });

  describe('Authentication State Management', () => {
    it('handles user already logged in on page load', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      render(<AuthPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('handles auth state changes', async () => {
      const mockUnsubscribe = jest.fn();
      const mockOnAuthStateChange = jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } }
      });

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockImplementation(mockOnAuthStateChange);

      render(<AuthPage />);

      await waitFor(() => {
        expect(mockOnAuthStateChange).toHaveBeenCalled();
      });

      // Simulate auth state change
      const authCallback = mockOnAuthStateChange.mock.calls[0][0];
      authCallback('SIGNED_IN', { user: { id: 'user123' } });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Form Validation Integration', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });
    });

    it('prevents submission with invalid email format', async () => {
      render(<AuthPage />);

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // Form should not submit with invalid email
      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('prevents submission with weak password', async () => {
      render(<AuthPage />);

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.click(submitButton);

      // Form should not submit with weak password
      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('allows submission with valid credentials', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({ 
        data: { user: { id: 'user123' } }, 
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
      });
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });
    });

    it('displays network errors gracefully', async () => {
      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'));

      render(<AuthPage />);

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('handles profile creation errors gracefully', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      const mockProfilesTable = {
        upsert: jest.fn().mockResolvedValue({ 
          error: { message: 'Profile creation failed' } 
        })
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

      // Should not show error to user (profile error is logged but not displayed)
      await waitFor(() => {
        expect(screen.queryByText('Profile creation failed')).not.toBeInTheDocument();
      });
    });
  });

  describe('UI State Management', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });
    });

    it('maintains form state during mode switching', async () => {
      render(<AuthPage />);

      // Fill out login form
      const emailInput = screen.getByLabelText('Email Address');
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      // Switch to signup
      const signUpButton = screen.getByRole('button', { name: 'Sign Up' });
      fireEvent.click(signUpButton);

      await waitFor(() => {
        // Email should be cleared
        const newEmailInput = screen.getByLabelText('Email Address');
        expect(newEmailInput).toHaveValue('');
      });

      // Switch back to login
      const signInLink = screen.getByText('Already have an account? Sign in');
      fireEvent.click(signInLink);

      await waitFor(() => {
        // Email should still be cleared
        const finalEmailInput = screen.getByLabelText('Email Address');
        expect(finalEmailInput).toHaveValue('');
      });
    });

    it('shows appropriate loading states', async () => {
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
      expect(screen.getByRole('button', { name: 'Signing In...' })).toBeDisabled();
    });
  });
});
