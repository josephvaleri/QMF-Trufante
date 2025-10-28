'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Shield, 
  Clock, 
  MessageSquare, 
  CheckCircle,
  XCircle,
  Edit
} from 'lucide-react'

interface QnAItem {
  id: number
  qna_id: number
  user_question: string
  assistant_answer: string
  edited_answer?: string
  status: string
  created_at: string
  moderator_notes?: string
  decided_at?: string
  moderator_id?: string
  auto_flags?: string[]
  source?: string
}

interface ModerationCardProps {
  item: QnAItem
  onModerationAction: (itemId: number, action: string, text?: string) => void
  onStartEdit: (item: QnAItem) => void
  onCancelEdit: () => void
  editingItem: QnAItem | null
  editText: string
  onEditTextChange: (text: string) => void
}

export default function ModerationCard({ 
  item, 
  onModerationAction, 
  onStartEdit, 
  onCancelEdit,
  editingItem,
  editText,
  onEditTextChange
}: ModerationCardProps) {
  const isEditing = editingItem?.id === item.id

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'accepted': return 'bg-green-100 text-green-800'
      case 'denied': return 'bg-red-100 text-red-800'
      case 'edited': return 'bg-primary/10 text-primary'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />
      case 'accepted': return <CheckCircle className="w-4 h-4" />
      case 'denied': return <XCircle className="w-4 h-4" />
      case 'edited': return <Edit className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  return (
    <Card 
      className="hover:shadow-md transition-shadow h-full" 
    >
      {/* Status Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          {getStatusIcon(item.status)}
          <span 
            className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}
          >
            {item.status.toUpperCase()}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {new Date(item.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          })}
        </span>
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2 hover:text-primary transition-colors flex-1">
            {item.user_question}
          </h3>
        </div>
        
        <div className="mb-3">
          {isEditing ? (
            <textarea
              value={editText}
              onChange={(e) => onEditTextChange(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              rows={3}
              placeholder="Edit the answer..."
            />
          ) : (
            <p className="text-sm text-gray-600 line-clamp-3">
              {item.edited_answer || item.assistant_answer}
            </p>
          )}
        </div>
        
        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
          <div className="flex items-center space-x-3">
            <div className="flex items-center">
              <MessageSquare className="w-4 h-4 mr-1" />
              Q&A
            </div>
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {new Date(item.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2">
          {isEditing ? (
            <>
              <button
                onClick={() => onModerationAction(item.id, 'edit', editText)}
                className="text-gray-400 hover:text-primary transition-colors"
                title="Save edit"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={onCancelEdit}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Cancel edit"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {item.status === 'pending' && (
                <>
                  <button
                    onClick={() => onModerationAction(item.id, 'accept')}
                    className="text-gray-400 hover:text-green-500 transition-colors"
                    title="Accept"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onModerationAction(item.id, 'deny')}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Deny"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onStartEdit(item)}
                    className="text-gray-400 hover:text-primary transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </>
              )}
              {item.status === 'edited' && (
                <button
                  onClick={() => onStartEdit(item)}
                  className="text-gray-400 hover:text-primary transition-colors"
                  title="Re-edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}