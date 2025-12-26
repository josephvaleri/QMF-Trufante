import { openai } from './openai';
import { supaServer } from '@/lib/supabase/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CuratedQnARow {
  id: number;
  qna_id: number;
  question: string;
  answer: string;
}

/**
 * Build a knowledge pack markdown document from curated Q&A pairs
 */
export function buildKnowledgePack(
  curatedItems: CuratedQnARow[],
  version: string,
  frameworkText?: string
): string {
  const timestamp = new Date().toISOString();
  const frameworkSection = frameworkText
    ? `## Framework & Guidelines\n\n${frameworkText}\n\n`
    : '## Framework & Guidelines\n\nRefer to SYSTEM_PROMPT environment variable for framework and guidelines.\n\n';

  const qaSection = curatedItems
    .map((item) => `### Q: ${item.question}\n\nA: ${item.answer}`)
    .join('\n\n');

  const markdown = `# QMF Knowledge Pack v${version}
Created: ${timestamp}
Curated Q&A Pairs: ${curatedItems.length}

${frameworkSection}## Curated Q&A Examples

${qaSection}
`;

  return markdown;
}

/**
 * Upload a knowledge pack markdown document to OpenAI and add to vector store
 */
export async function uploadKnowledgePack(
  markdown: string,
  vectorStoreId: string,
  fileName: string = 'knowledge-pack.md'
): Promise<string> {
  // Create temporary file
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `${fileName}-${Date.now()}.md`);

  try {
    // Write markdown to temp file
    fs.writeFileSync(tempFilePath, markdown, 'utf8');

    // Upload to OpenAI files API
    const file = await openai.files.create({
      file: fs.createReadStream(tempFilePath),
      purpose: 'assistants',
    });

    // Add to vector store
    await openai.beta.vectorStores.files.create(vectorStoreId, {
      file_id: file.id,
    });

    return file.id;
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

/**
 * Create a new vector store for a model version
 */
export async function createVectorStoreForVersion(version: string): Promise<string> {
  const vectorStore = await openai.beta.vectorStores.create({
    name: `QMF v${version}`,
  });

  return vectorStore.id;
}

/**
 * Track a vector store file in the database
 */
export async function trackVectorStoreFile(
  fileId: string,
  vectorStoreId: string,
  knowledgePackId?: number,
  modelVersion?: string,
  fileName?: string
): Promise<void> {
  const supabase = supaServer();

  await supabase.from('vector_store_files').insert({
    file_id: fileId,
    vector_store_id: vectorStoreId,
    knowledge_pack_id: knowledgePackId || null,
    model_version: modelVersion || null,
    file_name: fileName || null,
    is_active: true,
  });
}

