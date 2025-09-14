/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI} from '@google/genai';
import {isValidUrl} from '../api/youtube-utils';
import type {AnalysisCallbacks, AnalysisResult} from '../../types/types';
import {FileAnalyzer} from './file-analyzer';
import {WebAnalyzer} from './web-analyzer';

// =================================================================
// ANALYSIS SERVICE (Coordinator)
// Delegates to file and web analyzers.
// =================================================================
export class AnalysisService {
  private fileAnalyzer: FileAnalyzer;
  private webAnalyzer: WebAnalyzer;

  constructor(client: GoogleGenAI) {
    this.fileAnalyzer = new FileAnalyzer(client);
    this.webAnalyzer = new WebAnalyzer(client);
  }

  public async analyze(
    urlOrTopic: string,
    file: File | null,
    analysisMode: 'default' | 'vibecode' | 'workflow',
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    if (file) {
      return this.fileAnalyzer.analyzeFile(file, analysisMode, callbacks);
    }
    const input = urlOrTopic.trim();
    if (isValidUrl(input)) {
      return this.webAnalyzer.analyzeUrl(input, analysisMode, callbacks);
    }
    return this.webAnalyzer.performDeepSearch(input, callbacks);
  }
}

