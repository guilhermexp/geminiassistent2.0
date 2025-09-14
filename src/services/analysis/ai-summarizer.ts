/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {GoogleGenAI} from '@google/genai';

/**
 * Small helper that wraps Gemini generateContent and validates non-empty output.
 */
export async function generateSummary(
  client: GoogleGenAI,
  contents: any,
  generateContentConfig: any,
): Promise<string> {
  const response = await client.models.generateContent({
    ...generateContentConfig,
    contents,
  });
  const text = response.text;
  if (!text?.trim()) {
    throw new Error('A análise retornou um resultado vazio.');
  }
  return text;
}

