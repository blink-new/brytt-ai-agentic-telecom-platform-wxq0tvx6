import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Volume2, VolumeX, Settings, Zap, Brain, MessageSquare } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { blink } from '../blink/client'

interface VoiceOption {
  id: string
  text: string
  action: string
  confidence: number
  agent: 'OnboardBot' | 'FollowUpAgent' | 'OpsLogger'
  priority: 'high' | 'medium' | 'low'
}

interface VoiceContext {
  transcript: string
  language: 'ja' | 'en'
  intent: string
  entities: string[]
  confidence: number
}

export default function ContinuousVoiceInterface() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([])
  const [context, setContext] = useState<VoiceContext | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [keigoMode, setKeigoMode] = useState(true)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [language, setLanguage] = useState<'ja' | 'en' | 'auto'>('auto')

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTranscriptRef = useRef('')

  // Text-to-speech function
  const speakResponse = useCallback((text: string, lang: 'ja' | 'en') => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang === 'ja' ? 'ja-JP' : 'en-US'
      utterance.rate = 1.1
      utterance.pitch = 1.0
      
      // Select appropriate voice
      const voices = speechSynthesis.getVoices()
      const preferredVoice = voices.find(voice => 
        lang === 'ja' ? voice.lang.includes('ja') : voice.lang.includes('en')
      )
      if (preferredVoice) {
        utterance.voice = preferredVoice
      }
      
      speechSynthesis.speak(utterance)
    }
  }, [])

  // Process voice input and generate intelligent options
  const processVoiceInput = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return

    setIsProcessing(true)

    try {
      // Analyze context and intent using AI
      const { object: analysis } = await blink.ai.generateObject({
        prompt: `Analyze this voice input for a telecom agent platform:
        
        Input: "${text}"
        
        Determine:
        1. Language (ja/en)
        2. Intent (customer_registration, contract_generation, follow_up, field_logging, etc.)
        3. Entities (customer names, phone numbers, contract types, etc.)
        4. Confidence level (0-1)
        5. Suggested actions for OnboardBot, FollowUpAgent, and OpsLogger agents
        
        Consider Japanese keigo context and telecom industry terminology.`,
        schema: {
          type: 'object',
          properties: {
            language: { type: 'string', enum: ['ja', 'en'] },
            intent: { type: 'string' },
            entities: { type: 'array', items: { type: 'string' } },
            confidence: { type: 'number' },
            suggestedActions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  text: { type: 'string' },
                  action: { type: 'string' },
                  agent: { type: 'string', enum: ['OnboardBot', 'FollowUpAgent', 'OpsLogger'] },
                  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                  confidence: { type: 'number' }
                }
              }
            }
          }
        }
      })

      // Update context
      setContext({
        transcript: text,
        language: analysis.language as 'ja' | 'en',
        intent: analysis.intent,
        entities: analysis.entities,
        confidence: analysis.confidence
      })

      // Set voice options
      setVoiceOptions(analysis.suggestedActions.map((action: any) => ({
        id: action.id,
        text: action.text,
        action: action.action,
        confidence: action.confidence,
        agent: action.agent,
        priority: action.priority
      })))

      // Auto-speak response if enabled
      if (autoSpeak && analysis.suggestedActions.length > 0) {
        const topAction = analysis.suggestedActions[0]
        const responseText = analysis.language === 'ja' 
          ? (keigoMode 
              ? `承知いたしました。${topAction.text}を実行いたします。`
              : `わかった。${topAction.text}をやるね。`)
          : `Understood. I'll ${topAction.action}.`
        
        speakResponse(responseText, analysis.language)
      }

    } catch (error) {
      console.error('Error processing voice input:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, keigoMode, autoSpeak, speakResponse])

  // Initialize continuous speech recognition
  const initializeSpeechRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language === 'auto' ? 'ja-JP' : language === 'ja' ? 'ja-JP' : 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      const currentTranscript = finalTranscript || interimTranscript
      setTranscript(currentTranscript)

      // Process speech in real-time if there's new content
      if (currentTranscript.trim() && currentTranscript !== lastTranscriptRef.current) {
        lastTranscriptRef.current = currentTranscript
        
        // Debounce processing to avoid too many API calls
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current)
        }
        
        processingTimeoutRef.current = setTimeout(() => {
          processVoiceInput(currentTranscript)
        }, 500) // 500ms debounce for real-time feel
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access and refresh.')
      }
    }

    recognition.onend = () => {
      if (isListening) {
        // Restart recognition to maintain continuous listening
        setTimeout(() => {
          try {
            recognition.start()
          } catch (error) {
            console.error('Error restarting recognition:', error)
          }
        }, 100)
      }
    }

    recognitionRef.current = recognition
  }, [language, isListening, processVoiceInput])

  // Initialize audio visualization
  const initializeAudioVisualization = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      const microphone = audioContext.createMediaStreamSource(stream)

      analyser.fftSize = 256
      microphone.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser

      // Start audio level monitoring
      const updateAudioLevel = () => {
        if (analyserRef.current && isListening) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteFrequencyData(dataArray)
          
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
          setAudioLevel(average / 255)
          
          requestAnimationFrame(updateAudioLevel)
        }
      }
      updateAudioLevel()
    } catch (error) {
      console.error('Error accessing microphone:', error)
    }
  }, [isListening])

  // Execute selected option
  const executeOption = useCallback(async (option: VoiceOption) => {
    try {
      // Create task in database
      const user = await blink.auth.me()
      await blink.db.tasks.create({
        userId: user.id,
        agentType: option.agent,
        taskName: option.text,
        status: 'processing',
        input: transcript,
        createdAt: new Date().toISOString()
      })

      // Provide feedback
      const feedbackText = context?.language === 'ja'
        ? (keigoMode 
            ? `${option.text}を開始いたします。`
            : `${option.text}を始めるよ。`)
        : `Starting ${option.action}...`
      
      if (autoSpeak) {
        speakResponse(feedbackText, context?.language || 'en')
      }

      // Clear options after execution
      setTimeout(() => {
        setVoiceOptions([])
        setTranscript('')
        lastTranscriptRef.current = ''
      }, 2000)

    } catch (error) {
      console.error('Error executing option:', error)
    }
  }, [transcript, context, keigoMode, autoSpeak, speakResponse])

  // Toggle continuous listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
      setIsListening(false)
      setAudioLevel(0)
    } else {
      initializeAudioVisualization()
      recognitionRef.current?.start()
    }
  }, [isListening, initializeAudioVisualization])

  // Initialize on mount
  useEffect(() => {
    initializeSpeechRecognition()
    return () => {
      recognitionRef.current?.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
      }
    }
  }, [initializeSpeechRecognition])

  return (
    <div className="space-y-6">
      {/* Voice Control Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-full ${isListening ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Continuous Voice Interface
                </h3>
                <p className="text-sm text-gray-600">
                  {isListening ? 'Listening continuously...' : 'Click to start voice interaction'}
                </p>
              </div>
            </div>
            
            <Button
              onClick={toggleListening}
              variant={isListening ? "destructive" : "default"}
              size="lg"
              className="px-8"
            >
              {isListening ? 'Stop Listening' : 'Start Listening'}
            </Button>
          </div>

          {/* Audio Visualization */}
          {isListening && (
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-sm text-gray-600">Audio Level:</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-100"
                  style={{ width: `${audioLevel * 100}%` }}
                />
              </div>
              <span className="text-sm text-gray-600">{Math.round(audioLevel * 100)}%</span>
            </div>
          )}

          {/* Settings */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={keigoMode}
                  onCheckedChange={setKeigoMode}
                />
                <span>Keigo Mode</span>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={autoSpeak}
                  onCheckedChange={setAutoSpeak}
                />
                <span>Auto Speak</span>
              </div>
            </div>
            
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value as 'ja' | 'en' | 'auto')}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="auto">Auto Detect</option>
              <option value="ja">Japanese</option>
              <option value="en">English</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Transcript */}
      {transcript && (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <MessageSquare className="w-5 h-5 text-blue-600 mt-1" />
              <div className="flex-1">
                <p className="text-gray-900 font-medium">{transcript}</p>
                {context && (
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {context.language.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {context.intent}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(context.confidence * 100)}% confidence
                    </Badge>
                  </div>
                )}
              </div>
              {isProcessing && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <Brain className="w-4 h-4 animate-pulse" />
                  <span className="text-sm">Analyzing...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Intelligent Options */}
      {voiceOptions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <span>Available Actions</span>
          </h4>
          
          {voiceOptions.map((option) => (
            <Card 
              key={option.id} 
              className={`cursor-pointer transition-all duration-200 hover:shadow-md border-l-4 ${
                option.priority === 'high' ? 'border-l-red-500 bg-red-50' :
                option.priority === 'medium' ? 'border-l-yellow-500 bg-yellow-50' :
                'border-l-green-500 bg-green-50'
              }`}
              onClick={() => executeOption(option)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {option.agent}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          option.priority === 'high' ? 'text-red-600 border-red-300' :
                          option.priority === 'medium' ? 'text-yellow-600 border-yellow-300' :
                          'text-green-600 border-green-300'
                        }`}
                      >
                        {option.priority} priority
                      </Badge>
                    </div>
                    <p className="text-gray-900 font-medium">{option.text}</p>
                    <p className="text-sm text-gray-600 mt-1">{option.action}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {Math.round(option.confidence * 100)}%
                    </div>
                    <div className="text-xs text-gray-500">confidence</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Context Information */}
      {context && (
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <h5 className="font-medium text-gray-900 mb-2">Context Analysis</h5>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Intent:</span>
                <span className="ml-2 font-medium">{context.intent}</span>
              </div>
              <div>
                <span className="text-gray-600">Language:</span>
                <span className="ml-2 font-medium">{context.language.toUpperCase()}</span>
              </div>
              {context.entities.length > 0 && (
                <div className="col-span-2">
                  <span className="text-gray-600">Entities:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {context.entities.map((entity, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {entity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}