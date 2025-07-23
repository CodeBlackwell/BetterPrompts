'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { adminService } from '@/lib/api/services'
import { 
  Users, Activity, Settings, Database, Shield, Zap, 
  RefreshCw, Search, Filter, ChevronRight, MoreVertical,
  UserPlus, Ban, Edit, Trash2, AlertCircle, CheckCircle,
  Server, Cpu, HardDrive, Clock, BarChart3, UserCheck,
  Key, Lock, Mail, Globe, Gauge, Package
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface User {
  id: string
  email: string
  username: string
  full_name?: string
  role: string
  status: 'active' | 'inactive' | 'banned'
  created_at: string
  last_login?: string
  total_prompts?: number
}

interface SystemMetric {
  label: string
  value: string | number
  change?: number
  status: 'healthy' | 'warning' | 'critical'
  icon: React.ReactNode
}

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  
  // User management state
  const [users, setUsers] = useState<User[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showUserDialog, setShowUserDialog] = useState(false)
  
  // System metrics state
  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([])
  const [refreshing, setRefreshing] = useState(false)
  
  // Configuration state
  const [config, setConfig] = useState({
    maintenanceMode: false,
    registrationEnabled: true,
    apiRateLimit: 1000,
    maxPromptLength: 5000,
    cacheEnabled: true,
    debugMode: false,
    emailNotifications: true,
    analyticsEnabled: true
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // In production, fetch real data from API
      // const [usersData, metricsData] = await Promise.all([
      //   adminService.getUsers({ limit: 100 }),
      //   adminService.getSystemMetrics()
      // ])
      
      // Mock data for now
      setUsers(generateMockUsers())
      setSystemMetrics(generateMockMetrics())
      
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err)
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const generateMockUsers = (): User[] => {
    return [
      {
        id: '1',
        email: 'john.doe@example.com',
        username: 'johndoe',
        full_name: 'John Doe',
        role: 'user',
        status: 'active',
        created_at: '2024-01-15T10:00:00Z',
        last_login: '2024-03-20T15:30:00Z',
        total_prompts: 342
      },
      {
        id: '2',
        email: 'jane.smith@example.com',
        username: 'janesmith',
        full_name: 'Jane Smith',
        role: 'admin',
        status: 'active',
        created_at: '2023-12-01T08:00:00Z',
        last_login: '2024-03-21T09:15:00Z',
        total_prompts: 1024
      },
      {
        id: '3',
        email: 'bob.wilson@example.com',
        username: 'bobwilson',
        full_name: 'Bob Wilson',
        role: 'user',
        status: 'inactive',
        created_at: '2024-02-10T14:00:00Z',
        last_login: '2024-03-01T12:00:00Z',
        total_prompts: 56
      },
      {
        id: '4',
        email: 'alice.johnson@example.com',
        username: 'alicej',
        full_name: 'Alice Johnson',
        role: 'developer',
        status: 'active',
        created_at: '2024-01-20T11:00:00Z',
        last_login: '2024-03-21T14:45:00Z',
        total_prompts: 789
      },
      {
        id: '5',
        email: 'spam.user@malicious.com',
        username: 'spammer123',
        role: 'user',
        status: 'banned',
        created_at: '2024-03-10T16:00:00Z',
        total_prompts: 0
      }
    ]
  }

  const generateMockMetrics = (): SystemMetric[] => {
    return [
      {
        label: 'API Status',
        value: 'Operational',
        status: 'healthy',
        icon: <Server className="h-4 w-4" />
      },
      {
        label: 'CPU Usage',
        value: '42%',
        change: -5,
        status: 'healthy',
        icon: <Cpu className="h-4 w-4" />
      },
      {
        label: 'Memory Usage',
        value: '3.2GB / 8GB',
        status: 'healthy',
        icon: <HardDrive className="h-4 w-4" />
      },
      {
        label: 'Response Time',
        value: '124ms',
        change: -12,
        status: 'healthy',
        icon: <Clock className="h-4 w-4" />
      },
      {
        label: 'Active Users',
        value: '1,234',
        change: 15,
        status: 'healthy',
        icon: <Users className="h-4 w-4" />
      },
      {
        label: 'Error Rate',
        value: '0.12%',
        change: -0.03,
        status: 'healthy',
        icon: <AlertCircle className="h-4 w-4" />
      }
    ]
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDashboardData()
  }

  const handleUserAction = (action: string, user: User) => {
    setSelectedUser(user)
    
    switch (action) {
      case 'edit':
        setShowUserDialog(true)
        break
      case 'ban':
        // Implement ban logic
        console.log('Ban user:', user.id)
        break
      case 'delete':
        // Implement delete logic with confirmation
        if (confirm(`Are you sure you want to delete user ${user.username}?`)) {
          console.log('Delete user:', user.id)
        }
        break
    }
  }

  const handleConfigChange = (key: keyof typeof config, value: boolean | number) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    // In production, save config to backend
    console.log('Config updated:', key, value)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-yellow-100 text-yellow-800'
      case 'banned':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive'
      case 'developer':
        return 'default'
      default:
        return 'secondary'
    }
  }

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(userSearch.toLowerCase())
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage users, monitor system health, and configure settings
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/admin/analytics')}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                </Card>
              ))
            ) : (
              systemMetrics.map((metric, index) => (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
                    <div className="text-muted-foreground">{metric.icon}</div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metric.value}</div>
                    {metric.change !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className={metric.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {metric.change >= 0 ? '+' : ''}{metric.change}%
                        </span>
                        {' from last period'}
                      </p>
                    )}
                    <Badge 
                      variant={metric.status === 'healthy' ? 'secondary' : metric.status === 'warning' ? 'outline' : 'destructive'}
                      className="mt-2"
                    >
                      {metric.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Button variant="outline" className="justify-start">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
                <Button variant="outline" className="justify-start">
                  <Database className="h-4 w-4 mr-2" />
                  Backup Database
                </Button>
                <Button variant="outline" className="justify-start">
                  <Key className="h-4 w-4 mr-2" />
                  API Keys
                </Button>
                <Button variant="outline" className="justify-start">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Announcement
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>View and manage all users</CardDescription>
                </div>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr className="text-left text-sm text-muted-foreground">
                        <th className="pb-2">User</th>
                        <th className="pb-2">Role</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Prompts</th>
                        <th className="pb-2">Last Login</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-muted/50">
                          <td className="py-3">
                            <div>
                              <p className="font-medium">{user.full_name || user.username}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </td>
                          <td className="py-3">
                            <Badge variant={getRoleBadgeVariant(user.role)}>
                              {user.role}
                            </Badge>
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                              {user.status}
                            </span>
                          </td>
                          <td className="py-3">
                            {user.total_prompts || 0}
                          </td>
                          <td className="py-3 text-sm text-muted-foreground">
                            {user.last_login 
                              ? new Date(user.last_login).toLocaleDateString()
                              : 'Never'
                            }
                          </td>
                          <td className="py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleUserAction('edit', user)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleUserAction('ban', user)}
                                  className="text-red-600"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Ban User
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleUserAction('delete', user)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>System Resources</CardTitle>
                <CardDescription>Current resource utilization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">CPU Usage</span>
                    <span className="text-sm font-medium">42%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '42%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Memory</span>
                    <span className="text-sm font-medium">3.2GB / 8GB</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '40%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Storage</span>
                    <span className="text-sm font-medium">45GB / 100GB</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '45%' }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Service Status</CardTitle>
                <CardDescription>Health of various services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm">API Gateway</span>
                  </div>
                  <Badge variant="secondary">Healthy</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm">Database</span>
                  </div>
                  <Badge variant="secondary">Healthy</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm">Cache (Redis)</span>
                  </div>
                  <Badge variant="secondary">Healthy</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm">ML Services</span>
                  </div>
                  <Badge variant="secondary">Healthy</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent System Events</CardTitle>
              <CardDescription>Latest system activities and alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm">Database backup completed successfully</p>
                    <p className="text-xs text-muted-foreground">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm">High API usage detected from IP 192.168.1.100</p>
                    <p className="text-xs text-muted-foreground">4 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm">SSL certificate renewed</p>
                    <p className="text-xs text-muted-foreground">1 day ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure system-wide settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="maintenance">Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Disable access for non-admin users
                  </p>
                </div>
                <Switch
                  id="maintenance"
                  checked={config.maintenanceMode}
                  onCheckedChange={(checked) => handleConfigChange('maintenanceMode', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="registration">User Registration</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow new users to create accounts
                  </p>
                </div>
                <Switch
                  id="registration"
                  checked={config.registrationEnabled}
                  onCheckedChange={(checked) => handleConfigChange('registrationEnabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="cache">Caching</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable Redis caching for better performance
                  </p>
                </div>
                <Switch
                  id="cache"
                  checked={config.cacheEnabled}
                  onCheckedChange={(checked) => handleConfigChange('cacheEnabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="debug">Debug Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable detailed logging and error messages
                  </p>
                </div>
                <Switch
                  id="debug"
                  checked={config.debugMode}
                  onCheckedChange={(checked) => handleConfigChange('debugMode', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>Configure API rate limits and constraints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rateLimit">API Rate Limit (requests/hour)</Label>
                <Input
                  id="rateLimit"
                  type="number"
                  value={config.apiRateLimit}
                  onChange={(e) => handleConfigChange('apiRateLimit', parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promptLength">Max Prompt Length (characters)</Label>
                <Input
                  id="promptLength"
                  type="number"
                  value={config.maxPromptLength}
                  onChange={(e) => handleConfigChange('maxPromptLength', parseInt(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Configure notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="emails">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send system alerts via email
                  </p>
                </div>
                <Switch
                  id="emails"
                  checked={config.emailNotifications}
                  onCheckedChange={(checked) => handleConfigChange('emailNotifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="analytics">Analytics Tracking</Label>
                  <p className="text-sm text-muted-foreground">
                    Collect anonymous usage statistics
                  </p>
                </div>
                <Switch
                  id="analytics"
                  checked={config.analyticsEnabled}
                  onCheckedChange={(checked) => handleConfigChange('analyticsEnabled', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Edit Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" value={selectedUser.email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-username">Username</Label>
                <Input id="edit-username" value={selectedUser.username} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-fullname">Full Name</Label>
                <Input id="edit-fullname" value={selectedUser.full_name || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <select
                  id="edit-role"
                  value={selectedUser.role}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="user">User</option>
                  <option value="developer">Developer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowUserDialog(false)}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}