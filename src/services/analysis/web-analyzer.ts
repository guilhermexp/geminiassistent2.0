/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {GoogleGenAI} from '@google/genai';
import {generateSummary} from './ai-summarizer';
import {fetchWithRetry} from '../../utils/utils';
import {scrapeUrl} from '../api/firecrawl-utils';
import {
  getYouTubeVideoId,
  getYouTubeVideoTitle,
  getYoutubeEmbedUrl,
} from '../api/youtube-utils';
import type {Analysis, AnalysisCallbacks, AnalysisResult} from '../../types/types';

type Mode = 'default' | 'vibecode' | 'workflow';

export class WebAnalyzer {
  constructor(private client: GoogleGenAI) {}

  async analyzeUrl(
    url: string,
    analysisMode: Mode,
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    if (getYouTubeVideoId(url)) {
      return this.analyzeYouTubeUrl(url, analysisMode, callbacks);
    } else if (url.includes('github.com/')) {
      return this.analyzeGitHubUrl(url, callbacks);
    } else if (url.includes('docs.google.com/spreadsheets/')) {
      return this.analyzeGoogleSheetUrl(url, callbacks);
    } else {
      return this.analyzeGenericUrl(url, callbacks);
    }
  }

  async performDeepSearch(
    topic: string,
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    const {setProcessingState, logEvent} = callbacks;
    const contentTitle = topic;
    const contentSource = 'Pesquisa Aprofundada na Web';

    const displayTopic = topic.length > 25 ? `${topic.substring(0, 22)}...` : topic;
    setProcessingState(true, `Pesquisando: "${displayTopic}"`, 50);

    logEvent(`Iniciando pesquisa sobre: "${contentTitle}"`, 'process');
    const analysisPrompt = `Realize uma pesquisa aprofundada e abrangente sobre o seguinte tópico: "${contentTitle}".
Sua tarefa é atuar como um pesquisador especialista. Use o Google Search para reunir informações de diversas fontes confiáveis.
Após a pesquisa, sintetize os resultados em uma análise estruturada e detalhada. A análise deve ser formatada em markdown e cobrir os seguintes pontos:

- **Introdução**: Uma visão geral do tópico.
- **Principais Conceitos**: Definições e explicações dos termos-chave.
- **Estado da Arte**: O status atual, incluindo os desenvolvimentos mais recentes e dados relevantes.
- **Impactos e Implicações**: As consequências positivas e negativas do tópico em diferentes áreas.
- **Desafios e Controvérsias**: Quais são os principais obstáculos, debates ou críticas associados.
- **Perspectivas Futuras**: O que esperar para o futuro, incluindo tendências e previsões.
- **Conclusão**: Um resumo dos pontos mais importantes.

Lembre-se, sua resposta deve ser inteiramente em português do Brasil.`;
    const response = await this.client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: analysisPrompt,
      config: {tools: [{googleSearch: {}}]},
    });
    const summary = response.text;
    if (!summary?.trim()) {
      throw new Error('A pesquisa aprofundada retornou um resultado vazio.');
    }
    return {
      summary,
      title: contentTitle,
      source: contentSource,
      persona: 'assistant',
      type: 'search',
    };
  }

  private async analyzeYouTubeUrl(
    url: string,
    analysisMode: Mode,
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    const {setProcessingState, logEvent} = callbacks;
    setProcessingState(true, 'Buscando informações do vídeo...', 15);
    const title = await getYouTubeVideoTitle(url);
    const embedUrl = getYoutubeEmbedUrl(url);
    setProcessingState(true, 'Analisando vídeo com IA...', 50);
    logEvent(`Analisando YouTube: ${title}`, 'process');

    let analysisPrompt: string;
    let type: Analysis['type'] = 'youtube';
    const generateContentConfig: any = {model: 'gemini-2.5-flash'};

    if (analysisMode === 'vibecode') {
      analysisPrompt = `Você é um especialista em engenharia reversa de interfaces de aplicativos em modo 'Vibecode'. Sua tarefa é analisar o vídeo do YouTube intitulado "${title}", que demonstra o uso de um aplicativo, e fornecer uma análise visual e funcional detalhada, passo a passo, para que um desenvolvedor possa recriar a funcionalidade. Sua resposta deve ser em português do Brasil e estruturada da seguinte forma:\n\n1.  **Visão Geral da Interface (UI):** Descreva o layout principal, paleta de cores, tipografia e componentes visíveis.\n2.  **Fluxo de Interação Passo a Passo:** Narre a jornada do usuário no vídeo. Para cada ação, descreva: Ação do Usuário, Elemento Interagido e Feedback Visual/Resultado.\n3.  **Análise de Ferramentas e Funcionalidades:** Para cada funcionalidade, detalhe: Propósito, Inputs, Lógica Inferida e Outputs.\n\nSeja meticuloso com todos os detalhes visuais. Este resumo será seu único conhecimento sobre o vídeo.`;
    } else if (analysisMode === 'workflow') {
      type = 'workflow';
      generateContentConfig.config = {responseMimeType: 'application/json'};
      analysisPrompt = `Você é um especialista em n8n. Sua tarefa é analisar este vídeo do YouTube intitulado "${title}" que demonstra um fluxo de trabalho (workflow) do n8n e extrair sua estrutura completa. O resultado final DEVE ser um objeto JSON único contendo duas chaves: "summary_base64" e "workflow_json".

1.  **summary_base64**: Crie um resumo detalhado em markdown explicando o propósito geral, cada nó, sua função e como estão conectados. Em seguida, codifique esta string markdown em Base64. Este campo deve conter APENAS a string Base64.
2.  **workflow_json**: Um objeto JSON válido que representa o fluxo de trabalho e pode ser importado diretamente no n8n. Analise meticulosamente os nós, seus parâmetros e as conexões para construir este JSON. Siga a estrutura padrão do n8n com as chaves "name", "nodes", "connections", "active", "settings", etc.

Sua resposta deve ser APENAS o objeto JSON, sem nenhum texto adicional antes ou depois.`;
    } else {
      analysisPrompt = `Você é um assistente multimodal. Analise o vídeo do YouTube intitulado "${title}" a partir da URL fornecida de forma completa, processando tanto o áudio quanto os quadros visuais. Crie um resumo detalhado para que você possa responder perguntas sobre o vídeo. Sua análise deve incluir:
1. **Conteúdo Falado**: Tópicos principais, argumentos e conclusões.
2. **Análise Visual**: Descrição de cenas importantes, pessoas (e suas ações ou aparências, como cor de roupa), objetos, textos na tela e o ambiente geral.
3. **Eventos Chave**: Uma cronologia de eventos importantes, combinando informações visuais e de áudio, com timestamps se possível.

Seja o mais detalhado possível. Este resumo será seu único conhecimento sobre o vídeo. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.`;
    }

    const contents = {
      parts: [
        {text: analysisPrompt},
        {fileData: {mimeType: 'video/mp4', fileUri: url}},
      ],
    };

    const summary = await generateSummary(
      this.client,
      contents,
      generateContentConfig,
    );
    return {
      summary,
      title,
      source: url,
      persona: 'assistant',
      type: type,
      previewData: embedUrl ?? undefined,
    };
  }

  private parseGitHubUrl(url: string) {
    const repoMatch = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (!repoMatch) return null;
    const repoPath = repoMatch[1].replace(/\.git$/, '').replace(/\/$/, '');
    const [owner, repo] = repoPath.split('/');
    return {owner, repo};
  }

  private async fetchGitHubRepoInfo(
    owner: string,
    repo: string,
    callbacks: AnalysisCallbacks,
  ) {
    const {setProcessingState} = callbacks;
    setProcessingState(true, `Buscando README...`, 25);
    const readmeResponse = await fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
    );

    let readmeContent = '';
    if (readmeResponse.ok) {
      const readmeData = await readmeResponse.json();
      readmeContent = atob((readmeData.content || '').replace(/\s/g, ''));
    } else if (readmeResponse.status !== 404) {
      throw new Error(
        `Não foi possível buscar o README do repositório ${owner}/${repo}. Status: ${readmeResponse.status}`,
      );
    }

    setProcessingState(true, `Buscando estrutura de arquivos...`, 40);
    const repoInfoResponse = await fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}`,
    );
    if (repoInfoResponse.status === 404) {
      throw new Error(`Repositório não encontrado ou é privado: ${owner}/${repo}.`);
    }
    if (!repoInfoResponse.ok) {
      throw new Error(
        `Não foi possível buscar informações do repositório ${owner}/${repo}.`,
      );
    }
    const repoInfo = await repoInfoResponse.json();
    const defaultBranch = repoInfo.default_branch;

    const treeResponse = await fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    );
    if (!treeResponse.ok) {
      throw new Error(
        `Não foi possível buscar a estrutura de arquivos de ${owner}/${repo}.`,
      );
    }
    const treeData = await treeResponse.json();
    const fileTreeText = treeData.tree.map((file: any) => file.path).join('\n');

    return {readmeContent, fileTreeText, isTruncated: treeData.truncated};
  }

  private async analyzeGitHubUrl(
    url: string,
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    const {setProcessingState, logEvent} = callbacks;
    const repoParts = this.parseGitHubUrl(url);
    if (!repoParts) {
      throw new Error(
        'URL do GitHub inválida. Use o formato https://github.com/owner/repo.',
      );
    }
    const {owner, repo} = repoParts;
    const contentTitle = `${owner}/${repo}`;
    logEvent(`Iniciando análise do repositório: ${contentTitle}`, 'process');
    const {readmeContent, fileTreeText, isTruncated} = await this.fetchGitHubRepoInfo(
      owner,
      repo,
      callbacks,
    );
    if (isTruncated) {
      logEvent('A estrutura de arquivos é muito grande e foi truncada.', 'info');
    }
    setProcessingState(true, `Analisando com IA...`, 50);
    const analysisPrompt = `Você é um especialista em análise de repositórios do GitHub. Analise o seguinte repositório: "${contentTitle}".
