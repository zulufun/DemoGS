import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiClient } from '../lib/api'
import type { UserProfile, UserRole } from '../types'

interface User {
  id: string
  username: string
  email: string
  role: UserRole
}

interface ValidateTokenResponse {
  user_id: string
  username: string
  email: string
  role: UserRole
}

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  profileLoading: boolean
  isAdmin: boolean
  token: string | null
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: (userId?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  // Check if token exists in localStorage and validate it
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('access_token')
      
      if (storedToken) {
        try {
          apiClient.setToken(storedToken)
          const response = await apiClient.get('/api/auth/validate-token')
          
          if (response.ok && response.data) {
            const userData = response.data as ValidateTokenResponse
            setUser({
              id: userData.user_id,
              username: userData.username,
              email: userData.email,
              role: userData.role,
            })
            setToken(storedToken)
            setProfile({
              id: userData.user_id,
              username: userData.username,
              role: userData.role,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          } else {
            // Token is invalid, clear it
            localStorage.removeItem('access_token')
            apiClient.clearToken()
            setUser(null)
            setToken(null)
            setProfile(null)
          }
        } catch (error) {
          console.error('Auth validation failed:', error)
          localStorage.removeItem('access_token')
          apiClient.clearToken()
          setUser(null)
          setToken(null)
          setProfile(null)
        }
      }
      
      setLoading(false)
    }

    checkAuth()
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    setProfileLoading(true)

    try {
      const response = await apiClient.get('/api/auth/validate-token')
      
      if (response.ok && response.data) {
        const userData = response.data as ValidateTokenResponse
        setProfile({
          id: userData.user_id,
          username: userData.username,
          role: userData.role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      } else {
        setProfile(null)
      }
    } catch (error) {
      console.error('Cannot load profile', error)
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }, [user])

  const signIn = async (username: string, password: string) => {
    try {
      const response = await apiClient.post<{
        access_token: string
        token_type: string
        user_id: string
        username: string
        role: UserRole
      }>('/api/auth/login', { username, password })

      if (!response.ok || !response.data) {
        throw new Error(response.error || 'Login failed')
      }

      const { access_token, user_id, username: user_username, role } = response.data
      
      apiClient.setToken(access_token)
      setToken(access_token)
      
      const newUser: User = {
        id: user_id,
        username: user_username,
        email: username, // Backend doesn't return email on login, use username
        role,
      }
      
      setUser(newUser)
      setProfile({
        id: user_id,
        username: user_username,
        role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    } catch (error) {
      apiClient.clearToken()
      setToken(null)
      setUser(null)
      setProfile(null)
      throw error instanceof Error ? error : new Error('Login failed')
    }
  }

  const signOut = async () => {
    try {
      apiClient.clearToken()
      setToken(null)
      setUser(null)
      setProfile(null)
      setLoading(false)
    } catch (error) {
      console.error('Sign out error:', error)
      throw error instanceof Error ? error : new Error('Sign out failed')
    }
  }

  const isAdmin = useMemo(() => {
    return profile?.role === 'admin'
  }, [profile?.role])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      profileLoading,
      isAdmin,
      token,
      signIn,
      signOut,
      refreshProfile,
    }),
    [user, profile, loading, profileLoading, isAdmin, token, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
