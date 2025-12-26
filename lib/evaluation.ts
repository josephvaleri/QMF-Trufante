import { supaServer } from '@/lib/supabase/server';
import { getModelConfigForVersion } from './model-config';
import { openai } from './openai';

export interface EvalCase {
  id: number;
  eval_set_id: number;
  question: string;
  expected_criteria: {
    min_length?: number;
    max_length?: number;
    required_phrases?: string[];
    forbidden_phrases?: string[];
  };
  reference_answer?: string;
}

export interface AutomatedChecks {
  length_ok: boolean;
  required_phrases_found: boolean;
  forbidden_phrases_absent: boolean;
  score: number;
}

/**
 * Run automated checks on a model response
 */
function runAutomatedChecks(
  response: string,
  criteria: EvalCase['expected_criteria']
): AutomatedChecks {
  const checks: AutomatedChecks = {
    length_ok: true,
    required_phrases_found: true,
    forbidden_phrases_absent: true,
    score: 0,
  };

  // Check length bounds
  if (criteria.min_length !== undefined && response.length < criteria.min_length) {
    checks.length_ok = false;
  }
  if (criteria.max_length !== undefined && response.length > criteria.max_length) {
    checks.length_ok = false;
  }

  // Check required phrases
  if (criteria.required_phrases && criteria.required_phrases.length > 0) {
    const responseLower = response.toLowerCase();
    checks.required_phrases_found = criteria.required_phrases.every(phrase =>
      responseLower.includes(phrase.toLowerCase())
    );
  }

  // Check forbidden phrases
  if (criteria.forbidden_phrases && criteria.forbidden_phrases.length > 0) {
    const responseLower = response.toLowerCase();
    checks.forbidden_phrases_absent = !criteria.forbidden_phrases.some(phrase =>
      responseLower.includes(phrase.toLowerCase())
    );
  }

  // Calculate score (0-1): average of all checks
  const checkValues = [
    checks.length_ok ? 1 : 0,
    checks.required_phrases_found ? 1 : 0,
    checks.forbidden_phrases_absent ? 1 : 0,
  ];
  checks.score = checkValues.reduce((sum, val) => sum + val, 0) / checkValues.length;

  return checks;
}

/**
 * Get model response for a question using the specified model version config
 */
async function getModelResponse(question: string, modelVersion: string): Promise<string> {
  const config = await getModelConfigForVersion(modelVersion);
  if (!config) {
    throw new Error(`Model config not found for version ${modelVersion}`);
  }

  // Use the model config to generate response
  // This is a simplified version - in production, you'd reuse logic from /api/ask
  const systemPrompt = process.env.SYSTEM_PROMPT || 'You are a helpful assistant.';
  
  const completion = await openai.chat.completions.create({
    model: config.openai_model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ],
    temperature: config.temperature,
    max_tokens: 500,
  });

  return completion.choices[0]?.message?.content || '';
}

/**
 * Run evaluation for a model version against an evaluation set
 */
export async function runEvaluation(
  modelVersion: string,
  evalSetId: number
): Promise<number> {
  const supabase = supaServer();

  // Create eval_runs row (status='running')
  const { data: evalRun, error: runError } = await supabase
    .from('eval_runs')
    .insert({
      model_version: modelVersion,
      eval_set_id: evalSetId,
      status: 'running',
    })
    .select()
    .single();

  if (runError || !evalRun) {
    throw new Error(`Failed to create eval run: ${runError?.message}`);
  }

  const evalRunId = evalRun.id;

  try {
    // Load eval_cases for set
    const { data: evalCases, error: casesError } = await supabase
      .from('eval_cases')
      .select('*')
      .eq('eval_set_id', evalSetId);

    if (casesError || !evalCases || evalCases.length === 0) {
      throw new Error(`Failed to load eval cases: ${casesError?.message || 'No cases found'}`);
    }

    const results = [];

    // For each case, get model response and run checks
    for (const evalCase of evalCases) {
      try {
        // Get model response
        const modelResponse = await getModelResponse(evalCase.question, modelVersion);

        // Run automated checks
        const checks = runAutomatedChecks(modelResponse, evalCase.expected_criteria);

        // Insert eval_case_results row
        const { error: resultError } = await supabase
          .from('eval_case_results')
          .insert({
            eval_run_id: evalRunId,
            eval_case_id: evalCase.id,
            model_response: modelResponse,
            automated_checks: checks,
            automated_score: checks.score,
          });

        if (resultError) {
          console.error(`Error inserting result for case ${evalCase.id}:`, resultError);
        } else {
          results.push(checks);
        }
      } catch (error) {
        console.error(`Error processing case ${evalCase.id}:`, error);
        // Continue with other cases
      }
    }

    // Calculate summary metrics
    const totalCases = evalCases.length;
    const completedResults = results.length;
    const avgScore = results.length > 0
      ? results.reduce((sum, r) => sum + r.score, 0) / results.length
      : 0;
    const passedAutomated = results.filter(r => r.score >= 0.8).length;

    const summaryMetrics = {
      total_cases: totalCases,
      completed_cases: completedResults,
      passed_automated: passedAutomated,
      avg_score: avgScore,
      pass_rate: completedResults > 0 ? passedAutomated / completedResults : 0,
    };

    // Update eval_runs (status='completed', summary_metrics)
    await supabase
      .from('eval_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        summary_metrics: summaryMetrics,
      })
      .eq('id', evalRunId);

    return evalRunId;
  } catch (error) {
    // Mark run as failed
    await supabase
      .from('eval_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', evalRunId);

    throw error;
  }
}

