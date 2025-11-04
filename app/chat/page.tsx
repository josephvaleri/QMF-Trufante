"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ask, type ChatTurn } from "../(site)/useAsk";
import { supaBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Send, 
  User, 
  MessageCircle, 
  Heart, 
  LogOut, 
  Plus, 
  Edit3, 
  Trash2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Shield
} from "lucide-react";

interface ChatSession {
  id: string;
  session_name: string;
  created_at: string;
  updated_at: string;
  chat_messages: { count: number }[];
}

function ChatContent() {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentAssistantMessageRef = useRef<string>("");
  const hasProcessedInitialQuery = useRef<boolean>(false);

  useEffect(() => {
    // Check if user is logged in
    const checkUser = async () => {
      const supabase = supaBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
        setUser(user);
        
        // Get user profile and check moderator role
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        setUserProfile(profile);
        setIsModerator(profile?.role === 'moderator' || profile?.role === 'admin');
        
        await loadSessions();
        // Auto-load the most recent session if available
        const response = await fetch('/api/chat/sessions');
        if (response.ok) {
          const data = await response.json();
          const sessions = data.sessions || [];
          if (sessions.length > 0) {
            // Load the most recent session
            await loadSession(sessions[0].id);
          }
        }
      } else {
        setIsLoggedIn(false);
        setUser(null);
        setUserProfile(null);
        setIsModerator(false);
      }
    };

    checkUser();

    // Listen for auth changes
    const supabase = supaBrowser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setIsLoggedIn(true);
        setUser(session.user);
        
        // Get user profile and check moderator role
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        
        setUserProfile(profile);
        setIsModerator(profile?.role === 'moderator' || profile?.role === 'admin');
        
        await loadSessions();
        // Auto-load the most recent session if available
        const response = await fetch('/api/chat/sessions');
        if (response.ok) {
          const data = await response.json();
          const sessions = data.sessions || [];
          if (sessions.length > 0) {
            // Load the most recent session
            await loadSession(sessions[0].id);
          }
        }
      } else {
        setIsLoggedIn(false);
        setUser(null);
        setUserProfile(null);
        setIsModerator(false);
        setSessions([]);
        setCurrentSessionId(null);
        setMessages([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const initialQuestion = searchParams.get("q");
    if (initialQuestion && !hasProcessedInitialQuery.current) {
      hasProcessedInitialQuery.current = true;
      // Don't add the user message here - handleSendMessage will do it
      handleSendMessage(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/chat/sessions');
      if (response.ok) {
        const data = await response.json();
        const loadedSessions = data.sessions || [];
        setSessions(loadedSessions);
        // Auto-open sidebar if there are sessions
        if (loadedSessions.length > 0 && !sidebarOpen) {
          setSidebarOpen(true);
        }
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const createNewSession = async () => {
    if (!newSessionName.trim()) return;
    
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_name: newSessionName })
      });
      
      if (response.ok) {
        const data = await response.json();
        await loadSessions();
        setCurrentSessionId(data.session.id);
        setMessages([]);
        setNewSessionName("");
        setShowNewSessionForm(false);
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        const sessionMessages = data.session.chat_messages || [];
        setMessages(sessionMessages.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        })));
        setCurrentSessionId(sessionId);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadSessions();
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  async function handleSendMessage(content: string) {
    if (!content.trim() || isLoading) return;

    // Create a session if one doesn't exist and user is logged in
    let sessionId = currentSessionId;
    if (!sessionId && isLoggedIn) {
      try {
        const response = await fetch('/api/chat/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_name: `Chat ${new Date().toLocaleDateString()}` })
        });
        
        if (response.ok) {
          const data = await response.json();
          sessionId = data.session.id;
          setCurrentSessionId(sessionId);
          await loadSessions();
        }
      } catch (error) {
        console.error('Error creating session:', error);
      }
    }

    const userMessage: ChatTurn = { role: "user", content };
    
    // Update messages with user message first
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    // Get the updated messages for context (API will use DB context if session_id provided)
    // But we still need to pass current messages for cases without session_id
    const updatedMessages = [...messages, userMessage];
    
    // Reset the assistant message ref
    currentAssistantMessageRef.current = "";

    try {
      await ask(content, updatedMessages, (chunk) => {
        // Accumulate chunks in the ref
        currentAssistantMessageRef.current += chunk;
        
        // Use a more direct approach to update the assistant message
        setMessages(prev => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          
          if (newMessages[lastIndex]?.role === "assistant") {
            // Update existing assistant message
            newMessages[lastIndex] = { 
              ...newMessages[lastIndex], 
              content: currentAssistantMessageRef.current 
            };
          } else {
            // Add new assistant message
            newMessages.push({ 
              role: "assistant", 
              content: currentAssistantMessageRef.current 
            });
          }
          
          return newMessages;
        });
      }, sessionId || undefined);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `Sorry, there was an error: ${errorMessage}. Please try again.` 
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    
    handleSendMessage(input.trim());
    setInput("");
  }

  const handleLogout = async () => {
    const supabase = supaBrowser();
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-blue-50 via-white to-orange-50 flex flex-col">
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
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-orange-900 font-semibold text-lg">Spiritual Conversation</h1>
              </div>
            </div>
            
            {/* Sign Up Button for unauthenticated users */}
            {!isLoggedIn && (
              <Button
                onClick={() => router.push('/auth')}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Heart className="w-4 h-4 mr-2" />
                Sign Up to Save Chat
              </Button>
            )}
            
            {/* Welcome message for authenticated users */}
            {isLoggedIn && (
              <div className="flex items-center space-x-3">
                <div className="text-orange-700 text-sm">
                  Welcome back{userProfile?.preferred_name ? `, ${userProfile.preferred_name}` : ''}!
                </div>
                
                {/* Moderation Button for Moderators/Admins */}
                {isModerator && (
                  <Button
                    onClick={() => router.push('/moderation')}
                    className="bg-orange-600/90 hover:bg-orange-700/90 text-white border-0"
                    size="sm"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Moderation
                  </Button>
                )}
                
                <Button
                  onClick={() => router.push('/profile')}
                  variant="outline"
                  size="sm"
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Button>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar for previous chats - only show if logged in */}
        {isLoggedIn && (
          <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-orange-200 bg-white/90 backdrop-blur-sm flex flex-col`}>
            <div className="p-4 border-b border-orange-200 flex items-center justify-between">
              <h2 className="font-semibold text-orange-900">Previous Chats</h2>
              <Button
                onClick={() => setSidebarOpen(false)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {/* New Session Button */}
              {!showNewSessionForm ? (
                <Button
                  onClick={() => setShowNewSessionForm(true)}
                  variant="outline"
                  className="w-full mb-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Chat
                </Button>
              ) : (
                <div className="mb-2 p-2 border border-orange-200 rounded-lg bg-orange-50">
                  <Input
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    placeholder="Chat name..."
                    className="mb-2 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        createNewSession();
                      } else if (e.key === 'Escape') {
                        setShowNewSessionForm(false);
                        setNewSessionName("");
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <Button
                      onClick={createNewSession}
                      size="sm"
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-xs"
                    >
                      Create
                    </Button>
                    <Button
                      onClick={() => {
                        setShowNewSessionForm(false);
                        setNewSessionName("");
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Sessions List */}
              <div className="space-y-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${
                      currentSessionId === session.id
                        ? 'bg-orange-100 border border-orange-300'
                        : 'hover:bg-orange-50 border border-transparent'
                    }`}
                    onClick={() => loadSession(session.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-orange-900 truncate">
                          {session.session_name}
                        </div>
                        <div className="text-xs text-orange-600 mt-1">
                          {new Date(session.updated_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-orange-500 mt-1">
                          {session.chat_messages?.[0]?.count || 0} messages
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 ml-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {sessions.length === 0 && (
                <div className="text-center text-orange-600 text-sm mt-4">
                  No previous chats
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Chat Area */}
        <div className="flex-1 flex items-center justify-center p-4 relative">
          {/* Toggle Sidebar Button - only show if logged in and sidebar is closed */}
          {isLoggedIn && !sidebarOpen && (
            <Button
              onClick={() => setSidebarOpen(true)}
              variant="ghost"
              className="absolute left-4 top-4 bg-white/90 backdrop-blur-sm border border-orange-200 hover:bg-orange-50 z-10"
              size="sm"
            >
              <ChevronRight className="w-4 h-4 mr-2" />
              Previous Chats
            </Button>
          )}
          <div className="w-full max-w-4xl h-full flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <Card className={`max-w-[80%] ${
                    message.role === "user"
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-white text-gray-800 border-orange-200"
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          message.role === "user" 
                            ? "bg-orange-500" 
                            : "bg-blue-100"
                        }`}>
                          {message.role === "user" ? (
                            <User className="w-4 h-4 text-white" />
                          ) : (
                            <MessageCircle className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div 
                            className="whitespace-pre-wrap break-words"
                            dangerouslySetInnerHTML={{
                              __html: message.content
                                .replace(/\n\n/g, '<br><br>')
                                .replace(/\n/g, '<br>')
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                .replace(/\*/g, '')
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <Card className="bg-white border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <MessageCircle className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            
            {/* Notice for unauthenticated users */}
            {!isLoggedIn && messages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center"
              >
                <Card className="bg-yellow-50 border-yellow-200 max-w-md">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <Heart className="w-4 h-4 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-yellow-800 text-sm">
                          <strong>Chat not saved.</strong> 
                          <Button 
                            onClick={() => router.push('/auth')}
                            variant="link"
                            className="p-0 h-auto text-yellow-800 hover:text-yellow-900 underline"
                          >
                            Sign up
                          </Button> to save.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="bg-white/80 backdrop-blur-sm border-t border-orange-200 p-4">
            <form onSubmit={handleSubmit}>
              <div className="flex space-x-3">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  disabled={isLoading}
                  rows={3}
                  className="flex-1 resize-none border-orange-300 focus:border-orange-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="bg-orange-600 hover:bg-orange-700"
                  size="lg"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center">
        <Card className="bg-white/90 backdrop-blur-sm border-orange-200 shadow-xl">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading chat...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}