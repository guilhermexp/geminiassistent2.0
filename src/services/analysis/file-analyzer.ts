/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {GoogleGenAI} from '@google/genai';
import type {Analysis, AnalysisCallbacks, AnalysisResult} from '../../types/types';
import {generateSummary} from './ai-summarizer';
import {createHtmlPreview, processFileInWorker} from './file-processing';

type Mode = 'default' | 'vibecode' | 'workflow';

export class FileAnalyzer {
  constructor(private client: GoogleGenAI) {}

  async analyzeFile(
    file: File,
    analysisMode: Mode,
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    const {setProcessingState, logEvent} = callbacks;
    const contentTitle = file.name;
    const fileName = file.name.toLowerCase();

    setProcessingState(true, `Processando arquivo...`, 20);
    logEvent(`Processando arquivo: ${contentTitle}`, 'process');

    const processedData = await processFileInWorker(file);
    const {type: processedType, content, mimeType} = processedData;

    let contents: any;
    let persona: Analysis['persona'] = 'assistant';
    let type: Analysis['type'] = 'file';
    let previewData: string | undefined = undefined;
    const generateContentConfig: any = {model: 'gemini-2.5-flash'};

    if (mimeType.startsWith('image/')) {
      setProcessingState(true, `Analisando imagem...`, 50);
      previewData = `data:${mimeType};base64,${content}`;
      const analysisPrompt =
        'Analise esta imagem em detalhes. Descreva todos os elementos visuais, o contexto e quaisquer textos visíveis. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.';
      contents = {
        parts: [
          {text: analysisPrompt},
          {inlineData: {mimeType, data: content}},
        ],
      };
    } else if (mimeType.startsWith('video/')) {
      type = 'video';
      setProcessingState(true, `Analisando vídeo...`, 50);
      previewData = `data:${mimeType};base64,${content}`;
      let analysisPrompt: string;
      if (analysisMode === 'vibecode') {
        type = 'video';
        analysisPrompt = `Você é um especialista em engenharia reversa de interfaces de aplicativos em modo 'Vibecode'. Sua tarefa é analisar este vídeo, que demonstra o uso de um aplicativo, e fornecer uma análise visual e funcional detalhada, passo a passo, para que um desenvolvedor possa recriar a funcionalidade. Sua resposta deve ser em português do Brasil e estruturada da seguinte forma:\n\n1.  **Visão Geral da Interface (UI):** Descreva o layout principal, paleta de cores, tipografia e componentes visíveis.\n2.  **Fluxo de Interação Passo a Passo:** Narre a jornada do usuário no vídeo. Para cada ação, descreva: Ação do Usuário, Elemento Interagido e Feedback Visual/Resultado.\n3.  **Análise de Ferramentas e Funcionalidades:** Para cada funcionalidade, detalhe: Propósito, Inputs, Lógica Inferida e Outputs.\n\nSeja meticuloso com todos os detalhes visuais. Este resumo será seu único conhecimento sobre o vídeo.`;
      } else if (analysisMode === 'workflow') {
        type = 'workflow';
        generateContentConfig.config = {responseMimeType: 'application/json'};
        analysisPrompt = `Você é um especialista em n8n. Sua tarefa é analisar este vídeo que demonstra um fluxo de trabalho (workflow) do n8n e extrair sua estrutura completa. O resultado final DEVE ser um objeto JSON único contendo duas chaves: "summary_base64" e "workflow_json".

1.  **summary_base64**: Crie um resumo detalhado em markdown explicando o propósito geral, cada nó, sua função e como estão conectados. Em seguida, codifique esta string markdown em Base64. Este campo deve conter APENAS a string Base64.
2.  **workflow_json**: Um objeto JSON válido que representa o fluxo de trabalho e pode ser importado diretamente no n8n. Analise meticulosamente os nós, seus parâmetros e as conexões para construir este JSON. Siga a estrutura padrão do n8n com as chaves "name", "nodes", "connections", "active", "settings", etc.

Sua resposta deve ser APENAS o objeto JSON, sem nenhum texto adicional antes ou depois.`;
      } else {
        type = 'video';
        analysisPrompt =
          'Você é um assistente multimodal. Analise este vídeo em detalhes. Descreva todos os elementos visuais e de áudio, o contexto e quaisquer textos visíveis. Crie um resumo detalhado. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.';
      }

      contents = {
        parts: [
          {text: analysisPrompt},
          {inlineData: {mimeType, data: content}},
        ],
      };
    } else if (mimeType === 'application/pdf') {
      setProcessingState(true, `Analisando PDF...`, 50);
      previewData = `data:${mimeType};base64,${content}`;
      const analysisPrompt =
        'Analise este documento PDF. Extraia um resumo detalhado, os pontos principais e quaisquer conclusões importantes. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.';
      contents = {
        parts: [
          {text: analysisPrompt},
          {inlineData: {mimeType, data: content}},
        ],
      };
    } else if (processedType === 'csv') {
      persona = 'analyst';
      type = 'spreadsheet';
      setProcessingState(true, `Analisando planilha...`, 50);
      previewData = createHtmlPreview(content, contentTitle);
      const analysisPrompt = `Você é um analista de dados especialista. O seguinte texto contém dados extraídos de uma planilha, possivelmente com múltiplas abas, em formato CSV. Sua tarefa é analisar esses dados profundamente. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.

**Análise Requerida:**
1.  **Resumo Geral:** Forneça uma visão geral dos dados.
2.  **Estrutura dos Dados:** Identifique as colunas e o tipo de dados que elas contêm.
3.  **Principais Métricas:** Calcule ou identifique métricas importantes (médias, totais, contagens, etc.).
4.  **Insights e Tendências:** Aponte quaisquer padrões, correlações ou tendências interessantes que você observar.

Este resumo detalhado será seu único conhecimento sobre a planilha. Prepare-se para responder a perguntas específicas sobre ela.

--- CONTEÚDO DA PLANILHA ---
${content}`;
      contents = {parts: [{text: analysisPrompt}]};
    } else if (processedType === 'text') {
      let analysisPrompt: string;
      const isXml =
        fileName.endsWith('.xlm') ||
        mimeType === 'application/xml' ||
        mimeType === 'text/xml';
      const isMarkdown =
        fileName.endsWith('.md') || mimeType === 'text/markdown';
      setProcessingState(true, `Analisando documento...`, 50);
      previewData = createHtmlPreview(content, contentTitle);

      if (isXml) {
        analysisPrompt = `Analise este documento XML. Descreva a sua estrutura de dados, \nCampos principais, hierarquia, e quaisquer relações entre elementos. Faça um resumo do conteúdo.`;
      } else if (isMarkdown) {
        analysisPrompt = `Analise este documento Markdown. Extraia um resumo detalhado e os pontos principais.`;
      } else {
        analysisPrompt = `Analise este documento de texto. Forneça um resumo detalhado e destaque os principais pontos.`;
      }
      contents = {
        parts: [
          {text: analysisPrompt},
          {text: content},
        ],
      };
    } else {
      // Fallback for unknown types -> treat as generic file
      setProcessingState(true, `Analisando arquivo...`, 50);
      previewData = createHtmlPreview('Arquivo processado.', contentTitle);
      const analysisPrompt =
        'Analise o conteúdo do arquivo e forneça um resumo detalhado.';
      contents = {parts: [{text: analysisPrompt}]};
    }

    const summary = await generateSummary(
      this.client,
      contents,
      generateContentConfig,
    );

    return {
      summary,
      title: contentTitle,
      source: 'Arquivo Local',
      persona,
      type,
      previewData,
    };
  }
}
