"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ask, type ChatTurn } from "../(site)/useAsk";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initialQuestion = searchParams.get("q");

  useEffect(() => {
    if (initialQuestion) {
      setMessages([{ role: "user", content: initialQuestion }]);
      handleSendMessage(initialQuestion);
    }
  }, [initialQuestion]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSendMessage(content: string) {
    if (!content.trim() || isLoading) return;

    const userMessage: ChatTurn = { role: "user", content };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      await ask(content, messages, (chunk) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => 
              i === prev.length - 1 ? { ...m, content: m.content + chunk } : m
            );
          }
          return [...prev, { role: "assistant", content: chunk }];
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
                        .replace(/\n/g, '<br>')
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
