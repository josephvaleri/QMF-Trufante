"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supaBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { User, LogOut, Shield, Heart, MessageCircle, BookOpen, Users, Trophy } from "lucide-react";

export default function HomePage() {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in and get their profile
    const checkUser = async () => {
      const supabase = supaBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setIsLoggedIn(true);
        setUser(user);
        
        // Get user profile to check role
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        setUserProfile(profile);
      } else {
        setIsLoggedIn(false);
        setUser(null);
        setUserProfile(null);
      }
    };

    checkUser();

    // Listen for auth changes
    const supabase = supaBrowser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setIsLoggedIn(true);
        setUser(session.user);
        
        // Get user profile
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            setUserProfile(profile);
          });
      } else {
        setIsLoggedIn(false);
        setUser(null);
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || isLoading) return;
    
    setIsLoading(true);
    // Navigate to chat page with the question
    router.push(`/chat?q=${encodeURIComponent(question.trim())}`);
  }

  async function handleLogout() {
    const supabase = supaBrowser();
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUser(null);
    setUserProfile(null);
  }

  const isModerator = userProfile?.role === 'moderator' || userProfile?.role === 'admin';

  return (
    <main className="relative min-h-screen w-full">
      {/* Background image */}
      <div className="absolute inset-0 -z-10">
        <img
          src="/bg.jpg"
          alt="Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Header */}
      <header className="relative z-50 bg-white backdrop-blur-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="relative w-8 h-8">
                  <Image
                    src="/qmf-logo.png"
                    alt="Question My Faith"
                    fill
                    sizes="32px"
                    style={{ objectFit: "contain" }}
                    priority
                  />
                </div>
                <h1 className="text-gray-900 font-semibold text-lg">Question My Faith</h1>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center space-x-4">
              {/* Moderation Button for Moderators/Admins */}
              {isModerator && (
                <Button
                  onClick={() => router.push('/moderation')}
                  className="bg-orange-600/90 hover:bg-orange-700/90 text-white border-0"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Moderation
                </Button>
              )}

              {/* Profile Button for Logged In Users */}
              {isLoggedIn ? (
                <div className="flex items-center space-x-3">
                  <Button
                    onClick={() => router.push('/profile')}
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Button>
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => router.push('/auth')}
                  className="bg-orange-600/90 hover:bg-orange-700/90 text-white border-0"
                >
                  Login
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Logo Section */}
      <div className="relative z-10 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <div className="relative w-60 h-60 mx-auto mb-6">
                <Image
                  src="/qmf-logo.png"
                  alt="Question My Faith"
                  fill
                  sizes="240px"
                  style={{ objectFit: "contain" }}
                  priority
                />
              </div>
              <h1 className="text-4xl font-bold text-white mb-4" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>
                How is your faith?
              </h1>
              <p className="text-white/90 text-lg mb-8" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
                A private dialogue to help you explore your spiritual journey
              </p>

              {/* Question Form - Full Width */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="max-w-2xl mx-auto"
              >
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ask about your faith..."
                      disabled={isLoading}
                      rows={4}
                      className="resize-none border-white/30 focus:border-orange-400 bg-white/5 text-white placeholder:text-white/70"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={!question.trim() || isLoading}
                    className="w-full bg-orange-600/90 hover:bg-orange-700/90 text-white border-0"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-5 h-5 mr-2" />
                        Start Conversation
                      </>
                    )}
                  </Button>
                </form>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-400px)]">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Description */}
              <div className="space-y-6">

                {/* Description */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                    <CardContent className="p-6">
                      <p className="text-white/90 text-center leading-relaxed" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
                        <strong>What follows isn't a quiz or sermon.</strong><br />
                        It's a private dialogue meant to help you name<br />
                        where you are in faith and life - at your own pace.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Right Column: Features and Info */}
              <div className="space-y-6">
                {/* Welcome Message for Logged In Users */}
                {isLoggedIn && userProfile && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Card className="bg-white/20 backdrop-blur-sm border-white/30">
                      <CardContent className="p-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                            <Heart className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h2 className="text-xl font-semibold text-white">
                              Welcome back{userProfile.preferred_name ? `, ${userProfile.preferred_name}` : ''}!
                            </h2>
                            <p className="text-white/90">
                              Your spiritual conversations will be saved and you can continue your journey.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Features Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Card className="bg-white/20 backdrop-blur-sm border-white/30 h-full">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center">
                        <BookOpen className="w-5 h-5 mr-2" />
                        Your Spiritual Journey
                      </CardTitle>
                      <CardDescription className="text-white/80">
                        Explore your faith through meaningful conversations
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <MessageCircle className="w-4 h-4 text-blue-300" />
                          </div>
                          <div>
                            <h4 className="font-medium text-white">Private Conversations</h4>
                            <p className="text-sm text-white/80">Your discussions are completely private and personal</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <Heart className="w-4 h-4 text-green-300" />
                          </div>
                          <div>
                            <h4 className="font-medium text-white">No Judgment</h4>
                            <p className="text-sm text-white/80">Explore your questions without fear or pressure</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <Users className="w-4 h-4 text-purple-300" />
                          </div>
                          <div>
                            <h4 className="font-medium text-white">Community Support</h4>
                            <p className="text-sm text-white/80">Connect with others on similar spiritual journeys</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Anonymous User Notice */}
                {!isLoggedIn && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Card className="bg-yellow-500/20 border-yellow-400/30">
                      <CardContent className="p-6">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-4 h-4 text-yellow-300" />
                          </div>
                          <div>
                            <h4 className="font-medium text-white mb-2">Save Your Journey</h4>
                            <p className="text-sm text-white/90 mb-3">
                              <strong>If you answer the above question without logging in,</strong><br />
                              your conversation will not be saved.
                            </p>
                            <Button
                              onClick={() => router.push('/auth')}
                              size="sm"
                              className="bg-orange-600/90 hover:bg-orange-700/90 text-white border-0"
                            >
                              Sign Up to Save Conversations
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}