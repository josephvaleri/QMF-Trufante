"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supaBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ArrowLeft, Check, X, Edit, RefreshCw, Eye, EyeOff, User, MessageCircle, Clock } from "lucide-react";

export default function ModerationPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [moderationItems, setModerationItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editedAnswer, setEditedAnswer] = useState("");
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const supabase = supaBrowser();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push('/auth');
          return;
        }

        setUser(user);

        // Get user profile to check role
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error || !profileData) {
          setError('Failed to load profile');
          return;
        }

        setProfile(profileData);

        // Check if user has moderation access
        if (profileData.role !== 'moderator' && profileData.role !== 'admin') {
          setError('Access denied. You do not have moderation privileges.');
          return;
        }

        // Load moderation items
        await loadModerationItems();
      } catch (error) {
        console.error('Error checking access:', error);
        setError('An error occurred while checking access');
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [router]);

  const loadModerationItems = async () => {
    try {
      const supabase = supaBrowser();
      const { data, error } = await supabase
        .from('moderation_queue')
        .select(`
          *,
          qna:qna_id (
            id,
            user_question,
            assistant_answer,
            created_at,
            user_id
          )
        `)
        .eq('status', 'pending')
        .order('id', { ascending: false });

      if (error) throw error;
      setModerationItems(data || []);
    } catch (error) {
      console.error('Error loading moderation items:', error);
      setError('Failed to load moderation items');
    }
  };

  const handleModerationAction = async (itemId: string, action: string, editedAnswer?: string) => {
    setIsProcessing(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/moderation/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          qnaId: itemId,
          editedAnswer: editedAnswer
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process moderation action');
      }

      setSuccess(`Item ${action}ed successfully`);
      setEditingItem(null);
      setEditedAnswer("");
      await loadModerationItems();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to process action');
    } finally {
      setIsProcessing(false);
    }
  };

  const startEdit = (item: any) => {
    setEditingItem(item);
    setEditedAnswer(item.qna.assistant_answer);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditedAnswer("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center">
        <Card className="bg-white/90 backdrop-blur-sm border-orange-200 shadow-xl">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading moderation panel...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center">
        <Card className="bg-white/90 backdrop-blur-sm border-orange-200 shadow-xl">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-red-900 mb-2">Access Denied</h2>
              <p className="text-red-700 mb-4">{error}</p>
              <Button onClick={() => router.push('/')} className="bg-orange-600 hover:bg-orange-700">
                Return Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => router.back()}
                variant="ghost"
                size="sm"
                className="text-orange-700 hover:bg-orange-50"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-orange-900 font-semibold text-lg">Moderation Panel</h1>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}
                variant="outline"
                size="sm"
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                {viewMode === 'table' ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {viewMode === 'table' ? 'Card View' : 'Table View'}
              </Button>
              <Button
                onClick={loadModerationItems}
                variant="outline"
                size="sm"
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Status Summary */}
            <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-900 flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Moderation Status
                </CardTitle>
                <CardDescription>
                  Review and moderate spiritual conversations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="text-2xl font-bold text-yellow-700">{moderationItems.length}</div>
                    <div className="text-sm text-yellow-600">Pending Review</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-2xl font-bold text-blue-700">{profile?.role}</div>
                    <div className="text-sm text-blue-600">Your Role</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-700">Active</div>
                    <div className="text-sm text-green-600">Moderation Panel</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Messages */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"
              >
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm"
              >
                {success}
              </motion.div>
            )}

            {/* Moderation Items */}
            {moderationItems.length === 0 ? (
              <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">All Caught Up!</h3>
                  <p className="text-gray-600">No items pending moderation review.</p>
                </CardContent>
              </Card>
            ) : viewMode === 'card' ? (
              <div className="space-y-4">
                {moderationItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full"
                  >
                    <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <CardTitle className="text-orange-900 text-lg">
                                Moderation Item #{item.id}
                              </CardTitle>
                              <CardDescription className="flex items-center space-x-2">
                                <Clock className="w-4 h-4" />
                                <span>{new Date(item.qna.created_at).toLocaleDateString()}</span>
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              onClick={() => handleModerationAction(item.id, 'accept')}
                              disabled={isProcessing}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Accept
                            </Button>
                            <Button
                              onClick={() => startEdit(item)}
                              disabled={isProcessing}
                              size="sm"
                              variant="outline"
                              className="border-blue-300 text-blue-700 hover:bg-blue-50"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              onClick={() => handleModerationAction(item.id, 'deny')}
                              disabled={isProcessing}
                              size="sm"
                              variant="outline"
                              className="border-red-300 text-red-700 hover:bg-red-50"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Deny
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                            <MessageCircle className="w-4 h-4 mr-2" />
                            User Question
                          </h4>
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-gray-800">{item.qna.user_question}</p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Assistant Response</h4>
                          {editingItem?.id === item.id ? (
                            <div className="space-y-3">
                              <Textarea
                                value={editedAnswer}
                                onChange={(e) => setEditedAnswer(e.target.value)}
                                rows={6}
                                className="border-orange-300 focus:border-orange-500"
                              />
                              <div className="flex space-x-2">
                                <Button
                                  onClick={() => handleModerationAction(item.id, 'edit', editedAnswer)}
                                  disabled={isProcessing}
                                  size="sm"
                                  className="bg-orange-600 hover:bg-orange-700"
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Save Edit
                                </Button>
                                <Button
                                  onClick={cancelEdit}
                                  disabled={isProcessing}
                                  size="sm"
                                  variant="outline"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                              <p className="text-gray-800 whitespace-pre-wrap">{item.qna.assistant_answer}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Question
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Answer
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {moderationItems.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                  <User className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    #{item.id}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 max-w-xs truncate">
                                {item.qna.user_question}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 max-w-xs truncate">
                                {editingItem?.id === item.id ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      value={editedAnswer}
                                      onChange={(e) => setEditedAnswer(e.target.value)}
                                      rows={3}
                                      className="text-xs border-orange-300 focus:border-orange-500"
                                    />
                                    <div className="flex space-x-1">
                                      <Button
                                        onClick={() => handleModerationAction(item.id, 'edit', editedAnswer)}
                                        disabled={isProcessing}
                                        size="sm"
                                        className="bg-orange-600 hover:bg-orange-700 text-xs px-2 py-1"
                                      >
                                        Save
                                      </Button>
                                      <Button
                                        onClick={cancelEdit}
                                        disabled={isProcessing}
                                        size="sm"
                                        variant="outline"
                                        className="text-xs px-2 py-1"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-sm text-gray-900 max-w-xs truncate">
                                    {item.qna.assistant_answer}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(item.qna.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-1">
                                <Button
                                  onClick={() => handleModerationAction(item.id, 'accept')}
                                  disabled={isProcessing}
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-xs px-2 py-1"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Accept
                                </Button>
                                <Button
                                  onClick={() => startEdit(item)}
                                  disabled={isProcessing}
                                  size="sm"
                                  variant="outline"
                                  className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs px-2 py-1"
                                >
                                  <Edit className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => handleModerationAction(item.id, 'deny')}
                                  disabled={isProcessing}
                                  size="sm"
                                  variant="outline"
                                  className="border-red-300 text-red-700 hover:bg-red-50 text-xs px-2 py-1"
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  Deny
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}