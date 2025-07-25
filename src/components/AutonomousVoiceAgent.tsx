import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Volume2, VolumeX, Settings, Brain, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { blink } from '../blink/client'

interface ConversationTurn {
  id: string
  type: 'user' | 'agent'
  content: string
  timestamp: Date
  language: 'ja' | 'en'
  reasoning?: string
  actions?: string[]
  confidence?: number
}

interface TaskContext {
  id: string
  type: 'onboarding' | 'followup' | 'logging'
  status: 'active' | 'completed' | 'failed'
  steps: string[]
  currentStep: number
  customerInfo?: any
  progress: number
}

interface AutonomousVoiceAgentProps {
  onTaskComplete?: (task: TaskContext) => void
}

export default function AutonomousVoiceAgent({ onTaskComplete }: AutonomousVoiceAgentProps) {
  const [isActive, setIsActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [keigoMode, setKeigoMode] = useState(true)
  const [language, setLanguage] = useState<'ja' | 'en'>('ja')
  const [audioLevel, setAudioLevel] = useState(0)
  
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [currentTask, setCurrentTask] = useState<TaskContext | null>(null)
  const [transcript, setTranscript] = useState('')
  const [agentThinking, setAgentThinking] = useState('')

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const conversationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Utility functions first
  const detectLanguage = (text: string): 'ja' | 'en' => {
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/
    return japaneseRegex.test(text) ? 'ja' : 'en'
  }

  const determineTaskType = (input: string): 'onboarding' | 'followup' | 'logging' | null => {
    const lowerInput = input.toLowerCase()
    if (lowerInput.includes('契約') || lowerInput.includes('登録') || lowerInput.includes('onboard') || lowerInput.includes('register')) {
      return 'onboarding'
    }
    if (lowerInput.includes('フォロー') || lowerInput.includes('follow') || lowerInput.includes('メール') || lowerInput.includes('email')) {
      return 'followup'
    }
    if (lowerInput.includes('ログ') || lowerInput.includes('記録') || lowerInput.includes('log') || lowerInput.includes('visit')) {
      return 'logging'
    }
    return null
  }

  const getTaskSteps = (taskType: 'onboarding' | 'followup' | 'logging', lang: 'ja' | 'en'): string[] => {
    const steps = {
      onboarding: {
        ja: ['顧客情報収集', 'ID確認', 'プラン選択', '契約書生成', 'メール送信'],
        en: ['Customer Info Collection', 'ID Verification', 'Plan Selection', 'Contract Generation', 'Email Sending']
      },
      followup: {
        ja: ['顧客状況確認', 'フォローアップ内容作成', 'メール/SMS送信', '結果記録'],
        en: ['Customer Status Check', 'Follow-up Content Creation', 'Email/SMS Sending', 'Result Recording']
      },
      logging: {
        ja: ['訪問情報記録', '作業内容入力', 'フォーム送信', '完了確認'],
        en: ['Visit Info Recording', 'Work Content Input', 'Form Submission', 'Completion Confirmation']
      }
    }
    return steps[taskType][lang]
  }

  // Speak response with proper voice selection
  const speakResponse = useCallback(async (text: string, lang: 'ja' | 'en') => {
    if (!text.trim()) return

    setIsSpeaking(true)

    try {
      // Try Web Speech API first
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = lang === 'ja' ? 'ja-JP' : 'en-US'
        utterance.rate = 0.9
        utterance.pitch = 1.0
        utterance.volume = 1.0

        // Get appropriate voice
        const voices = speechSynthesis.getVoices()
        const preferredVoice = voices.find(voice => 
          voice.lang.startsWith(lang === 'ja' ? 'ja' : 'en')
        )
        if (preferredVoice) {
          utterance.voice = preferredVoice
        }

        utterance.onend = () => {
          setIsSpeaking(false)
        }

        utterance.onerror = () => {
          setIsSpeaking(false)
        }

        speechSynthesis.speak(utterance)
      } else {
        // Fallback to AI speech synthesis
        const { url } = await blink.ai.generateSpeech({
          text,
          voice: lang === 'ja' ? 'nova' : 'alloy'
        })

        const audio = new Audio(url)
        audio.onended = () => setIsSpeaking(false)
        audio.onerror = () => setIsSpeaking(false)
        await audio.play()
      }
    } catch (error) {
      console.error('Error speaking response:', error)
      setIsSpeaking(false)
    }
  }, [])

  // Update task context based on conversation
  const updateTaskContext = useCallback(async (input: string, response: string, lang: 'ja' | 'en') => {
    try {
      // Determine task type from input
      const taskType = determineTaskType(input)
      
      if (taskType && !currentTask) {
        // Create new task
        const newTask: TaskContext = {
          id: Date.now().toString(),
          type: taskType,
          status: 'active',
          steps: getTaskSteps(taskType, lang),
          currentStep: 0,
          progress: 0
        }
        setCurrentTask(newTask)

        // Save to database
        await blink.db.tasks.create({
          id: newTask.id,
          taskType: newTask.type,
          status: newTask.status,
          currentStep: newTask.currentStep,
          totalSteps: newTask.steps.length,
          progress: newTask.progress,
          language: lang,
          keigoMode,
          createdAt: new Date(),
          userId: (await blink.auth.me()).id
        })
      } else if (currentTask) {
        // Update existing task
        const updatedTask = { ...currentTask }
        updatedTask.currentStep = Math.min(updatedTask.currentStep + 1, updatedTask.steps.length - 1)
        updatedTask.progress = (updatedTask.currentStep / updatedTask.steps.length) * 100

        if (updatedTask.currentStep >= updatedTask.steps.length - 1) {
          updatedTask.status = 'completed'
          if (onTaskComplete) {
            onTaskComplete(updatedTask)
          }
        }

        setCurrentTask(updatedTask)

        // Update in database
        await blink.db.tasks.update(updatedTask.id, {
          currentStep: updatedTask.currentStep,
          progress: updatedTask.progress,
          status: updatedTask.status,
          updatedAt: new Date()
        })
      }
    } catch (error) {
      console.error('Error updating task context:', error)
    }
  }, [currentTask, keigoMode, onTaskComplete])

  // Continue task flow automatically
  const continueTaskFlow = useCallback(async () => {
    if (!currentTask || currentTask.status !== 'active') return

    const nextStepPrompt = currentTask.type === 'onboarding' 
      ? (language === 'ja' ? '次のステップに進みましょう。他に必要な情報はありますか？' : 'Let\'s proceed to the next step. Is there any other information needed?')
      : currentTask.type === 'followup'
      ? (language === 'ja' ? 'フォローアップを続けます。他にご質問はありますか？' : 'Continuing follow-up. Do you have any other questions?')
      : (language === 'ja' ? '作業ログを続けます。他に記録することはありますか？' : 'Continuing work log. Anything else to record?')

    await speakResponse(nextStepPrompt, language)
  }, [currentTask, language, speakResponse])

  // Handle user input and process with AI
  const handleUserInput = useCallback(async (input: string) => {
    if (isProcessing || isSpeaking) return

    setIsProcessing(true)
    setTranscript('')

    // Clear any existing processing timeout
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current)
    }

    // Add user turn to conversation
    const userTurn: ConversationTurn = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
      language: detectLanguage(input)
    }

    setConversation(prev => [...prev, userTurn])

    try {
      // Show agent thinking
      setAgentThinking('分析中... / Analyzing...')

      // Process with AI for context understanding and reasoning
      const contextPrompt = `
You are BRYTT AI, a multilingual agentic platform for telecom operations in Japan.

Current conversation context:
${conversation.map(turn => `${turn.type}: ${turn.content}`).join('\n')}

Current task: ${currentTask ? `${currentTask.type} (Step ${currentTask.currentStep}/${currentTask.steps.length})` : 'None'}

User input: "${input}"
Language: ${userTurn.language}
Keigo mode: ${keigoMode ? 'Formal' : 'Casual'}

Analyze this input and provide:
1. Intent and entities
2. Required actions
3. Next steps in the conversation
4. Response in ${userTurn.language === 'ja' ? (keigoMode ? 'formal Japanese (keigo)' : 'casual Japanese') : 'English'}

Focus on telecom operations: customer onboarding, contract generation, follow-ups, field logging.
Be conversational and outcome-focused. Continue the task flow smoothly.
Keep responses concise and actionable.
`

      const { text: aiResponse } = await blink.ai.generateText({
        prompt: contextPrompt,
        maxTokens: 300
      })

      setAgentThinking('')

      // Parse AI response for actions and reasoning
      const agentTurn: ConversationTurn = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: aiResponse,
        timestamp: new Date(),
        language: userTurn.language,
        reasoning: 'AI analysis and task progression',
        confidence: 0.9
      }

      setConversation(prev => [...prev, agentTurn])

      // Determine if we need to create or update a task
      await updateTaskContext(input, aiResponse, userTurn.language)

      // Speak the response automatically
      await speakResponse(aiResponse, userTurn.language)

      // Set timeout for next interaction if task is not complete
      if (currentTask && currentTask.status === 'active') {
        conversationTimeoutRef.current = setTimeout(() => {
          if (isActive && !isSpeaking) {
            // Continue conversation flow
            continueTaskFlow()
          }
        }, 3000)
      }

    } catch (error) {
      console.error('Error processing input:', error)
      const errorMessage = userTurn.language === 'ja' 
        ? 'すみません、処理中にエラーが発生しました。もう一度お試しください。'
        : 'Sorry, there was an error processing your request. Please try again.'
      
      await speakResponse(errorMessage, userTurn.language)
    } finally {
      setIsProcessing(false)
    }
  }, [conversation, currentTask, keigoMode, isProcessing, isSpeaking, isActive, updateTaskContext, speakResponse, continueTaskFlow])

  // Initialize audio visualization
  const initializeAudioVisualization = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      const microphone = audioContext.createMediaStreamSource(stream)

      analyser.fftSize = 256
      microphone.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser
      microphoneRef.current = microphone

      // Start audio level monitoring
      const updateAudioLevel = () => {
        if (analyserRef.current && isActive) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          setAudioLevel(average / 255)
          requestAnimationFrame(updateAudioLevel)
        }
      }
      updateAudioLevel()
    } catch (error) {
      console.error('Error accessing microphone:', error)
    }
  }, [isActive])

  // Initialize speech recognition
  const initializeSpeechRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language === 'ja' ? 'ja-JP' : 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      setTranscript(interimTranscript || finalTranscript)

      if (finalTranscript.trim()) {
        handleUserInput(finalTranscript.trim())
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'no-speech' && isActive) {
        // Restart recognition automatically
        setTimeout(() => {
          if (isActive && !isSpeaking) {
            recognition.start()
          }
        }, 1000)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      if (isActive && !isSpeaking && !isProcessing) {
        // Restart recognition automatically
        setTimeout(() => {
          if (isActive) {
            recognition.start()
          }
        }, 500)
      }
    }

    recognitionRef.current = recognition
  }, [language, isActive, isSpeaking, isProcessing, handleUserInput])

  // Start/stop autonomous agent
  const toggleAgent = useCallback(async () => {
    if (!isActive) {
      setIsActive(true)
      await initializeAudioVisualization()
      initializeSpeechRecognition()
      
      // Welcome message
      const welcomeMessage = language === 'ja' 
        ? 'BRYTT AIエージェントが起動しました。お話しください。'
        : 'BRYTT AI Agent is now active. Please speak.'
      
      setTimeout(() => {
        speakResponse(welcomeMessage, language)
      }, 1000)
    } else {
      setIsActive(false)
      setIsListening(false)
      setIsSpeaking(false)
      setIsProcessing(false)
      
      // Stop all audio processing
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
      }
      if (conversationTimeoutRef.current) {
        clearTimeout(conversationTimeoutRef.current)
      }
    }
  }, [isActive, language, initializeAudioVisualization, initializeSpeechRecognition, speakResponse])

  // Initialize speech synthesis voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        speechSynthesis.getVoices()
      }
      speechSynthesis.onvoiceschanged = loadVoices
      loadVoices()
    }
  }, [])

  // Update recognition language when language changes
  useEffect(() => {
    if (recognitionRef.current && isActive) {
      recognitionRef.current.stop()
      setTimeout(() => {
        initializeSpeechRecognition()
        if (isActive && !isSpeaking) {
          recognitionRef.current?.start()
        }
      }, 500)
    }
  }, [language, initializeSpeechRecognition, isActive, isSpeaking])

  return (
    <div className="space-y-6">
      {/* Main Control Panel */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              BRYTT AI Autonomous Agent
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">敬語</span>
                <Switch
                  checked={keigoMode}
                  onCheckedChange={setKeigoMode}
                />
              </div>
              <Button
                variant={language === 'ja' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLanguage('ja')}
              >
                日本語
              </Button>
              <Button
                variant={language === 'en' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLanguage('en')}
              >
                English
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Agent Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="font-medium">
                  {isActive ? (language === 'ja' ? 'アクティブ' : 'Active') : (language === 'ja' ? '待機中' : 'Standby')}
                </span>
              </div>
              <Button
                onClick={toggleAgent}
                variant={isActive ? 'destructive' : 'default'}
                className="min-w-[120px]"
              >
                {isActive ? (
                  <>
                    <MicOff className="h-4 w-4 mr-2" />
                    {language === 'ja' ? '停止' : 'Stop'}
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    {language === 'ja' ? '開始' : 'Start'}
                  </>
                )}
              </Button>
            </div>

            {/* Audio Visualization */}
            {isActive && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-primary" />
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-100"
                      style={{ width: `${audioLevel * 100}%` }}
                    />
                  </div>
                </div>
                
                {/* Status Indicators */}
                <div className="flex gap-2">
                  <Badge variant={isListening ? 'default' : 'secondary'}>
                    {isListening ? (language === 'ja' ? '聞いています' : 'Listening') : (language === 'ja' ? '待機' : 'Waiting')}
                  </Badge>
                  <Badge variant={isSpeaking ? 'default' : 'secondary'}>
                    {isSpeaking ? (language === 'ja' ? '話しています' : 'Speaking') : (language === 'ja' ? '無音' : 'Silent')}
                  </Badge>
                  <Badge variant={isProcessing ? 'default' : 'secondary'}>
                    {isProcessing ? (language === 'ja' ? '処理中' : 'Processing') : (language === 'ja' ? '待機' : 'Ready')}
                  </Badge>
                </div>
              </div>
            )}

            {/* Live Transcript */}
            {transcript && (
              <div className="p-3 bg-blue-50 rounded-lg border">
                <div className="text-sm text-blue-600 mb-1">
                  {language === 'ja' ? '音声認識中...' : 'Recognizing speech...'}
                </div>
                <div className="font-medium">{transcript}</div>
              </div>
            )}

            {/* Agent Thinking */}
            {agentThinking && (
              <div className="p-3 bg-amber-50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-amber-600 animate-pulse" />
                  <span className="text-amber-700">{agentThinking}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Task */}
      {currentTask && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              {language === 'ja' ? '現在のタスク' : 'Current Task'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{currentTask.type}</span>
                <Badge variant={currentTask.status === 'completed' ? 'default' : 'secondary'}>
                  {currentTask.status}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{language === 'ja' ? 'ステップ' : 'Step'} {currentTask.currentStep + 1}/{currentTask.steps.length}</span>
                  <span>{Math.round(currentTask.progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${currentTask.progress}%` }}
                  />
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <strong>{language === 'ja' ? '現在のステップ:' : 'Current Step:'}</strong> {currentTask.steps[currentTask.currentStep]}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversation History */}
      {conversation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ja' ? '会話履歴' : 'Conversation History'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {conversation.slice(-6).map((turn) => (
                <div
                  key={turn.id}
                  className={`p-3 rounded-lg ${
                    turn.type === 'user' 
                      ? 'bg-blue-50 border-l-4 border-blue-500' 
                      : 'bg-green-50 border-l-4 border-green-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">
                      {turn.type === 'user' ? (language === 'ja' ? 'ユーザー' : 'User') : 'BRYTT AI'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {turn.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm">{turn.content}</div>
                  {turn.confidence && (
                    <div className="mt-1">
                      <Badge variant="outline" className="text-xs">
                        {Math.round(turn.confidence * 100)}% confidence
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}