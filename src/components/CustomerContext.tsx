import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { 
  Users, 
  Plus, 
  Edit, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard,
  Calendar,
  MessageSquare,
  Eye,
  UserPlus
} from 'lucide-react'
import { blink } from '../blink/client'

interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  identificationType?: string
  identificationNumber?: string
  preferredLanguage: string
  keigoPreference: string
  createdAt: string
}

interface CustomerContextProps {
  customers: Customer[]
  language: 'ja' | 'en'
  keigoMode: 'formal' | 'casual'
  onCustomerUpdate: () => void
}

const CustomerContext: React.FC<CustomerContextProps> = ({ 
  customers, 
  language, 
  keigoMode, 
  onCustomerUpdate 
}) => {
  const [isAddingCustomer, setIsAddingCustomer] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    identificationType: 'drivers_license',
    identificationNumber: ''
  })

  const handleAddCustomer = async () => {
    try {
      const user = await blink.auth.me()
      const customerId = `customer_${Date.now()}`
      
      await blink.db.customers.create({
        id: customerId,
        userId: user.id,
        name: newCustomer.name,
        email: newCustomer.email,
        phone: newCustomer.phone,
        address: newCustomer.address,
        identificationType: newCustomer.identificationType,
        identificationNumber: newCustomer.identificationNumber,
        preferredLanguage: language,
        keigoPreference: keigoMode
      })

      // Reset form
      setNewCustomer({
        name: '',
        email: '',
        phone: '',
        address: '',
        identificationType: 'drivers_license',
        identificationNumber: ''
      })
      
      setIsAddingCustomer(false)
      onCustomerUpdate()
    } catch (error) {
      console.error('Failed to add customer:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getIdentificationTypeLabel = (type: string) => {
    const labels = {
      drivers_license: language === 'ja' ? '運転免許証' : 'Driver\'s License',
      passport: language === 'ja' ? 'パスポート' : 'Passport',
      national_id: language === 'ja' ? '国民ID' : 'National ID',
      residence_card: language === 'ja' ? '在留カード' : 'Residence Card'
    }
    return labels[type as keyof typeof labels] || type
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${language === 'ja' ? 'japanese' : ''}`}>
          {language === 'ja' ? '顧客コンテキスト' : 'Customer Context'}
        </h3>
        <Dialog open={isAddingCustomer} onOpenChange={setIsAddingCustomer}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {language === 'ja' ? '新規顧客' : 'New Customer'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className={language === 'ja' ? 'japanese' : ''}>
                {language === 'ja' ? '新規顧客登録' : 'Add New Customer'}
              </DialogTitle>
              <DialogDescription className={language === 'ja' ? 'japanese' : ''}>
                {language === 'ja' 
                  ? '顧客情報を入力してください'
                  : 'Enter customer information'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className={language === 'ja' ? 'japanese' : ''}>
                  {language === 'ja' ? '氏名' : 'Name'} *
                </Label>
                <Input
                  id="name"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={language === 'ja' ? '田中太郎' : 'John Doe'}
                  className={language === 'ja' ? 'japanese' : ''}
                />
              </div>
              <div>
                <Label htmlFor="email" className={language === 'ja' ? 'japanese' : ''}>
                  {language === 'ja' ? 'メールアドレス' : 'Email'}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="customer@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone" className={language === 'ja' ? 'japanese' : ''}>
                  {language === 'ja' ? '電話番号' : 'Phone'}
                </Label>
                <Input
                  id="phone"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder={language === 'ja' ? '090-1234-5678' : '+81-90-1234-5678'}
                />
              </div>
              <div>
                <Label htmlFor="address" className={language === 'ja' ? 'japanese' : ''}>
                  {language === 'ja' ? '住所' : 'Address'}
                </Label>
                <Textarea
                  id="address"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                  placeholder={language === 'ja' ? '東京都渋谷区...' : 'Tokyo, Shibuya...'}
                  className={`min-h-[60px] ${language === 'ja' ? 'japanese' : ''}`}
                />
              </div>
              <div>
                <Label htmlFor="idNumber" className={language === 'ja' ? 'japanese' : ''}>
                  {language === 'ja' ? '身分証明書番号' : 'ID Number'}
                </Label>
                <Input
                  id="idNumber"
                  value={newCustomer.identificationNumber}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, identificationNumber: e.target.value }))}
                  placeholder="123456789"
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleAddCustomer} className="flex-1">
                  <UserPlus className="h-4 w-4 mr-2" />
                  {language === 'ja' ? '登録' : 'Add'}
                </Button>
                <Button variant="outline" onClick={() => setIsAddingCustomer(false)} className="flex-1">
                  {language === 'ja' ? 'キャンセル' : 'Cancel'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Customer List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={`text-base flex items-center ${language === 'ja' ? 'japanese' : ''}`}>
            <Users className="h-4 w-4 mr-2 text-primary" />
            {language === 'ja' ? '最近の顧客' : 'Recent Customers'}
          </CardTitle>
          <CardDescription className={language === 'ja' ? 'japanese' : ''}>
            {language === 'ja' 
              ? 'エージェントメッシュメモリに保存された顧客情報'
              : 'Customer information stored in agent mesh memory'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] w-full">
            {customers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className={language === 'ja' ? 'japanese' : ''}>
                  {language === 'ja' ? '顧客情報がありません' : 'No customers found'}
                </p>
                <p className={`text-sm mt-1 ${language === 'ja' ? 'japanese' : ''}`}>
                  {language === 'ja' 
                    ? '新規顧客を追加してください'
                    : 'Add a new customer to get started'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {customers.map((customer, index) => (
                  <div key={customer.id}>
                    <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                         onClick={() => setSelectedCustomer(customer)}>
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {customer.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className={`font-medium text-sm truncate ${language === 'ja' ? 'japanese' : ''}`}>
                            {customer.name}
                          </h4>
                          <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                            <Badge variant="outline" className="text-xs">
                              {customer.preferredLanguage === 'ja' ? '日本語' : 'English'}
                            </Badge>
                            {customer.preferredLanguage === 'ja' && (
                              <Badge variant="outline" className="text-xs">
                                {customer.keigoPreference === 'formal' ? '敬語' : 'カジュアル'}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          {customer.email && (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="truncate">{customer.email}</span>
                            </div>
                          )}
                          {customer.phone && (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span>{customer.phone}</span>
                            </div>
                          )}
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span>{formatDate(customer.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {index < customers.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Agent Memory */}
      <Card className="border-accent/20">
        <CardHeader className="pb-3">
          <CardTitle className={`text-base flex items-center ${language === 'ja' ? 'japanese' : ''}`}>
            <MessageSquare className="h-4 w-4 mr-2 text-accent" />
            {language === 'ja' ? 'エージェントメッシュメモリ' : 'Agent Mesh Memory'}
          </CardTitle>
          <CardDescription className={language === 'ja' ? 'japanese' : ''}>
            {language === 'ja' 
              ? 'コンテキスト、設定、履歴の永続化'
              : 'Persistent context, preferences, and history'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{customers.length}</div>
              <div className={`text-xs text-muted-foreground ${language === 'ja' ? 'japanese' : ''}`}>
                {language === 'ja' ? '顧客' : 'Customers'}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">
                {customers.filter(c => c.preferredLanguage === 'ja').length}
              </div>
              <div className={`text-xs text-muted-foreground ${language === 'ja' ? 'japanese' : ''}`}>
                {language === 'ja' ? '日本語' : 'Japanese'}
              </div>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="space-y-2">
            <h4 className={`text-sm font-medium ${language === 'ja' ? 'japanese' : ''}`}>
              {language === 'ja' ? 'メモリ統計:' : 'Memory Stats:'}
            </h4>
            <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span className={language === 'ja' ? 'japanese' : ''}>
                  {language === 'ja' ? '敬語設定:' : 'Keigo Preference:'}
                </span>
                <span>
                  {customers.filter(c => c.keigoPreference === 'formal').length} formal
                </span>
              </div>
              <div className="flex justify-between">
                <span className={language === 'ja' ? 'japanese' : ''}>
                  {language === 'ja' ? '完了済み契約:' : 'Completed Contracts:'}
                </span>
                <span>0</span>
              </div>
              <div className="flex justify-between">
                <span className={language === 'ja' ? 'japanese' : ''}>
                  {language === 'ja' ? 'フォローアップ:' : 'Follow-ups:'}
                </span>
                <span>0</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Detail Dialog */}
      {selectedCustomer && (
        <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className={`flex items-center ${language === 'ja' ? 'japanese' : ''}`}>
                <Users className="h-4 w-4 mr-2" />
                {selectedCustomer.name}
              </DialogTitle>
              <DialogDescription className={language === 'ja' ? 'japanese' : ''}>
                {language === 'ja' ? '顧客詳細情報' : 'Customer Details'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className={`text-xs ${language === 'ja' ? 'japanese' : ''}`}>
                    {language === 'ja' ? '言語設定' : 'Language'}
                  </Label>
                  <Badge variant="outline" className="mt-1">
                    {selectedCustomer.preferredLanguage === 'ja' ? '日本語' : 'English'}
                  </Badge>
                </div>
                <div>
                  <Label className={`text-xs ${language === 'ja' ? 'japanese' : ''}`}>
                    {language === 'ja' ? '敬語設定' : 'Keigo Mode'}
                  </Label>
                  <Badge variant="outline" className="mt-1">
                    {selectedCustomer.keigoPreference === 'formal' ? '敬語' : 'カジュアル'}
                  </Badge>
                </div>
              </div>
              
              {selectedCustomer.email && (
                <div>
                  <Label className={`text-xs ${language === 'ja' ? 'japanese' : ''}`}>
                    {language === 'ja' ? 'メールアドレス' : 'Email'}
                  </Label>
                  <p className="text-sm mt-1">{selectedCustomer.email}</p>
                </div>
              )}
              
              {selectedCustomer.phone && (
                <div>
                  <Label className={`text-xs ${language === 'ja' ? 'japanese' : ''}`}>
                    {language === 'ja' ? '電話番号' : 'Phone'}
                  </Label>
                  <p className="text-sm mt-1">{selectedCustomer.phone}</p>
                </div>
              )}
              
              {selectedCustomer.address && (
                <div>
                  <Label className={`text-xs ${language === 'ja' ? 'japanese' : ''}`}>
                    {language === 'ja' ? '住所' : 'Address'}
                  </Label>
                  <p className={`text-sm mt-1 ${language === 'ja' ? 'japanese' : ''}`}>
                    {selectedCustomer.address}
                  </p>
                </div>
              )}
              
              {selectedCustomer.identificationType && (
                <div>
                  <Label className={`text-xs ${language === 'ja' ? 'japanese' : ''}`}>
                    {language === 'ja' ? '身分証明書' : 'Identification'}
                  </Label>
                  <p className={`text-sm mt-1 ${language === 'ja' ? 'japanese' : ''}`}>
                    {getIdentificationTypeLabel(selectedCustomer.identificationType)}
                    {selectedCustomer.identificationNumber && ` - ${selectedCustomer.identificationNumber}`}
                  </p>
                </div>
              )}
              
              <div>
                <Label className={`text-xs ${language === 'ja' ? 'japanese' : ''}`}>
                  {language === 'ja' ? '登録日' : 'Created'}
                </Label>
                <p className="text-sm mt-1">{formatDate(selectedCustomer.createdAt)}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default CustomerContext