"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supaBrowser } from "@/lib/supabase/client";

export default function HomePage() {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

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

  const handleLogout = async () => {
    try {
      const supabase = supaBrowser();
      await supabase.auth.signOut();
      setIsLoggedIn(false);
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('Form submitted with question:', question);
    
    if (!question.trim() || isLoading) {
      console.log('Question is empty or already loading');
      return;
    }
    
    console.log('Navigating to chat page...');
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
      <div className="text-center px-4" style={{ width: '100%', maxWidth: 'none' }}>
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

        <h1 className="text-blue-900 italic mb-8" style={{ fontSize: '1.2rem', color: '#1e3a8a' }}>
          How is your faith?
        </h1>

        <form onSubmit={handleSubmit} style={{ width: '40%', margin: '0 auto 20px auto' }}>
          <div style={{ boxShadow: 'rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px' }}>
            <textarea
              placeholder="Ask about your faith..."
              rows={4}
              className="w-full px-6 py-4 rounded-2xl bg-white/95 outline-none text-gray-900 border border-gray-200 focus:border-gray-400 resize-none"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as any);
                }
              }}
              disabled={isLoading}
            />
          </div>
          <div className="mt-4 text-center">
            <button
              type="submit"
              disabled={!question.trim() || isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Loading...' : 'Ask Question'}
            </button>
          </div>
        </form>

        {/* Note box for anonymous users */}
        {!isLoggedIn && (
          <div className="w-[60%] mx-auto px-8 py-8 shadow-lg flex items-center justify-between gap-6" style={{ backgroundColor: '#ffffff', borderRadius: '12px' }}>
            <div className="flex-1 text-left" style={{ paddingLeft: '32px', paddingRight: '16px' }}>
              <p className="text-gray-800 leading-relaxed" style={{ fontSize: '12px' }}>
                <strong>Note:</strong> If you answer the above question without logging in, your session is a single session will be lost. If you wish to have your conversations saved as you go, please click login, create an account and login when you return.
              </p>
            </div>
            <div className="w-[10%] flex justify-start">
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
                  transition: 'background-color 0.2s',
                  marginLeft: '-10px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(17, 24, 39)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(31, 41, 55)';
                }}
              >
                Login
              </button>
            </div>
          </div>
        )}

        {/* Welcome message for logged-in users */}
        {isLoggedIn && (
          <div className="w-[60%] mx-auto px-8 py-8 shadow-lg flex items-center justify-between gap-6" style={{ backgroundColor: '#ffffff', borderRadius: '12px' }}>
            <div className="flex-1 text-left" style={{ paddingLeft: '32px', paddingRight: '16px' }}>
              <p className="text-gray-800 leading-relaxed" style={{ fontSize: '14px' }}>
                <strong>Welcome back!</strong> Your conversations will be saved automatically. You can access your chat history anytime.
              </p>
            </div>
            <div className="w-[10%] flex justify-start">
              <button
                onClick={handleLogout}
                style={{
                  backgroundColor: 'rgb(220, 38, 38)',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  marginLeft: '-10px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(185, 28, 28)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(220, 38, 38)';
                }}
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}