import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { 
  UserCheck, 
  Mail, 
  Wrench, 
  Play, 
  Pause, 
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  Send,
  MapPin
} from 'lucide-react'
import { blink } from '../blink/client'

interface AgentCardsProps {
  language: 'ja' | 'en'
  keigoMode: 'formal' | 'casual'
  onTaskCreated: () => void
}

const AgentCards: React.FC<AgentCardsProps> = ({ language, keigoMode, onTaskCreated }) => {
  const [activeAgent, setActiveAgent] = useState<string | null>(null)
  const [agentProgress, setAgentProgress] = useState<Record<string, number>>({})

  const agents = [
    {
      id: 'onboard',
      name: language === 'ja' ? 'オンボードボット' : 'OnboardBot',
      description: language === 'ja' 
        ? 'ID確認、プラン選択、契約書生成'
        : 'ID verification, plan selection, contract generation',
      icon: UserCheck,
      color: 'bg-blue-500',
      tasks: [
        language === 'ja' ? '顧客情報登録' : 'Customer Registration',
        language === 'ja' ? 'ID確認' : 'ID Verification', 
        language === 'ja' ? 'プラン選択' : 'Plan Selection',
        language === 'ja' ? 'SIM契約書生成' : 'SIM Contract Generation'
      ]
    },
    {
      id: 'followup',
      name: language === 'ja' ? 'フォローアップエージェント' : 'FollowUpAgent',
      description: language === 'ja'
        ? '敬語メール・SMS送信、顧客フォローアップ'
        : 'Keigo email/SMS sending, customer follow-up',
      icon: Mail,
      color: 'bg-green-500',
      tasks: [
        language === 'ja' ? '契約確認メール' : 'Contract Confirmation Email',
        language === 'ja' ? 'フォローアップSMS' : 'Follow-up SMS',
        language === 'ja' ? '敬語テンプレート' : 'Keigo Templates',
        language === 'ja' ? '配信スケジュール' : 'Delivery Scheduling'
      ]
    },
    {
      id: 'ops',
      name: language === 'ja' ? 'オペレーションロガー' : 'OpsLogger',
      description: language === 'ja'
        ? '技術者訪問ログ、音声入力、フォーム記入'
        : 'Technician visit logs, voice input, form filling',
      icon: Wrench,
      color: 'bg-orange-500',
      tasks: [
        language === 'ja' ? '訪問ログ記録' : 'Visit Log Recording',
        language === 'ja' ? '音声メモ' : 'Voice Notes',
        language === 'ja' ? '作業報告書' : 'Work Reports',
        language === 'ja' ? '位置情報記録' : 'Location Tracking'
      ]
    }
  ]

  const executeAgent = async (agentId: string) => {
    setActiveAgent(agentId)
    setAgentProgress(prev => ({ ...prev, [agentId]: 0 }))
    
    try {
      const user = await blink.auth.me()
      const agent = agents.find(a => a.id === agentId)
      
      // Create task
      const taskId = `task_${agentId}_${Date.now()}`
      await blink.db.tasks.create({
        id: taskId,
        userId: user.id,
        agentType: agentId,
        taskName: `${agent?.name} Execution`,
        status: 'processing',
        lastAction: 'Agent started',
        inputData: JSON.stringify({ agentId, language, keigoMode }),
        language,
        keigoMode
      })

      // Simulate agent execution with progress
      for (let i = 0; i <= 100; i += 10) {
        setAgentProgress(prev => ({ ...prev, [agentId]: i }))
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Update task progress
        if (i === 50) {
          await blink.db.tasks.update(taskId, {
            lastAction: `${agent?.name} processing...`
          })
        }
      }

      // Complete task
      await blink.db.tasks.update(taskId, {
        status: 'completed',
        lastAction: `${agent?.name} completed successfully`,
        outputData: JSON.stringify({ 
          result: 'success',
          completedTasks: agent?.tasks || []
        })
      })

      onTaskCreated()
      
    } catch (error) {
      console.error('Agent execution error:', error)
    } finally {
      setActiveAgent(null)
      setAgentProgress(prev => ({ ...prev, [agentId]: 0 }))
    }
  }

  const getStatusIcon = (agentId: string) => {
    if (activeAgent === agentId) {
      return <Clock className="h-4 w-4 text-primary animate-spin" />
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />
  }

  const getActionButton = (agentId: string) => {
    const isActive = activeAgent === agentId
    const progress = agentProgress[agentId] || 0
    
    return (
      <div className="space-y-2">
        {isActive && (
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {progress}% {language === 'ja' ? '完了' : 'Complete'}
            </p>
          </div>
        )}
        <Button
          onClick={() => executeAgent(agentId)}
          disabled={isActive}
          className="w-full"
          variant={isActive ? 'secondary' : 'default'}
        >
          {isActive ? (
            <>
              <Pause className="h-4 w-4 mr-2" />
              {language === 'ja' ? '実行中...' : 'Running...'}
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              {language === 'ja' ? '実行' : 'Execute'}
            </>
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${language === 'ja' ? 'japanese' : ''}`}>
          {language === 'ja' ? 'エージェントモジュール' : 'Agent Modules'}
        </h3>
        <Badge variant="outline" className="text-xs">
          {language === 'ja' ? '実行メッシュ' : 'Execution Mesh'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {agents.map((agent) => {
          const IconComponent = agent.icon
          const isActive = activeAgent === agent.id
          
          return (
            <Card 
              key={agent.id} 
              className={`transition-all duration-300 hover:shadow-lg ${
                isActive ? 'agent-processing' : 'hover:border-primary/40'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${agent.color} bg-opacity-10`}>
                    <IconComponent className={`h-5 w-5 text-white`} style={{ color: agent.color.replace('bg-', '').replace('-500', '') }} />
                  </div>
                  {getStatusIcon(agent.id)}
                </div>
                <CardTitle className={`text-base ${language === 'ja' ? 'japanese' : ''}`}>
                  {agent.name}
                </CardTitle>
                <CardDescription className={`text-sm ${language === 'ja' ? 'japanese' : ''}`}>
                  {agent.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Task List */}
                <div className="space-y-2">
                  <h4 className={`text-sm font-medium ${language === 'ja' ? 'japanese' : ''}`}>
                    {language === 'ja' ? 'タスク:' : 'Tasks:'}
                  </h4>
                  <ul className="space-y-1">
                    {agent.tasks.map((task, index) => (
                      <li key={index} className="flex items-center text-xs text-muted-foreground">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2 flex-shrink-0" />
                        <span className={language === 'ja' ? 'japanese' : ''}>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                {getActionButton(agent.id)}

                {/* Quick Actions */}
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <FileText className="h-3 w-3 mr-1" />
                    {language === 'ja' ? 'ログ' : 'Logs'}
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Send className="h-3 w-3 mr-1" />
                    {language === 'ja' ? '設定' : 'Config'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Agent Mesh Status */}
      <Card className="border-accent/20">
        <CardHeader className="pb-3">
          <CardTitle className={`text-base flex items-center ${language === 'ja' ? 'japanese' : ''}`}>
            <MapPin className="h-4 w-4 mr-2 text-accent" />
            {language === 'ja' ? 'エージェントメッシュステータス' : 'Agent Mesh Status'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-500">3</div>
              <div className={`text-xs text-muted-foreground ${language === 'ja' ? 'japanese' : ''}`}>
                {language === 'ja' ? 'アクティブ' : 'Active'}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {activeAgent ? '1' : '0'}
              </div>
              <div className={`text-xs text-muted-foreground ${language === 'ja' ? 'japanese' : ''}`}>
                {language === 'ja' ? '実行中' : 'Running'}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">∞</div>
              <div className={`text-xs text-muted-foreground ${language === 'ja' ? 'japanese' : ''}`}>
                {language === 'ja' ? 'キューイング' : 'Queued'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AgentCards