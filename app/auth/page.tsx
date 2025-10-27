"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supaBrowser } from "@/lib/supabase/client";
import Image from "next/image";

const RELIGIONS = [
  'Prefer not to say',
  'Agnostic',
  'Atheist',
  'Baha\'i',
  'Buddhist',
  'Christian',
  'Hindu',
  'Jain',
  'Jewish',
  'Muslim',
  'Shinto',
  'Sikh',
  'Taoist',
  'Zoroastrian',
  'Other'
];

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [religion, setReligion] = useState("Prefer not to say");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  const supabase = supaBrowser();

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsLoggedIn(true);
        router.push("/");
      }
    };

    checkSession();
  }, [supabase.auth, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (isSignUp) {
        // Sign up flow
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              preferred_name: preferredName
            }
          }
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          // Create profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: data.user.id,
              email: email,
              full_name: fullName,
              preferred_name: preferredName,
              religion: religion === 'Prefer not to say' ? null : religion
            });

          if (profileError) {
            console.error('Profile creation error:', profileError);
          }

          setError("Check your email to verify your account!");
        }
      } else {
        // Sign in flow
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) throw signInError;

        // Redirect to home
        router.push("/");
      }
    } catch (error: any) {
      setError(error.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoggedIn) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Redirecting...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center" style={{ fontFamily: 'Garamond, serif' }}>
      {/* Background image */}
      <div className="absolute inset-0 -z-10">
        <img
          src="/bg.jpg"
          alt="Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "var(--bg-overlay)" }} />
      </div>

      {/* Auth Form */}
      <div className="w-1/2 max-w-md mx-auto">
        <div className="backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-white/50" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <Image
                src="/qmf-logo.png"
                alt="Question My Faith"
                fill
                sizes="80px"
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
            <h1 className="text-3xl font-bold italic" style={{ color: '#1e3a8a' }}>
              {isSignUp ? "Create Account" : "Welcome Back"}
            </h1>
            <p className="text-gray-700 mt-2 text-sm">
              {isSignUp ? "Sign up to save your conversations" : "Sign in to continue"}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 w-4/5 mx-auto">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={isSignUp}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred Name (optional)
                  </label>
                  <input
                    type="text"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="What should we call you?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Religion (optional)
                  </label>
                  <select
                    value={religion}
                    onChange={(e) => setReligion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    {RELIGIONS.map(rel => (
                      <option key={rel} value={rel}>{rel}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>

            {!isSignUp && (
              <div className="text-sm text-right">
                <button
                  type="button"
                  onClick={() => {
                    // TODO: Implement password reset
                    setError("Password reset not yet implemented. Please contact support.");
                  }}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-colors duration-200 shadow-md hover:shadow-lg"
              style={{ fontWeight: 'bold', fontSize: '16px' }}
            >
              {isLoading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>

          {/* Toggle between Sign In and Sign Up */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                }}
                className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </p>
          </div>

          {/* Back to Home */}
          <div className="mt-4 text-center">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-gray-600 hover:text-gray-800 transition-colors font-medium"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
