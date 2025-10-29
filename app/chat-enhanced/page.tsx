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
  ChevronRight
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
        await loadSessions();
      } else {
        setIsLoggedIn(false);
        setUser(null);
      }
    };

    checkUser();

    // Listen for auth changes
    const supabase = supaBrowser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setIsLoggedIn(true);
        setUser(session.user);
        await loadSessions();
      } else {
        setIsLoggedIn(false);
        setUser(null);
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
      handleSendMessage(initialQuestion);
    }
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/chat/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
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

    const userMessage: ChatTurn = { role: "user", content };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    // Reset the assistant message ref
    currentAssistantMessageRef.current = "";

    try {
      await ask(content, messages, (chunk) => {
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
      }, currentSessionId || undefined);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, there was an error. Please try again." 
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
    <div className="h-screen w-full bg-gradient-to-br from-blue-50 via-white to-orange-50 flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 overflow-hidden`}>
        <div className="p-4 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
            <Button
              onClick={() => setShowNewSessionForm(!showNewSessionForm)}
              size="sm"
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {showNewSessionForm && (
            <div className="mb-4 space-y-2">
              <Input
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder="Session name..."
                className="text-sm"
              />
              <div className="flex space-x-2">
                <Button
                  onClick={createNewSession}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Create
                </Button>
                <Button
                  onClick={() => setShowNewSessionForm(false)}
                  size="sm"
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className={`cursor-pointer transition-colors ${
                  currentSessionId === session.id 
                    ? 'bg-orange-50 border-orange-200' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => loadSession(session.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {session.session_name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {new Date(session.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white/90 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-50">
          <div className="px-4 py-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <Button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  variant="ghost"
                  size="sm"
                  className="text-orange-700 hover:bg-orange-50"
                >
                  {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
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
              
              {/* User Actions */}
              <div className="flex items-center space-x-3">
                {!isLoggedIn ? (
                  <Button
                    onClick={() => router.push('/auth')}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    Sign Up to Save Chat
                  </Button>
                ) : (
                  <div className="flex items-center space-x-3">
                    <div className="text-orange-700 text-sm">
                      Welcome back{user?.user_metadata?.preferred_name ? `, ${user.user_metadata.preferred_name}` : ''}!
                    </div>
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
          </div>
        </header>

        {/* Chat Container */}
        <div className="flex-1 flex items-center justify-center p-4">
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
                        <div className="flex items-start space-x-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            message.role === "user" 
                              ? "bg-orange-500" 
                              : "bg-orange-100"
                          }`}>
                            {message.role === "user" ? (
                              <User className="w-3 h-3 text-white" />
                            ) : (
                              <MessageCircle className="w-3 h-3 text-orange-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-orange-200 bg-white/90 backdrop-blur-sm p-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex space-x-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your faith..."
                    disabled={isLoading}
                    rows={3}
                    className="resize-none border-orange-300 focus:border-orange-400 bg-white text-gray-800 placeholder:text-gray-500"
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
                    className="bg-orange-600 hover:bg-orange-700 text-white border-0 self-end"
                    size="lg"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
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

export default function ChatEnhancedPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatContent />
    </Suspense>
  );
}
