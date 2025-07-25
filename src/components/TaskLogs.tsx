import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Eye,
  Trash2,
  Filter,
  Search
} from 'lucide-react'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

interface Task {
  id: string
  agentType: string
  taskName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  lastAction: string
  language: string
  keigoMode: string
  createdAt: string
  updatedAt: string
}

interface TaskLogsProps {
  tasks: Task[]
  language: 'ja' | 'en'
  onTaskUpdate: () => void
}

const TaskLogs: React.FC<TaskLogsProps> = ({ tasks, language, onTaskUpdate }) => {
  const [filter, setFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const getJapaneseStatus = (status: string) => {
    switch (status) {
      case 'pending': return '待機中'
      case 'processing': return '処理中'
      case 'completed': return '完了'
      case 'failed': return '失敗'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'secondary',
      processing: 'default',
      completed: 'default',
      failed: 'destructive'
    } as const

    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    }

    return (
      <Badge 
        variant={variants[status as keyof typeof variants] || 'secondary'}
        className={`${colors[status as keyof typeof colors]} text-xs`}
      >
        {language === 'ja' ? getJapaneseStatus(status) : status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const getAgentName = (agentType: string) => {
    const names = {
      onboard: language === 'ja' ? 'オンボードボット' : 'OnboardBot',
      followup: language === 'ja' ? 'フォローアップエージェント' : 'FollowUpAgent',
      ops: language === 'ja' ? 'オペレーションロガー' : 'OpsLogger',
      voice_command: language === 'ja' ? '音声コマンド' : 'Voice Command'
    }
    return names[agentType as keyof typeof names] || agentType
  }

  const filteredTasks = tasks.filter(task => {
    const matchesFilter = filter === 'all' || task.status === filter
    const matchesSearch = task.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.lastAction.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (language === 'ja') {
      if (diffMins < 1) return 'たった今'
      if (diffMins < 60) return `${diffMins}分前`
      if (diffHours < 24) return `${diffHours}時間前`
      return `${diffDays}日前`
    } else {
      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      return `${diffDays}d ago`
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className={`flex items-center ${language === 'ja' ? 'japanese' : ''}`}>
              <Activity className="h-5 w-5 mr-2 text-primary" />
              {language === 'ja' ? 'タスクログ' : 'Task Logs'}
            </CardTitle>
            <CardDescription className={language === 'ja' ? 'japanese' : ''}>
              {language === 'ja' 
                ? 'エージェント実行履歴とステータス'
                : 'Agent execution history and status'
              }
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onTaskUpdate}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {language === 'ja' ? '更新' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'ja' ? 'タスクを検索...' : 'Search tasks...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {language === 'ja' ? 'すべて' : 'All Status'}
              </SelectItem>
              <SelectItem value="pending">
                {language === 'ja' ? '待機中' : 'Pending'}
              </SelectItem>
              <SelectItem value="processing">
                {language === 'ja' ? '処理中' : 'Processing'}
              </SelectItem>
              <SelectItem value="completed">
                {language === 'ja' ? '完了' : 'Completed'}
              </SelectItem>
              <SelectItem value="failed">
                {language === 'ja' ? '失敗' : 'Failed'}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Task List */}
        <ScrollArea className="h-[400px] w-full">
          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className={language === 'ja' ? 'japanese' : ''}>
                  {language === 'ja' ? 'タスクが見つかりません' : 'No tasks found'}
                </p>
              </div>
            ) : (
              filteredTasks.map((task, index) => (
                <div key={task.id}>
                  <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    {/* Status Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(task.status)}
                    </div>

                    {/* Task Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className={`font-medium text-sm truncate ${language === 'ja' ? 'japanese' : ''}`}>
                          {task.taskName}
                        </h4>
                        <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                          {getStatusBadge(task.status)}
                          <span className="text-xs text-muted-foreground">
                            {getTimeAgo(task.updatedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span className={language === 'ja' ? 'japanese' : ''}>
                          {getAgentName(task.agentType)}
                        </span>
                        <span>
                          {formatTime(task.createdAt)}
                        </span>
                      </div>

                      <p className={`text-sm text-muted-foreground truncate ${language === 'ja' ? 'japanese' : ''}`}>
                        {task.lastAction}
                      </p>

                      {/* Language & Keigo Mode */}
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {task.language === 'ja' ? '日本語' : 'English'}
                        </Badge>
                        {task.language === 'ja' && (
                          <Badge variant="outline" className="text-xs">
                            {task.keigoMode === 'formal' ? '敬語' : 'カジュアル'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {index < filteredTasks.length - 1 && <Separator />}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Summary */}
        {tasks.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
            <span className={language === 'ja' ? 'japanese' : ''}>
              {language === 'ja' 
                ? `${filteredTasks.length}件のタスク（全${tasks.length}件中）`
                : `${filteredTasks.length} of ${tasks.length} tasks`
              }
            </span>
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                {tasks.filter(t => t.status === 'completed').length} 
                {language === 'ja' ? '完了' : 'completed'}
              </span>
              <span className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                {tasks.filter(t => t.status === 'processing').length}
                {language === 'ja' ? '処理中' : 'processing'}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default TaskLogs