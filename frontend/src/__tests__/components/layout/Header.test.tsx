import React from 'react'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import Header from '@/components/layout/Header'
import { usePathname } from 'next/navigation'

// Mock dependencies
jest.mock('next/navigation')
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

describe('Header', () => {
  beforeEach(() => {
    // Default pathname
    ;(usePathname as jest.Mock).mockReturnValue('/')
  })

  describe('Rendering', () => {
    it('should render logo and brand name', () => {
      render(<Header />)

      const logo = screen.getByText('BetterPrompts')
      expect(logo).toBeInTheDocument()
      expect(logo.closest('a')).toHaveAttribute('href', '/')
    })

    it('should render all navigation items on desktop', () => {
      render(<Header />)

      const navItems = [
        'Home',
        'Enhance',
        'History',
        'Techniques',
        'Documentation',
        'Settings',
        'Dashboard',
      ]

      navItems.forEach(item => {
        // Use getAllByText because items appear in both desktop and mobile nav
        const links = screen.getAllByText(item)
        expect(links.length).toBeGreaterThan(0)
      })
    })

    it('should render mobile menu button on small screens', () => {
      render(<Header />)

      const mobileMenuButton = screen.getByRole('button', { name: 'Open menu' })
      expect(mobileMenuButton).toBeInTheDocument()
      expect(mobileMenuButton).toHaveClass('md:hidden')
    })

    it('should hide desktop navigation on small screens', () => {
      render(<Header />)

      const desktopNav = screen.getByRole('navigation', { name: 'Main navigation' })
      const desktopLinks = desktopNav.querySelector('.hidden.md\\:flex')
      expect(desktopLinks).toBeInTheDocument()
    })
  })

  describe('Active Route Highlighting', () => {
    it('should highlight current route', () => {
      ;(usePathname as jest.Mock).mockReturnValue('/enhance')
      render(<Header />)

      // Get all "Enhance" links (desktop and mobile)
      const enhanceLinks = screen.getAllByText('Enhance')
      
      // Desktop link should have active styles
      const desktopLink = enhanceLinks.find(link => 
        link.classList.contains('text-blue-600')
      )
      expect(desktopLink).toBeInTheDocument()
    })

    it('should not highlight inactive routes', () => {
      ;(usePathname as jest.Mock).mockReturnValue('/enhance')
      render(<Header />)

      // Get all "History" links
      const historyLinks = screen.getAllByText('History')
      
      // Desktop link should have inactive styles
      const desktopLink = historyLinks.find(link => 
        link.classList.contains('text-gray-600')
      )
      expect(desktopLink).toBeInTheDocument()
    })

    it('should add aria-current to active route in mobile menu', async () => {
      ;(usePathname as jest.Mock).mockReturnValue('/history')
      const { user } = render(<Header />)

      // Open mobile menu
      const menuButton = screen.getByRole('button', { name: 'Open menu' })
      await user.click(menuButton)

      // Find mobile History link
      const mobileLinks = screen.getAllByText('History')
      const mobileLink = mobileLinks.find(link => 
        link.getAttribute('aria-current') === 'page'
      )
      expect(mobileLink).toBeInTheDocument()
    })
  })

  describe('Mobile Menu Interaction', () => {
    it('should toggle mobile menu when button is clicked', async () => {
      const { user } = render(<Header />)

      const menuButton = screen.getByRole('button', { name: 'Open menu' })
      
      // Initially closed
      expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()

      // Open menu
      await user.click(menuButton)
      expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()
      expect(menuButton).toHaveAttribute('aria-expanded', 'true')
      expect(menuButton).toHaveAttribute('aria-label', 'Close menu')

      // Close menu
      await user.click(menuButton)
      expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
      expect(menuButton).toHaveAttribute('aria-expanded', 'false')
      expect(menuButton).toHaveAttribute('aria-label', 'Open menu')
    })

    it('should close mobile menu when a link is clicked', async () => {
      const { user } = render(<Header />)

      // Open menu
      const menuButton = screen.getByRole('button', { name: 'Open menu' })
      await user.click(menuButton)

      // Click a link in mobile menu
      const mobileLinks = screen.getAllByText('Enhance')
      const mobileLink = mobileLinks[mobileLinks.length - 1] // Get the mobile version
      await user.click(mobileLink)

      // Menu should close
      expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
    })

    it('should close mobile menu on Escape key', async () => {
      const { user } = render(<Header />)

      // Open menu
      const menuButton = screen.getByRole('button', { name: 'Open menu' })
      await user.click(menuButton)

      expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()

      // Press Escape
      await user.keyboard('{Escape}')

      expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
    })

    it('should close mobile menu on route change', async () => {
      const { user, rerender } = render(<Header />)

      // Open menu
      const menuButton = screen.getByRole('button', { name: 'Open menu' })
      await user.click(menuButton)

      expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()

      // Change route
      ;(usePathname as jest.Mock).mockReturnValue('/enhance')
      rerender(<Header />)

      // Menu should close
      expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for navigation', () => {
      render(<Header />)

      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument()
    })

    it('should have proper ARIA attributes on mobile menu button', async () => {
      const { user } = render(<Header />)

      const menuButton = screen.getByRole('button', { name: 'Open menu' })
      
      expect(menuButton).toHaveAttribute('aria-expanded', 'false')
      expect(menuButton).toHaveAttribute('aria-controls', 'mobile-menu')

      await user.click(menuButton)

      expect(menuButton).toHaveAttribute('aria-expanded', 'true')
      expect(menuButton).toHaveAttribute('aria-label', 'Close menu')
    })

    it('should have keyboard accessible navigation', async () => {
      const { user } = render(<Header />)

      // Tab through desktop navigation
      await user.tab()
      expect(screen.getByText('BetterPrompts').closest('a')).toHaveFocus()

      await user.tab()
      const homeLinks = screen.getAllByText('Home')
      expect(homeLinks[0]).toHaveFocus()

      // Continue tabbing through nav items
      const navOrder = ['Enhance', 'History', 'Techniques', 'Documentation', 'Settings', 'Dashboard']
      for (const item of navOrder) {
        await user.tab()
        const links = screen.getAllByText(item)
        expect(links[0]).toHaveFocus()
      }
    })

    it('should support keyboard navigation in mobile menu', async () => {
      const { user } = render(<Header />)

      // Open mobile menu
      const menuButton = screen.getByRole('button', { name: 'Open menu' })
      await user.click(menuButton)

      // Tab into mobile menu
      await user.tab()
      const mobileHomeLinks = screen.getAllByText('Home')
      const mobileHomeLink = mobileHomeLinks[mobileHomeLinks.length - 1]
      expect(mobileHomeLink).toHaveFocus()
    })
  })

  describe('Visual States', () => {
    it('should apply hover styles to navigation links', () => {
      render(<Header />)

      const links = screen.getAllByText('Enhance')
      const desktopLink = links[0]
      expect(desktopLink).toHaveClass('hover:text-blue-600')
    })

    it('should apply focus-visible styles to interactive elements', () => {
      render(<Header />)

      const dashboardLinks = screen.getAllByText('Dashboard')
      const dashboardButton = dashboardLinks[0]
      expect(dashboardButton).toHaveClass(
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-blue-600'
      )

      const menuButton = screen.getByRole('button', { name: 'Open menu' })
      expect(menuButton).toHaveClass(
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-blue-600'
      )
    })

    it('should have sticky positioning', () => {
      render(<Header />)

      const header = screen.getByRole('banner')
      expect(header).toHaveClass('sticky', 'top-0', 'z-50')
    })

    it('should have backdrop blur effect', () => {
      render(<Header />)

      const header = screen.getByRole('banner')
      expect(header).toHaveClass('bg-white/80', 'backdrop-blur-sm')
    })
  })

  describe('Responsive Design', () => {
    it('should show correct menu icon based on state', async () => {
      const { user } = render(<Header />)

      const menuButton = screen.getByRole('button', { name: 'Open menu' })
      
      // Initially shows Menu icon
      expect(menuButton.querySelector('svg')).toBeInTheDocument()

      // Click to open
      await user.click(menuButton)
      
      // Should show X icon
      const closeButton = screen.getByRole('button', { name: 'Close menu' })
      expect(closeButton.querySelector('svg')).toBeInTheDocument()
    })

    it('should render Dashboard as button on desktop and mobile', () => {
      render(<Header />)

      const dashboardLinks = screen.getAllByText('Dashboard')
      
      // Desktop version
      expect(dashboardLinks[0]).toHaveClass(
        'bg-blue-600',
        'text-white',
        'hover:bg-blue-700'
      )

      // Both should be styled as buttons
      dashboardLinks.forEach(link => {
        expect(link).toHaveClass('rounded-lg')
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined pathname gracefully', () => {
      ;(usePathname as jest.Mock).mockReturnValue(undefined)
      
      expect(() => render(<Header />)).not.toThrow()
    })

    it('should handle rapid menu toggle clicks', async () => {
      const { user } = render(<Header />)

      const menuButton = screen.getByRole('button', { name: 'Open menu' })
      
      // Rapidly click multiple times
      await user.click(menuButton)
      await user.click(menuButton)
      await user.click(menuButton)

      // Should end up open after odd number of clicks
      expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()
    })

    it('should not interfere with page scroll when sticky', () => {
      render(<Header />)

      const header = screen.getByRole('banner')
      expect(header).toHaveClass('sticky')
      expect(header).not.toHaveStyle({ position: 'fixed' })
    })
  })
})