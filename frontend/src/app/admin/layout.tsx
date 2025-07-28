'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useUserStore } from '@/store/useUserStore'
import { Button } from '@/components/ui/button'
// Temporarily removed dropdown menu due to missing dependency
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from '@/components/ui/dropdown-menu'
import { 
  LayoutDashboard, BarChart3, Users, Settings, 
  ChevronRight, User, LogOut, Shield
} from 'lucide-react'

interface AdminLayoutProps {
  children: ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useUserStore()

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const navItems = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
      testId: 'admin-nav-dashboard'
    },
    {
      name: 'Analytics',
      href: '/admin/analytics',
      icon: BarChart3,
      testId: 'admin-nav-analytics'
    },
    {
      name: 'Users',
      href: '/admin/users',
      icon: Users,
      testId: 'admin-nav-users'
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: Settings,
      testId: 'admin-nav-settings'
    }
  ]

  const isActive = (href: string) => {
    if (href === '/admin' && pathname === '/admin') return true
    if (href !== '/admin' && pathname.startsWith(href)) return true
    return false
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          {/* Logo/Title */}
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Admin Panel</span>
          </div>

          {/* Navigation */}
          <nav className="mx-6 flex items-center space-x-4 lg:space-x-6" data-testid="admin-nav">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-testid={item.testId}
                className={`text-sm font-medium transition-colors hover:text-primary flex items-center gap-1 ${
                  isActive(item.href)
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* User Menu */}
          <div className="ml-auto flex items-center gap-4">
            {/* Simplified user menu without dropdown */}
            <Button 
              variant="ghost" 
              size="sm" 
              data-testid="user-menu"
              onClick={handleLogout}
              className="text-red-600"
            >
              <User className="h-4 w-4 mr-2" />
              {user?.email || 'Admin'}
              <LogOut className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}