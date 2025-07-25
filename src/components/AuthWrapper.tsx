import React from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Mic, Globe, Zap, Users } from 'lucide-react'
import { blink } from '../blink/client'

const AuthWrapper: React.FC = () => {
  const handleSignIn = () => {
    blink.auth.login()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-primary/10 p-3 rounded-2xl">
              <Zap className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            BRYTT AI
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            Multilingual Voice-First Agentic Platform
          </p>
          <p className="text-lg text-muted-foreground japanese">
            テレコム業界向け多言語音声優先エージェントプラットフォーム
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader className="text-center">
              <div className="bg-primary/10 p-3 rounded-full w-fit mx-auto mb-4">
                <Mic className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">Voice-First Interface</CardTitle>
              <CardDescription className="japanese">音声優先インターフェース</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Speak commands in Japanese or English with Web Speech API integration
              </p>
            </CardContent>
          </Card>

          <Card className="border-accent/20 hover:border-accent/40 transition-colors">
            <CardHeader className="text-center">
              <div className="bg-accent/10 p-3 rounded-full w-fit mx-auto mb-4">
                <Globe className="h-6 w-6 text-accent" />
              </div>
              <CardTitle className="text-lg">Keigo-Native Output</CardTitle>
              <CardDescription className="japanese">敬語ネイティブ出力</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Professional Japanese communication with formal/casual tone toggle
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader className="text-center">
              <div className="bg-primary/10 p-3 rounded-full w-fit mx-auto mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">Agent Execution Mesh</CardTitle>
              <CardDescription className="japanese">エージェント実行メッシュ</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                OnboardBot, FollowUpAgent, and OpsLogger working in harmony
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sign In Card */}
        <Card className="max-w-md mx-auto border-primary/20">
          <CardHeader className="text-center">
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Sign in to access the BRYTT AI platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleSignIn}
              className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-medium"
              size="lg"
            >
              Sign In to BRYTT AI
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Secure authentication powered by Blink
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>Telecom Onboarding & Field Operations Platform</p>
          <p className="japanese mt-1">テレコムオンボーディング・フィールドオペレーションプラットフォーム</p>
        </div>
      </div>
    </div>
  )
}

export default AuthWrapper