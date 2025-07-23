import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export interface User {
  id: string
  email: string
  username?: string
  full_name?: string
  name?: string
  first_name?: string
  last_name?: string
  avatar?: string
  roles?: string[]
  subscriptionTier?: 'free' | 'pro' | 'enterprise'
  createdAt: string
}

interface UserState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  accessToken: string | null
  refreshToken: string | null
  
  // Actions
  setUser: (user: User | null) => void
  setToken: (accessToken: string, refreshToken?: string) => void
  login: (user: User) => void
  logout: () => void
  updateUser: (updates: Partial<User>) => void
  setLoading: (isLoading: boolean) => void
  clearAuth: () => void
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        accessToken: null,
        refreshToken: null,
        
        setUser: (user) => 
          set({ 
            user, 
            isAuthenticated: !!user 
          }),
          
        setToken: (accessToken, refreshToken) => {
          // Save to localStorage for persistence
          localStorage.setItem('access_token', accessToken)
          if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken)
          }
          
          set({
            accessToken,
            refreshToken: refreshToken || null,
            isAuthenticated: true
          })
        },
          
        login: (user) => 
          set({ 
            user, 
            isAuthenticated: true,
            isLoading: false
          }),
          
        logout: () => {
          // Clear from localStorage
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          
          set({ 
            user: null, 
            isAuthenticated: false,
            accessToken: null,
            refreshToken: null
          })
        },
          
        updateUser: (updates) =>
          set((state) => ({
            user: state.user ? { ...state.user, ...updates } : null,
          })),
          
        setLoading: (isLoading) => set({ isLoading }),
        
        clearAuth: () => {
          // Clear from localStorage
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          
          set({
            user: null,
            isAuthenticated: false,
            accessToken: null,
            refreshToken: null
          })
        },
      }),
      {
        name: 'user-store',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    )
  )
)