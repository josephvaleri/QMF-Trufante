import { readFileSync } from 'fs';
import { join } from 'path';

interface ModerationResult {
  flagged: boolean;
  categories: string[];
  reason: string;
}

class ModerationService {
  private lexicons: Map<string, Set<string>> = new Map();
  private initialized = false;

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^0-9a-z'\-\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async loadLexicon(category: string): Promise<Set<string>> {
    try {
      const filePath = join(process.cwd(), 'moderation_lexicons', `${category}.txt`);
      const content = readFileSync(filePath, 'utf-8');
      const words = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && line.length >= 2 && line.length <= 64);
      return new Set(words);
    } catch (error) {
      console.warn(`Failed to load lexicon ${category}:`, error);
      return new Set();
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const categories = [
      'profanity',
      'sexual',
      'hate_speech',
      'violence',
      'blasphemy',
      'substance',
      'derogatory'
    ];

    await Promise.all(
      categories.map(async (category) => {
        const words = await this.loadLexicon(category);
        this.lexicons.set(category, words);
      })
    );

    this.initialized = true;
    console.log('Moderation service initialized');
  }

  async checkText(text: string): Promise<ModerationResult> {
    await this.initialize();

    const normalizedText = this.normalize(text);
    const words = normalizedText.split(/\s+/);
    const flaggedCategories: string[] = [];
    const flaggedWords: string[] = [];

    for (const [category, wordList] of this.lexicons.entries()) {
      for (const word of words) {
        if (wordList.has(word)) {
          flaggedCategories.push(category);
          flaggedWords.push(word);
        }
      }
    }

    const flagged = flaggedCategories.length > 0;
    const reason = flagged
      ? `Content flagged for: ${[...new Set(flaggedCategories)].join(', ')}. Matched words: ${[...new Set(flaggedWords)].join(', ')}`
      : 'Content is clean';

    return {
      flagged,
      categories: [...new Set(flaggedCategories)],
      reason
    };
  }

  async checkTextBatch(texts: string[]): Promise<ModerationResult[]> {
    await this.initialize();

    return Promise.all(texts.map(text => this.checkText(text)));
  }
}

// Singleton instance
export const moderationService = new ModerationService();

