"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supaBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { User, Mail, Heart, Shield, LogOut, Save, ArrowLeft } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState({
    preferred_name: "",
    religion: "",
    full_name: ""
  });
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const supabase = supaBrowser();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push('/auth');
          return;
        }

        setUser(user);

        // Fetch profile data
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          setError('Failed to load profile data');
        } else {
          setProfile(profileData);
          setFormData({
            preferred_name: profileData?.preferred_name || "",
            religion: profileData?.religion || "",
            full_name: profileData?.full_name || ""
          });
        }
      } catch (error) {
        console.error('Error:', error);
        setError('An error occurred while loading your profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const supabase = supaBrowser();
      const { error } = await supabase
        .from('profiles')
        .update({
          preferred_name: formData.preferred_name,
          religion: formData.religion,
          full_name: formData.full_name,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      setError(error.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    const supabase = supaBrowser();
    await supabase.auth.signOut();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center">
        <Card className="bg-white/90 backdrop-blur-sm border-orange-200 shadow-xl">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading profile...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return null;
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
              <h1 className="text-orange-900 font-semibold text-lg">My Profile</h1>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Profile Header */}
            <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
              <CardHeader>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-orange-900">
                      {profile?.preferred_name || user.email}
                    </CardTitle>
                    <CardDescription className="text-orange-700">
                      {profile?.role === 'admin' ? 'Administrator' : 
                       profile?.role === 'moderator' ? 'Moderator' : 'User'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
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

            {/* Profile Form */}
            <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-900 flex items-center">
                  <Heart className="w-5 h-5 mr-2" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Update your personal details and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-orange-900">Email Address</Label>
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      value={user.email}
                      disabled
                      className="bg-gray-50 border-gray-300"
                    />
                  </div>
                  <p className="text-xs text-gray-500">Email cannot be changed</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="preferred_name" className="text-orange-900">Preferred Name</Label>
                  <Input
                    id="preferred_name"
                    value={formData.preferred_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, preferred_name: e.target.value }))}
                    placeholder="How should we call you?"
                    className="border-orange-300 focus:border-orange-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-orange-900">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Your full name"
                    className="border-orange-300 focus:border-orange-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="religion" className="text-orange-900">Religion/Faith Tradition</Label>
                  <Input
                    id="religion"
                    value={formData.religion}
                    onChange={(e) => setFormData(prev => ({ ...prev, religion: e.target.value }))}
                    placeholder="Your faith tradition (optional)"
                    className="border-orange-300 focus:border-orange-500"
                  />
                </div>

                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  size="lg"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </CardContent>
            </Card>

            {/* Role Information */}
            {profile?.role && (profile.role === 'moderator' || profile.role === 'admin') && (
              <Card className="bg-gradient-to-r from-orange-50 to-blue-50 border-orange-200">
                <CardHeader>
                  <CardTitle className="text-orange-900 flex items-center">
                    <Shield className="w-5 h-5 mr-2" />
                    Special Access
                  </CardTitle>
                  <CardDescription>
                    You have special privileges on this platform
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="text-sm text-orange-800">
                        {profile.role === 'admin' ? 'Full administrative access' : 'Moderation capabilities'}
                      </span>
                    </div>
                    {profile.role === 'moderator' && (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm text-blue-800">
                          Access to moderation tools and content review
                        </span>
                      </div>
                    )}
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