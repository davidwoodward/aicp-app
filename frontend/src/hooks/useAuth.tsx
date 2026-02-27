import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { auth, setAuthToken, type AuthUser } from '../api'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  loginWithCredential: (credential: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  loginWithCredential: async () => {},
  logout: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

// GSI type declarations
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
          }) => void
          renderButton: (element: HTMLElement, config: {
            theme?: string
            size?: string
            type?: string
            shape?: string
            text?: string
            width?: number
          }) => void
          prompt: () => void
          revoke: (email: string, callback: () => void) => void
        }
      }
    }
  }
}

const TOKEN_KEY = 'aicp:auth-token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const loginErrorRef = useRef<string | null>(null)

  // Validate stored token on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) {
      setLoading(false)
      return
    }

    setAuthToken(stored)
    auth.me()
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        setAuthToken(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const loginWithCredential = useCallback(async (credential: string) => {
    setAuthToken(credential)
    loginErrorRef.current = null

    try {
      const u = await auth.login(credential)
      localStorage.setItem(TOKEN_KEY, credential)
      setUser(u)
    } catch (err) {
      setAuthToken(null)
      localStorage.removeItem(TOKEN_KEY)
      loginErrorRef.current = err instanceof Error ? err.message : 'Login failed'
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    if (user?.email && window.google) {
      window.google.accounts.id.revoke(user.email, () => {})
    }
    localStorage.removeItem(TOKEN_KEY)
    setAuthToken(null)
    setUser(null)
  }, [user?.email])

  return (
    <AuthContext.Provider value={{ user, loading, loginWithCredential, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
