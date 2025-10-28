import { createClient } from '@supabase/supabase-js'
import type { UserRole, UserProfile, AuthUser } from './auth'

/**
 * Create Supabase client for client-side operations
 */
export function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Get current authenticated user with profile (client-side)
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const supabase = createSupabaseClient()
    
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
 * Sign out user (client-side)
 */
export async function signOut() {
  try {
    const supabase = createSupabaseClient()
    await supabase.auth.signOut()
  } catch (error) {
    console.error('Error signing out:', error)
  }
}

/**
 * Sign in user (client-side)
 */
export async function signIn(email: string, password: string) {
  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error signing in:', error)
    throw error
  }
}

/**
 * Sign up user (client-side)
 */
export async function signUp(email: string, password: string, preferredName: string) {
  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          preferred_name: preferredName
        }
      }
    })
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error signing up:', error)
    throw error
  }
}
