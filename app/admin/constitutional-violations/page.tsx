"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supaBrowser } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ConstitutionalViolation {
  id: number;
  qna_id: number | null;
  question: string;
  original_response: string;
  violations: string[];
  violation_categories: string[] | null;
  replacement_response: string | null;
  detected_at: string;
  model_version: string | null;
}

export default function ConstitutionalViolationsPage() {
  const [violations, setViolations] = useState<ConstitutionalViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [filter, setFilter] = useState<{
    dateFrom?: string;
    dateTo?: string;
    modelVersion?: string;
    category?: string;
  }>({});

  const supabase = supaBrowser();
  const router = useRouter();

  // Check authorization on mount
  useEffect(() => {
    checkAuthorization();
  }, []);

  async function checkAuthorization() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        setError('Access denied. Admin role required.');
        return;
      }

      setAuthorized(true);
      loadViolations();
    } catch (err: any) {
      console.error('Authorization error:', err);
      setError('Failed to verify authorization');
    }
  }

  useEffect(() => {
    if (authorized) {
      loadViolations();
    }
  }, [filter, authorized]);

  async function loadViolations() {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('constitutional_violations')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(100);

      if (filter.dateFrom) {
        query = query.gte('detected_at', filter.dateFrom);
      }
      if (filter.dateTo) {
        query = query.lte('detected_at', filter.dateTo);
      }
      if (filter.modelVersion) {
        query = query.eq('model_version', filter.modelVersion);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Filter by category client-side if needed
      let filtered = data || [];
      if (filter.category && filter.category !== 'all') {
        filtered = filtered.filter(v => 
          v.violation_categories?.includes(filter.category!)
        );
      }

      setViolations(filtered);
    } catch (err: any) {
      console.error('Error loading violations:', err);
      setError(err.message || 'Failed to load violations');
    } finally {
      setLoading(false);
    }
  }

  const uniqueCategories = Array.from(
    new Set(violations.flatMap(v => v.violation_categories || []))
  );

  const uniqueVersions = Array.from(
    new Set(violations.map(v => v.model_version).filter(Boolean) as string[])
  );

  if (!authorized) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Checking authorization...</p>
                </>
              ) : (
                <>
                  <p className="text-red-600 mb-4">{error || 'Access denied'}</p>
                  <Button onClick={() => router.push('/auth')}>Go to Login</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading && violations.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading violations...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Constitutional Violations</CardTitle>
          <CardDescription>
            Monitor violations of constitutional constraints in system responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Date From</label>
              <input
                type="date"
                className="w-full p-2 border rounded"
                value={filter.dateFrom || ''}
                onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date To</label>
              <input
                type="date"
                className="w-full p-2 border rounded"
                value={filter.dateTo || ''}
                onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model Version</label>
              <select
                className="w-full p-2 border rounded"
                value={filter.modelVersion || 'all'}
                onChange={(e) => setFilter({ ...filter, modelVersion: e.target.value === 'all' ? undefined : e.target.value })}
              >
                <option value="all">All Versions</option>
                {uniqueVersions.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                className="w-full p-2 border rounded"
                value={filter.category || 'all'}
                onChange={(e) => setFilter({ ...filter, category: e.target.value === 'all' ? undefined : e.target.value })}
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Violations List */}
          <div className="space-y-4">
            {violations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No violations found</p>
            ) : (
              violations.map((violation) => (
                <Card key={violation.id} className="border-orange-200">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm text-gray-500">
                            {new Date(violation.detected_at).toLocaleString()}
                          </p>
                          {violation.model_version && (
                            <p className="text-sm text-gray-500">Version: {violation.model_version}</p>
                          )}
                          {violation.qna_id && (
                            <p className="text-sm text-gray-500">QnA ID: {violation.qna_id}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {violation.violation_categories?.map(cat => (
                            <span
                              key={cat}
                              className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="font-medium text-sm mb-1">Question:</p>
                        <p className="text-sm bg-gray-50 p-2 rounded">{violation.question}</p>
                      </div>

                      <div>
                        <p className="font-medium text-sm mb-1 text-red-600">Original Response (Violated):</p>
                        <p className="text-sm bg-red-50 p-2 rounded border border-red-200">
                          {violation.original_response.substring(0, 500)}
                          {violation.original_response.length > 500 ? '...' : ''}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-sm mb-1">Violations Detected:</p>
                        <ul className="text-sm list-disc list-inside bg-yellow-50 p-2 rounded">
                          {violation.violations.map((v, idx) => (
                            <li key={idx}>{v}</li>
                          ))}
                        </ul>
                      </div>

                      {violation.replacement_response && (
                        <div>
                          <p className="font-medium text-sm mb-1 text-green-600">Replacement Response:</p>
                          <p className="text-sm bg-green-50 p-2 rounded border border-green-200">
                            {violation.replacement_response}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

