import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Mic, MicOff, Send, Volume2, VolumeX, Waves } from 'lucide-react'
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
  const [audioLevel, setAudioLevel] = useState(0)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number>()

  // Speech synthesis with better voice selection
  const speakResponse = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    
    // Cancel any ongoing speech
    speechSynthesis.cancel()
    
    setIsSpeaking(true)
    const utterance = new SpeechSynthesisUtterance(text)
    
    // Better voice selection for Japanese/English
    const voices = speechSynthesis.getVoices()
    if (language === 'ja') {
      const japaneseVoice = voices.find(voice => 
        voice.lang.startsWith('ja') && voice.name.includes('Google')
      ) || voices.find(voice => voice.lang.startsWith('ja'))
      if (japaneseVoice) utterance.voice = japaneseVoice
      utterance.lang = 'ja-JP'
    } else {
      const englishVoice = voices.find(voice => 
        voice.lang.startsWith('en') && voice.name.includes('Google')
      ) || voices.find(voice => voice.lang.startsWith('en'))
      if (englishVoice) utterance.voice = englishVoice
      utterance.lang = 'en-US'
    }
    
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = 0.8
    
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    
    speechSynthesis.speak(utterance)
  }, [language])

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [])

  // Process voice/text commands with AI
  const processCommand = useCallback(async (command: string) => {
    if (!command.trim()) return
    
    setIsProcessing(true)
    setResponse('')
    
    try {
      // Create a task for the command
      const taskId = `task_${Date.now()}`
      const user = await blink.auth.me()
      
      await blink.db.tasks.create({
        id: taskId,
        userId: user.id,
        agentType: 'voice_command',
        taskName: command.substring(0, 100),
        status: 'processing',
        lastAction: 'Voice command received',
        inputData: JSON.stringify({ command, language, keigoMode }),
        language,
        keigoMode
      })
      
      // Enhanced AI prompt for better telecom responses
      const aiResponse = await blink.ai.generateText({
        prompt: `You are BRYTT AI, a sophisticated multilingual agentic platform for telecom operations in Japan.

User command: "${command}"
Language: ${language}
Keigo mode: ${keigoMode}
Context: Telecom onboarding and field operations

Instructions:
- Respond in ${language === 'ja' ? 'Japanese' : 'English'} with ${keigoMode === 'formal' ? 'formal/keigo' : 'casual'} tone
- For telecom tasks (customer registration, SIM contracts, email sending, field logging), provide specific action confirmations
- Keep responses conversational and under 100 words
- If the command involves multiple steps, acknowledge each step briefly

Example Japanese formal response: "承知いたしました。顧客情報の登録、SIM契約書の生成、メール送信を順次実行いたします。"
Example Japanese casual response: "了解！顧客情報を登録して、契約書を作って、メールで送るね。"`,
        maxTokens: 150
      })
      
      setResponse(aiResponse.text)
      
      // Update task status
      await blink.db.tasks.update(taskId, {
        status: 'completed',
        lastAction: 'AI response generated',
        outputData: JSON.stringify({ response: aiResponse.text })
      })
      
      onTaskCreated()
      
      // Auto-speak response for speech-to-speech interaction
      if ('speechSynthesis' in window && aiResponse.text) {
        // Small delay to ensure UI updates first
        setTimeout(() => speakResponse(aiResponse.text), 300)
      }
      
    } catch (error) {
      console.error('Error processing command:', error)
      const errorMsg = language === 'ja' 
        ? 'エラーが発生しました。もう一度お試しください。'
        : 'An error occurred. Please try again.'
      setResponse(errorMsg)
      
      // Speak error message
      if ('speechSynthesis' in window) {
        setTimeout(() => speakResponse(errorMsg), 300)
      }
    } finally {
      setIsProcessing(false)
    }
  }, [language, keigoMode, onTaskCreated, speakResponse])

  // High-quality audio transcription
  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    try {
      setIsProcessing(true)
      
      // Convert blob to base64 for AI transcription
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
      
      // Use Blink AI for high-quality transcription
      const result = await blink.ai.transcribeAudio({
        audio: base64Audio,
        language: language === 'ja' ? 'ja' : 'en',
        model: 'whisper-1'
      })
      
      setTranscript(result.text)
      
      // Auto-process the transcribed text for speech-to-speech
      if (result.text.trim()) {
        await processCommand(result.text)
      }
    } catch (error) {
      console.error('Transcription error:', error)
      const errorMsg = language === 'ja' 
        ? '音声認識エラーが発生しました。もう一度お試しください。'
        : 'Speech recognition error occurred. Please try again.'
      setResponse(errorMsg)
      speakResponse(errorMsg)
    } finally {
      setIsProcessing(false)
    }
  }, [language, processCommand, speakResponse])

  // Audio level visualization
  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length
      setAudioLevel(average / 255)
      
      if (isRecording) {
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
      }
    }
  }, [isRecording])

  // Initialize Web Speech API
  useEffect(() => {
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
          
          // Auto-process final transcript for speech-to-speech
          if (finalTranscript.trim()) {
            processCommand(finalTranscript)
          }
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

    // Load voices for speech synthesis
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        speechSynthesis.getVoices()
      }
      speechSynthesis.onvoiceschanged = loadVoices
      loadVoices()
    }
  }, [language, onActiveChange, processCommand])

  const startRecording = async () => {
    try {
      if (recognitionRef.current) {
        // Use Web Speech API for real-time recognition
        setTranscript('')
        setIsRecording(true)
        onActiveChange(true)
        recognitionRef.current.start()
      } else {
        // Fallback to MediaRecorder for AI transcription
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        
        // Set up audio visualization
        audioContextRef.current = new AudioContext()
        analyserRef.current = audioContextRef.current.createAnalyser()
        const source = audioContextRef.current.createMediaStreamSource(stream)
        source.connect(analyserRef.current)
        analyserRef.current.fftSize = 256
        
        mediaRecorderRef.current = new MediaRecorder(stream)
        audioChunksRef.current = []
        
        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data)
        }
        
        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
          await transcribeAudio(audioBlob)
          stream.getTracks().forEach(track => track.stop())
        }
        
        setIsRecording(true)
        onActiveChange(true)
        mediaRecorderRef.current.start()
        updateAudioLevel()
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
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    setIsRecording(false)
    onActiveChange(false)
    setAudioLevel(0)
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
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Waves className="h-5 w-5 text-primary" />
              <span className={language === 'ja' ? 'japanese' : ''}>
                {language === 'ja' ? '音声インターフェース' : 'Voice Interface'}
              </span>
            </CardTitle>
            <CardDescription className={language === 'ja' ? 'japanese' : ''}>
              {language === 'ja' 
                ? '音声またはテキストでコマンドを入力してください'
                : 'Speak or type your commands for speech-to-speech interaction'
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
            className={`relative transition-all duration-200 ${isRecording ? 'scale-110 shadow-lg' : ''}`}
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

        {/* Audio Level Visualization */}
        {isRecording && (
          <div className="flex items-center justify-center space-x-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-2 bg-primary rounded-full transition-all duration-100 ${
                  audioLevel * 5 > i ? 'h-8' : 'h-2'
                }`}
                style={{
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        )}

        {/* Text Input */}
        <div className="space-y-2">
          <Textarea
            placeholder={getPlaceholder()}
            value={transcript || textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className={`min-h-[100px] ${language === 'ja' ? 'japanese' : ''} ${
              isRecording ? 'border-primary/50 bg-primary/5' : ''
            }`}
            disabled={isRecording || isProcessing}
          />
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {isRecording && (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-red-500">
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
              {isSpeaking && (
                <div className="flex items-center space-x-2">
                  <Volume2 className="h-4 w-4 text-primary animate-pulse" />
                  <span className="text-sm text-primary">
                    {language === 'ja' ? '音声出力中...' : 'Speaking...'}
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
          <div className="mt-4 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border border-primary/10">
            <h4 className={`font-medium mb-2 flex items-center space-x-2 ${language === 'ja' ? 'japanese' : ''}`}>
              <Volume2 className="h-4 w-4 text-primary" />
              <span>{language === 'ja' ? 'BRYTT AI応答:' : 'BRYTT AI Response:'}</span>
            </h4>
            <p className={`text-sm leading-relaxed ${language === 'ja' ? 'japanese' : ''}`}>
              {response}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default VoiceInterface