Abaixo estão o conteúdo do arquivo README.md e a estrutura de arquivos do projeto.
Sua tarefa é criar um resumo detalhado para que você possa responder a perguntas sobre o repositório. Sua análise deve incluir:
1. **Propósito do Repositório**: Qual problema ele resolve? Qual é o seu objetivo principal?
2. **Tecnologias Utilizadas**: Com base na estrutura de arquivos e no README, quais são as principais linguagens, frameworks e ferramentas usadas?
3. **Como Começar**: Como um novo desenvolvedor poderia configurar e rodar o projeto?
4. **Estrutura do Projeto**: Descreva a organização das pastas e arquivos importantes.

Seja o mais detalhado possível. Este resumo será seu único conhecimento sobre o repositório. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.

--- CONTEÚDO DO README.md ---
${readmeContent}

--- ESTRUTURA DE ARQUIVOS ---
${fileTreeText}
`;
    const contents = analysisPrompt;
    const generateContentConfig = {model: 'gemini-2.5-flash', config: {tools: [{googleSearch: {}}]}};
    const summary = await generateSummary(this.client, contents, generateContentConfig);
    return {
      summary,
      title: contentTitle,
      source: `GitHub: ${url}`,
      persona: 'assistant',
      type: 'github',
    };
  }

  private async analyzeGoogleSheetUrl(
    url: string,
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    const {setProcessingState, logEvent} = callbacks;
    setProcessingState(true, `Acessando Google Sheet...`, 20);
    logEvent('Analisando Google Sheets', 'process');
    const sheetKeyMatch = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetKeyMatch) {
      throw new Error('URL do Google Sheets inválida.');
    }
    const sheetKey = sheetKeyMatch[1];
    const scrapeResult = await scrapeUrl(url);
    const contentTitle = (scrapeResult.data && scrapeResult.data.metadata.title) || 'Planilha do Google';
    const csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheetKey}/export?format=csv`;
    const response = await fetchWithRetry(csvExportUrl);
    if (!response.ok) {
      throw new Error('Falha ao buscar dados da planilha. Verifique se ela é pública.');
    }
    const csvData = await response.text();
    setProcessingState(true, `Analisando com IA...`, 50);
    const analysisPrompt = `Você é um analista de dados especialista. O seguinte texto contém dados extraídos de uma planilha do Google Sheets, em formato CSV. Sua tarefa é analisar esses dados profundamente. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.

**Análise Requerida:**
1.  **Resumo Geral:** Forneça uma visão geral dos dados.
2.  **Principais Métricas:** Identifique e resuma as métricas chave.
3.  **Insights e Tendências:** Aponte padrões ou tendências importantes.

Prepare-se para responder a perguntas específicas sobre a planilha.

--- CONTEÚDO DA PLANILHA ---
${csvData}`;
    const contents = {parts: [{text: analysisPrompt}]};
    const generateContentConfig = {model: 'gemini-2.5-flash'};
    const summary = await generateSummary(this.client, contents, generateContentConfig);
    return {
      summary,
      title: contentTitle,
      source: url,
      persona: 'analyst',
      type: 'spreadsheet',
    };
  }

  private async analyzeGenericUrl(
    url: string,
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    const {setProcessingState, logEvent} = callbacks;
    const logMsg = url.includes('docs.google.com/document/') ? 'Analisando Google Docs' : `Analisando URL`;
    setProcessingState(true, 'Extraindo conteúdo da URL...', 25);
    logEvent(logMsg, 'process');
    const scrapeResult = await scrapeUrl(url);
    if (!scrapeResult.success || !scrapeResult.data) {
      throw new Error(scrapeResult.error || 'Falha ao extrair conteúdo da URL.');
    }
    const contentTitle = scrapeResult.data.metadata.title || url;
    const scrapedMarkdown = scrapeResult.data.markdown;
    setProcessingState(true, 'Analisando ...', 50);
    const analysisPrompt = `O seguinte é o conteúdo em markdown de uma página da web. Analise-o e extraia um resumo detalhado, os pontos principais e as conclusões. Prepare-se para responder a perguntas sobre ele. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.

--- CONTEÚDO DA PÁGINA ---
${scrapedMarkdown}`;
    const contents = {parts: [{text: analysisPrompt}]};
    const generateContentConfig = {model: 'gemini-2.5-flash'};
    const summary = await generateSummary(this.client, contents, generateContentConfig);
    return {
      summary,
      title: contentTitle,
      source: url,
      persona: 'assistant',
      type: 'url',
    };
  }
}

