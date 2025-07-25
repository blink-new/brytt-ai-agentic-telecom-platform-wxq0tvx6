import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Mic, MicOff, Send, Volume2, VolumeX } from 'lucide-react'
import { blink } from '../blink/client'

interface VoiceInterfaceProps {
  language: 'ja' | 'en'
  keigoMode: 'formal' | 'casual'
  isActive: boolean
  onActiveChange: (active: boolean) => void
  onTaskCreated: () => void
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({
  language,
  keigoMode,
  isActive,
  onActiveChange,
  onTaskCreated
}) => {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [response, setResponse] = useState('')
  const [textInput, setTextInput] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    // Initialize Web Speech API if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      
      if (recognitionRef.current) {
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = true
        recognitionRef.current.lang = language === 'ja' ? 'ja-JP' : 'en-US'
        
        recognitionRef.current.onresult = (event) => {
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
          
          setTranscript(finalTranscript + interimTranscript)
        }
        
        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error)
          setIsRecording(false)
          onActiveChange(false)
        }
        
        recognitionRef.current.onend = () => {
          setIsRecording(false)
          onActiveChange(false)
        }
      }
    }
  }, [language, onActiveChange])

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true)
      
      // Convert blob to base64
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          const base64Data = dataUrl.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(audioBlob)
      })
      
      const result = await blink.ai.transcribeAudio({
        audio: base64Audio,
        language: language === 'ja' ? 'ja' : 'en'
      })
      
      setTranscript(result.text)
    } catch (error) {
      console.error('Transcription error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const speakResponse = (text: string) => {
    if (!('speechSynthesis' in window)) return
    
    setIsSpeaking(true)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = language === 'ja' ? 'ja-JP' : 'en-US'
    utterance.rate = 0.9
    utterance.pitch = 1
    
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    
    speechSynthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }

  const startRecording = async () => {
    try {
      if (recognitionRef.current) {
        setTranscript('')
        setIsRecording(true)
        onActiveChange(true)
        recognitionRef.current.start()
      } else {
        // Fallback to MediaRecorder for audio transcription
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRecorderRef.current = new MediaRecorder(stream)
        audioChunksRef.current = []
        
        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data)
        }
        
        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
          await transcribeAudio(audioBlob)
        }
        
        setIsRecording(true)
        onActiveChange(true)
        mediaRecorderRef.current.start()
      }
    } catch (error) {
      console.error('Error starting recording:', error)
    }
  }

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop()
    } else if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop())
    }
    setIsRecording(false)
    onActiveChange(false)
  }

  const processCommand = async (command: string) => {
    if (!command.trim()) return
    
    setIsProcessing(true)
    setResponse('')
    
    try {
      // Create a task for the command
      const taskId = `task_${Date.now()}`
      await blink.db.tasks.create({
        id: taskId,
        userId: (await blink.auth.me()).id,
        agentType: 'voice_command',
        taskName: command.substring(0, 100),
        status: 'processing',
        lastAction: 'Voice command received',
        inputData: JSON.stringify({ command, language, keigoMode }),
        language,
        keigoMode
      })
      
      // Process with AI
      const aiResponse = await blink.ai.generateText({
        prompt: `You are BRYTT AI, a multilingual agentic platform for telecom operations in Japan. 
        
        User command: "${command}"
        Language: ${language}
        Keigo mode: ${keigoMode}
        
        Respond in ${language === 'ja' ? 'Japanese' : 'English'} with ${keigoMode === 'formal' ? 'formal/keigo' : 'casual'} tone.
        
        If this is a telecom-related task (customer registration, SIM contract, email sending, field logging), 
        acknowledge the task and explain what actions would be taken in the execution mesh.
        
        Keep response concise and professional.`,
        maxTokens: 200
      })
      
      setResponse(aiResponse.text)
      
      // Update task status
      await blink.db.tasks.update(taskId, {
        status: 'completed',
        lastAction: 'AI response generated',
        outputData: JSON.stringify({ response: aiResponse.text })
      })
      
      onTaskCreated()
      
      // Speak response if supported
      if ('speechSynthesis' in window && aiResponse.text) {
        speakResponse(aiResponse.text)
      }
      
    } catch (error) {
      console.error('Error processing command:', error)
      setResponse(language === 'ja' 
        ? 'エラーが発生しました。もう一度お試しください。'
        : 'An error occurred. Please try again.'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSubmit = () => {
    const command = transcript || textInput
    if (command.trim()) {
      processCommand(command)
      setTranscript('')
      setTextInput('')
    }
  }

  const getPlaceholder = () => {
    if (language === 'ja') {
      return keigoMode === 'formal' 
        ? 'コマンドを入力してください（例：顧客の情報を登録して、SIM契約書を生成して、メールで送ってください）'
        : 'コマンドを入力してね（例：顧客情報を登録してSIM契約書を作ってメールして）'
    }
    return 'Enter your command (e.g., Register customer info, generate SIM contract, and send via email)'
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Mic className="h-5 w-5 text-primary" />
              <span className={language === 'ja' ? 'japanese' : ''}>
                {language === 'ja' ? '音声インターフェース' : 'Voice Interface'}
              </span>
            </CardTitle>
            <CardDescription className={language === 'ja' ? 'japanese' : ''}>
              {language === 'ja' 
                ? '音声またはテキストでコマンドを入力してください'
                : 'Speak or type your commands'
              }
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={keigoMode === 'formal' ? 'default' : 'secondary'}>
              {keigoMode === 'formal' ? '敬語' : 'カジュアル'}
            </Badge>
            <Badge variant="outline">
              {language === 'ja' ? '日本語' : 'English'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Voice Controls */}
        <div className="flex items-center justify-center space-x-4">
          <Button
            variant={isRecording ? 'destructive' : 'default'}
            size="lg"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`relative ${isRecording ? 'voice-recording' : ''}`}
          >
            {isRecording ? (
              <>
                <MicOff className="h-5 w-5 mr-2" />
                {language === 'ja' ? '停止' : 'Stop'}
              </>
            ) : (
              <>
                <Mic className="h-5 w-5 mr-2" />
                {language === 'ja' ? '録音開始' : 'Start Recording'}
              </>
            )}
          </Button>
          
          {response && (
            <Button
              variant="outline"
              onClick={isSpeaking ? stopSpeaking : () => speakResponse(response)}
              disabled={isProcessing}
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="h-4 w-4 mr-2" />
                  {language === 'ja' ? '停止' : 'Stop'}
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 mr-2" />
                  {language === 'ja' ? '再生' : 'Speak'}
                </>
              )}
            </Button>
          )}
        </div>

        {/* Text Input */}
        <div className="space-y-2">
          <Textarea
            placeholder={getPlaceholder()}
            value={transcript || textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className={`min-h-[100px] ${language === 'ja' ? 'japanese' : ''}`}
            disabled={isRecording || isProcessing}
          />
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {isRecording && (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full voice-wave"></div>
                  <div className="w-2 h-2 bg-red-500 rounded-full voice-wave" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-red-500 rounded-full voice-wave" style={{ animationDelay: '0.2s' }}></div>
                  <span className="text-sm text-red-500 ml-2">
                    {language === 'ja' ? '録音中...' : 'Recording...'}
                  </span>
                </div>
              )}
              {isProcessing && (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm text-muted-foreground">
                    {language === 'ja' ? '処理中...' : 'Processing...'}
                  </span>
                </div>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!transcript && !textInput.trim() || isProcessing}
              size="sm"
            >
              <Send className="h-4 w-4 mr-2" />
              {language === 'ja' ? '送信' : 'Send'}
            </Button>
          </div>
        </div>

        {/* Response */}
        {response && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h4 className={`font-medium mb-2 ${language === 'ja' ? 'japanese' : ''}`}>
              {language === 'ja' ? 'BRYTT AI応答:' : 'BRYTT AI Response:'}
            </h4>
            <p className={`text-sm ${language === 'ja' ? 'japanese' : ''}`}>
              {response}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default VoiceInterface