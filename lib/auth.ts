import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export type UserRole = 'user' | 'moderator' | 'admin'

export interface UserProfile {
  user_id: string
  email: string
  full_name: string | null
  preferred_name: string | null
  religion: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface AuthUser {
  id: string
  email: string
  profile: UserProfile | null
}

/**
 * Create Supabase client for server-side operations
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}

/**
 * Create Supabase client for client-side operations
 */
export function createSupabaseClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          if (typeof window === 'undefined') return undefined
          const value = `; ${document.cookie}`
          const parts = value.split(`; ${name}=`)
          if (parts.length === 2) return parts.pop()?.split(';').shift()
        },
        set(name: string, value: string, options: any) {
          if (typeof window === 'undefined') return
          document.cookie = `${name}=${value}; ${Object.entries(options)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ')}`
        },
        remove(name: string, options: any) {
          if (typeof window === 'undefined') return
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${Object.entries(options)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ')}`
        },
      },
    }
  )
}

/**
 * Get current authenticated user with profile
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return null
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return {
        id: user.id,
        email: user.email || '',
        profile: null
      }
    }

    return {
      id: user.id,
      email: user.email || '',
      profile
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Check if user has required role
 */
export function hasRole(user: AuthUser | null, requiredRole: UserRole): boolean {
  if (!user?.profile) return false
  
  const roleHierarchy: Record<UserRole, number> = {
    user: 1,
    moderator: 2,
    admin: 3
  }
  
  return roleHierarchy[user.profile.role] >= roleHierarchy[requiredRole]
}

/**
 * Create user profile after signup
 */
export async function createUserProfile(userId: string, email: string, preferredName: string): Promise<UserProfile | null> {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        email,
        preferred_name: preferredName,
        role: 'user'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating profile:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error creating profile:', error)
    return null
  }
}

/**
 * Create anonymous session for chat functionality
 */
export async function createAnonymousSession(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data, error } = await supabase
      .from('anon_sessions')
      .insert({})
      .select('session_id')
      .single()

    if (error) {
      console.error('Error creating anonymous session:', error)
      return null
    }

    return data.session_id
  } catch (error) {
    console.error('Error creating anonymous session:', error)
    return null
  }
}

/**
 * Check if user is authenticated (optional)
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const user = await getCurrentUser()
    return user !== null
  } catch (error) {
    return false
  }
}

/**
 * Sign out user
 */
export async function signOut() {
  try {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()
  } catch (error) {
    console.error('Error signing out:', error)
  }
}
