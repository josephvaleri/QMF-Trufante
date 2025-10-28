"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || isLoading) return;
    
    setIsLoading(true);
    // Navigate to chat page with the question
    router.push(`/chat?q=${encodeURIComponent(question.trim())}`);
  }

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center">
      {/* Background image */}
      <div className="absolute inset-0 -z-10">
        <img
          src="/bg.jpg"
          alt="Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "var(--bg-overlay)" }} />
      </div>

      {/* Hero Content */}
      <div className="text-center px-4 max-w-2xl">
        <div className="relative w-[260px] h-[260px] mb-8 mx-auto">
          <Image
            src="/qmf-logo.png"
            alt="Question My Faith"
            fill
            sizes="260px"
            style={{ objectFit: "contain" }}
            priority
          />
        </div>

        <h1 className="text-blue-900 italic mb-8 text-2xl" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)', color: '#1e3a8a' }}>
          How is your faith?
        </h1>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="max-w-md mx-auto">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about your faith..."
              disabled={isLoading}
              rows={4}
              className="w-full px-6 py-4 rounded-2xl bg-white/95 outline-none text-gray-900 shadow border border-gray-200 focus:border-gray-400 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
          </div>
        </form>

        <p 
          className="text-sm font-bold" 
          style={{ 
            color: 'white', 
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            fontWeight: 'bold'
          }}
        >
          What follows isn't a quiz or sermon.<br />
          It's a private dialogue meant to help you name<br />
          where you are in faith and life - at your own pace.
        </p>
      </div>
    </main>
  );
}