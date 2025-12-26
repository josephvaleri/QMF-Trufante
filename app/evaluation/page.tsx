"use client";

import { useState, useEffect } from 'react';
import { supaBrowser } from '@/lib/supabase/client';

interface EvalRun {
  id: number;
  model_version: string;
  eval_set_id: number;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  summary_metrics: {
    total_cases?: number;
    completed_cases?: number;
    passed_automated?: number;
    avg_score?: number;
    pass_rate?: number;
  } | null;
}

interface EvalSet {
  id: number;
  name: string;
  description: string | null;
}

export default function EvaluationPage() {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [sets, setSets] = useState<EvalSet[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = supaBrowser();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Load evaluation runs
      const { data: runsData } = await supabase
        .from('eval_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (runsData) {
        setRuns(runsData as EvalRun[]);
      }

      // Load evaluation sets
      const { data: setsData } = await supabase
        .from('eval_sets')
        .select('*')
        .order('created_at', { ascending: false });

      if (setsData) {
        setSets(setsData as EvalSet[]);
      }
    } catch (error) {
      console.error('Error loading evaluation data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Evaluation Dashboard</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Evaluation Dashboard</h1>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Evaluation Sets</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sets.map((set) => (
            <div key={set.id} className="border p-4 rounded">
              <h3 className="font-semibold">{set.name}</h3>
              {set.description && <p className="text-sm text-gray-600 mt-1">{set.description}</p>}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Evaluation Runs</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">ID</th>
                <th className="border p-2 text-left">Model Version</th>
                <th className="border p-2 text-left">Set ID</th>
                <th className="border p-2 text-left">Status</th>
                <th className="border p-2 text-left">Started</th>
                <th className="border p-2 text-left">Completed</th>
                <th className="border p-2 text-left">Avg Score</th>
                <th className="border p-2 text-left">Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="border p-2">{run.id}</td>
                  <td className="border p-2">{run.model_version}</td>
                  <td className="border p-2">{run.eval_set_id}</td>
                  <td className="border p-2">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        run.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : run.status === 'running'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="border p-2">{new Date(run.started_at).toLocaleString()}</td>
                  <td className="border p-2">
                    {run.completed_at ? new Date(run.completed_at).toLocaleString() : '-'}
                  </td>
                  <td className="border p-2">
                    {run.summary_metrics?.avg_score
                      ? (run.summary_metrics.avg_score * 100).toFixed(1) + '%'
                      : '-'}
                  </td>
                  <td className="border p-2">
                    {run.summary_metrics?.pass_rate
                      ? (run.summary_metrics.pass_rate * 100).toFixed(1) + '%'
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

