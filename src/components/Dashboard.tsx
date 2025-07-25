import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { Separator } from './ui/separator'
import { 
  Mic, 
  MicOff, 
  Globe, 
  Users, 
  FileText, 
  Mail, 
  Settings,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Zap
} from 'lucide-react'
import AutonomousVoiceAgent from './AutonomousVoiceAgent'
import AgentCards from './AgentCards'
import TaskLogs from './TaskLogs'
import CustomerContext from './CustomerContext'
import { blink } from '../blink/client'

interface User {
  id: string
  email: string
  displayName?: string
}

interface DashboardProps {
  user: User
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [keigoMode, setKeigoMode] = useState<'formal' | 'casual'>('formal')
  const [language, setLanguage] = useState<'ja' | 'en'>('ja')
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [tasks, setTasks] = useState([])
  const [customers, setCustomers] = useState([])

  const loadTasks = useCallback(async () => {
    try {
      const taskData = await blink.db.tasks.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 10
      })
      setTasks(taskData)
    } catch (error) {
      console.error('Failed to load tasks:', error)
    }
  }, [user.id])

  const loadCustomers = useCallback(async () => {
    try {
      const customerData = await blink.db.customers.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 5
      })
      setCustomers(customerData)
    } catch (error) {
      console.error('Failed to load customers:', error)
    }
  }, [user.id])

  useEffect(() => {
    loadTasks()
    loadCustomers()
  }, [loadTasks, loadCustomers])

  const handleSignOut = () => {
    blink.auth.logout()
  }

  const getGreeting = () => {
    if (language === 'ja') {
      return keigoMode === 'formal' 
        ? 'いらっしゃいませ。BRYTT AIプラットフォームへようこそ。'
        : 'こんにちは！BRYTT AIプラットフォームへようこそ。'
    }
    return 'Welcome to the BRYTT AI Platform'
  }

  const getStatusCounts = () => {
    const pending = tasks.filter(task => task.status === 'pending').length
    const processing = tasks.filter(task => task.status === 'processing').length
    const completed = tasks.filter(task => task.status === 'completed').length
    return { pending, processing, completed }
  }

  const statusCounts = getStatusCounts()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">BRYTT AI</h1>
                <p className="text-xs text-muted-foreground">Agentic Platform</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-4">
              {/* Language Toggle */}
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Button
                  variant={language === 'ja' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLanguage('ja')}
                  className="text-xs"
                >
                  日本語
                </Button>
                <Button
                  variant={language === 'en' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLanguage('en')}
                  className="text-xs"
                >
                  EN
                </Button>
              </div>

              <Separator orientation="vertical" className="h-6" />

              {/* Keigo Mode Toggle */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">敬語</span>
                <Switch
                  checked={keigoMode === 'formal'}
                  onCheckedChange={(checked) => setKeigoMode(checked ? 'formal' : 'casual')}
                />
                <Badge variant={keigoMode === 'formal' ? 'default' : 'secondary'} className="text-xs">
                  {keigoMode === 'formal' ? 'Formal' : 'Casual'}
                </Badge>
              </div>

              <Separator orientation="vertical" className="h-6" />

              {/* User Menu */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">{user.email}</span>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className={`text-2xl font-bold mb-2 ${language === 'ja' ? 'japanese' : ''}`}>
            {getGreeting()}
          </h2>
          <p className="text-muted-foreground">
            {language === 'ja' 
              ? 'エージェント実行メッシュで業務を効率化しましょう。'
              : 'Streamline your operations with our agent execution mesh.'
            }
          </p>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{statusCounts.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{statusCounts.processing}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statusCounts.completed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customers.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Voice Interface & Agents */}
          <div className="lg:col-span-2 space-y-8">
            {/* Autonomous Voice Agent */}
            <AutonomousVoiceAgent
              onTaskComplete={(task) => {
                console.log('Task completed:', task)
                // Refresh task logs
                loadTasks()
              }}
            />

            {/* Agent Cards */}
            <AgentCards
              language={language}
              keigoMode={keigoMode}
              onTaskCreated={loadTasks}
            />

            {/* Task Logs */}
            <TaskLogs
              tasks={tasks}
              language={language}
              onTaskUpdate={loadTasks}
            />
          </div>

          {/* Right Column - Customer Context */}
          <div className="space-y-8">
            <CustomerContext
              customers={customers}
              language={language}
              keigoMode={keigoMode}
              onCustomerUpdate={loadCustomers}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard