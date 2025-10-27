"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ask, type ChatTurn } from "../(site)/useAsk";
import { supaBrowser } from "@/lib/supabase/client";

function ChatContent() {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
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
      } else {
        setIsLoggedIn(false);
        setUser(null);
      }
    };

    checkUser();

    // Listen for auth changes
    const supabase = supaBrowser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setIsLoggedIn(true);
        setUser(session.user);
      } else {
        setIsLoggedIn(false);
        setUser(null);
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
      });
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

  return (
    <div className="h-screen w-full relative" style={{ fontFamily: 'Garamond, serif' }}>
      {/* Background image */}
      <div className="absolute inset-0 -z-10">
        <img
          src="/bg.jpg"
          alt="Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "var(--bg-overlay)" }} />
      </div>

      {/* Chat Container - 70% width, centered */}
      <div className="h-full flex items-center justify-center p-4">
        <div className="w-[70%] h-[85vh] flex flex-col rounded-3xl shadow-2xl border border-white/50 overflow-hidden" style={{ backgroundColor: '#feecdb' }}>
          {/* Header */}
          <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center">
              <button 
                onClick={() => router.back()}
                className="mr-3 p-1 hover:bg-blue-700 rounded"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </button>
              <div className="flex items-center">
                <img
                  src="/qmf-logo.png"
                  alt="Question My Faith"
                  style={{ width: '96px', height: '96px', objectFit: 'contain' }}
                />
                <p className="text-sm text-blue-100 ml-3">AI Assistant</p>
              </div>
            </div>
            
            {/* Sign Up Button for unauthenticated users */}
            {!isLoggedIn && (
              <button
                onClick={() => router.push('/auth')}
                style={{
                  backgroundColor: 'rgb(31, 41, 55)',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'rgb(17, 24, 39)'}
                onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'rgb(31, 41, 55)'}
              >
                Sign Up to Save Chat
              </button>
            )}
            
            {/* Welcome message for authenticated users */}
            {isLoggedIn && (
              <div className="text-blue-100 text-sm">
                Welcome back{user?.user_metadata?.preferred_name ? `, ${user.user_metadata.preferred_name}` : ''}!
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-800 shadow-sm"
                  }`}
                  style={{ padding: '16px 24px' }}
                >
                  <div 
                    className="whitespace-pre-wrap break-words"
                    style={{ fontWeight: message.role === "user" ? "bold" : "normal" }}
                    dangerouslySetInnerHTML={{
                      __html: message.content
                        .replace(/\n\n/g, '<br><br>')  // Double line breaks
                        .replace(/\n/g, '<br>')        // Single line breaks
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/\*/g, '')
                    }}
                  />
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Notice for unauthenticated users */}
            {!isLoggedIn && messages.length > 0 && (
              <div className="flex justify-center">
                <div className="bg-yellow-50 border border-yellow-200 rounded p-1 max-w-xs">
                  <div className="flex items-center">
                    <svg className="w-3 h-3 text-yellow-600 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-yellow-800 text-xs">
                      <strong>Chat not saved.</strong> <button 
                        onClick={() => router.push('/auth')}
                        style={{
                          backgroundColor: 'rgb(31, 41, 55)',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '500',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                          marginLeft: '2px',
                          marginRight: '2px'
                        }}
                        onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'rgb(17, 24, 39)'}
                        onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'rgb(31, 41, 55)'}
                      >
                        Sign up
                      </button> to save.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input - 5 lines high */}
          <div className="bg-white/80 border-t border-gray-200 py-6" style={{ paddingLeft: '24px', paddingRight: '24px' }}>
            <form onSubmit={handleSubmit}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                disabled={isLoading}
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
