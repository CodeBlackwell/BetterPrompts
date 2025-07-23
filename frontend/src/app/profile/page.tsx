'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/hooks/use-auth'
import { useUserStore } from '@/store/useUserStore'
import { authService, handleApiError } from '@/lib/api/services'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/hooks/use-toast'
import { 
  User, 
  Mail, 
  Lock, 
  Save, 
  Camera,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react'

interface ProfileFormData {
  first_name: string
  last_name: string
  email: string
  username: string
}

interface PasswordFormData {
  current_password: string
  new_password: string
  confirm_password: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { updateUser } = useUserStore()
  
  // Profile form state
  const [profileData, setProfileData] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    email: '',
    username: ''
  })
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  
  // Password form state
  const [passwordData, setPasswordData] = useState<PasswordFormData>({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // Password strength
  const [passwordStrength, setPasswordStrength] = useState(0)
  
  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setProfileData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        username: user.username || ''
      })
    }
  }, [user])
  
  // Calculate password strength
  useEffect(() => {
    const password = passwordData.new_password
    let strength = 0
    
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[^a-zA-Z0-9]/.test(password)) strength++
    
    setPasswordStrength(strength)
  }, [passwordData.new_password])
  
  const getPasswordStrengthLabel = () => {
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']
    return labels[passwordStrength] || labels[0]
  }
  
  const getPasswordStrengthColor = () => {
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-700']
    return colors[passwordStrength] || colors[0]
  }
  
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError('')
    setIsProfileLoading(true)
    
    try {
      // Prepare update data
      const updateData = {
        name: `${profileData.first_name} ${profileData.last_name}`.trim(),
        email: profileData.email
      }
      
      // Call API to update profile
      await authService.updateProfile(updateData)
      
      // Update local user state
      updateUser({
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        email: profileData.email,
        username: profileData.username,
        full_name: updateData.name
      })
      
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      })
    } catch (error) {
      setProfileError(handleApiError(error))
    } finally {
      setIsProfileLoading(false)
    }
  }
  
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    
    // Validate passwords match
    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError('New passwords do not match')
      return
    }
    
    // Validate password strength
    if (passwordStrength < 3) {
      setPasswordError('Password is too weak. Please choose a stronger password.')
      return
    }
    
    setIsPasswordLoading(true)
    
    try {
      await authService.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      })
      
      // Clear form
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
      
      toast({
        title: 'Password changed',
        description: 'Your password has been successfully changed.',
      })
    } catch (error) {
      setPasswordError(handleApiError(error))
    } finally {
      setIsPasswordLoading(false)
    }
  }
  
  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return
    }
    
    try {
      // In a real app, you'd call an API to delete the account
      toast({
        title: 'Account deletion requested',
        description: 'Your account deletion request has been submitted. You will receive an email confirmation.',
        variant: 'destructive'
      })
      
      // Log user out after deletion request
      setTimeout(() => {
        logout()
      }, 2000)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process account deletion request',
        variant: 'destructive'
      })
    }
  }
  
  const getUserInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase()
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase()
    }
    return 'U'
  }

  return (
    <ProtectedRoute>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[200px,1fr]">
          {/* Profile Picture Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="w-32 h-32">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="text-2xl">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <Button variant="outline" size="sm" className="w-full">
                  <Camera className="mr-2 h-4 w-4" />
                  Change Photo
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Main Settings */}
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Update your personal information and email address
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileSubmit} className="space-y-4">
                    {profileError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{profileError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="first_name">First Name</Label>
                        <Input
                          id="first_name"
                          value={profileData.first_name}
                          onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                          placeholder="John"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">Last Name</Label>
                        <Input
                          id="last_name"
                          value={profileData.last_name}
                          onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                          placeholder="Doe"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={profileData.username}
                        onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                        disabled
                        className="opacity-60"
                      />
                      <p className="text-xs text-muted-foreground">
                        Username cannot be changed
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                        placeholder="john.doe@example.com"
                        required
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isProfileLoading}>
                        {isProfileLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>
                    Update your password to keep your account secure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    {passwordError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{passwordError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="current_password">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="current_password"
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={passwordData.current_password}
                          onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new_password">New Password</Label>
                      <div className="relative">
                        <Input
                          id="new_password"
                          type={showNewPassword ? 'text' : 'password'}
                          value={passwordData.new_password}
                          onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {passwordData.new_password && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Password strength:</span>
                            <span className={`font-medium ${
                              passwordStrength >= 3 ? 'text-green-600' : 'text-orange-600'
                            }`}>
                              {getPasswordStrengthLabel()}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                              <div
                                key={i}
                                className={`h-2 flex-1 rounded-full ${
                                  i < passwordStrength
                                    ? getPasswordStrengthColor()
                                    : 'bg-muted'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm_password">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm_password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={passwordData.confirm_password}
                          onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {passwordData.confirm_password && passwordData.new_password !== passwordData.confirm_password && (
                        <p className="text-sm text-destructive">Passwords do not match</p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        disabled={isPasswordLoading || passwordStrength < 3}
                      >
                        {isPasswordLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Changing...
                          </>
                        ) : (
                          <>
                            <Lock className="mr-2 h-4 w-4" />
                            Change Password
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Two-Factor Authentication</CardTitle>
                  <CardDescription>
                    Add an extra layer of security to your account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Status</p>
                      <p className="text-sm text-muted-foreground">
                        Two-factor authentication is currently disabled
                      </p>
                    </div>
                    <Button variant="outline">Enable 2FA</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="account">
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>
                    View your account details and subscription status
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Account ID</p>
                    <p className="text-sm text-muted-foreground font-mono">{user?.id}</p>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Member Since</p>
                    <p className="text-sm text-muted-foreground">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Subscription Plan</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">
                        {user?.subscriptionTier || 'Free'} Plan
                      </p>
                      {user?.subscriptionTier !== 'pro' && user?.subscriptionTier !== 'enterprise' && (
                        <Button variant="outline" size="sm">
                          Upgrade
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-6 border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                  <CardDescription>
                    Irreversible actions for your account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Delete Account</p>
                        <p className="text-sm text-muted-foreground">
                          Permanently delete your account and all data
                        </p>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={handleDeleteAccount}
                      >
                        Delete Account
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  )
}