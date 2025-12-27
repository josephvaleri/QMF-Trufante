import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireModerator } from '@/lib/auth-helpers';
import { runEvaluation } from '@/lib/evaluation';

const runEvaluationSchema = z.object({
  model_version: z.string().min(1),
  eval_set_id: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireModerator(request);
    // Parse and validate request body
    const body = await request.json();
    const { model_version, eval_set_id } = runEvaluationSchema.parse(body);

    // Run evaluation
    const evalRunId = await runEvaluation(model_version, eval_set_id);

    return NextResponse.json({
      success: true,
      eval_run_id: evalRunId,
      message: `Evaluation run ${evalRunId} started for model version ${model_version}`,
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('Error running evaluation:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

