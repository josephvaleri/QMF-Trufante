"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supaBrowser } from "@/lib/supabase/client";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { Heart, User, Lock, Mail, Eye, EyeOff } from "lucide-react";

function AuthContent() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const supabase = supaBrowser();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/');
      }
    };
    checkUser();
  }, [supabase.auth, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setSuccess("Login successful! Redirecting...");
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (error: any) {
      setError(error.message || "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Failed to create account');
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          email,
          preferred_name: preferredName,
          role: 'user'
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Don't fail the signup if profile creation fails
      }

      setSuccess("Account created successfully! Please check your email to verify your account.");
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error: any) {
      setError(error.message || "An error occurred during signup");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Please enter your email address first");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      setSuccess("Password reset email sent! Check your inbox.");
    } catch (error: any) {
      setError(error.message || "Failed to send reset email");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="bg-white/90 backdrop-blur-sm border-orange-200 shadow-xl">
          <CardHeader className="text-center pb-6">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <Image
                src="/qmf-logo.png"
                alt="Question My Faith"
                fill
                sizes="64px"
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
            <CardTitle className="text-2xl font-bold text-orange-900">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </CardTitle>
            <CardDescription className="text-orange-700">
              {isLogin 
                ? 'Sign in to save your spiritual conversations' 
                : 'Optional - you can use the chat without an account'
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
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

            {/* Form */}
            <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-orange-900">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 border-orange-300 focus:border-orange-500"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-orange-900">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10 pr-10 border-orange-300 focus:border-orange-500"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="preferredName" className="text-orange-900">Preferred Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="preferredName"
                      type="text"
                      value={preferredName}
                      onChange={(e) => setPreferredName(e.target.value)}
                      required
                      className="pl-10 border-orange-300 focus:border-orange-500"
                      placeholder="How should we call you?"
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-orange-600 hover:bg-orange-700"
                size="lg"
              >
                {isLoading 
                  ? (isLogin ? 'Signing in...' : 'Creating account...') 
                  : (isLogin ? 'Sign In' : 'Create Account')
                }
              </Button>
            </form>

            {/* Forgot Password */}
            {isLogin && (
              <div className="text-center">
                <Button
                  onClick={handleForgotPassword}
                  variant="link"
                  className="text-orange-600 hover:text-orange-800"
                >
                  Forgot your password?
                </Button>
              </div>
            )}

            <Separator className="my-6" />

            {/* Toggle between login/signup */}
            <div className="text-center">
              <Button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                  setSuccess("");
                }}
                variant="outline"
                className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                {isLogin 
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Sign in"
                }
              </Button>
            </div>

            {/* Continue without account */}
            <div className="text-center">
              <Button
                onClick={() => router.push('/')}
                variant="ghost"
                className="text-gray-600 hover:text-gray-800"
              >
                Continue without account
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center">
        <Card className="bg-white/90 backdrop-blur-sm border-orange-200 shadow-xl">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}