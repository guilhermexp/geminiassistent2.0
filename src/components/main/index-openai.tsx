/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Modified version with OpenAI Realtime API support
 */

import {GoogleGenAI, LiveServerMessage, Modality, Session} from '@google/genai';
import {LitElement, css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';

import type {
  Analysis,
  ProcessingState,
  SearchResult,
  TimelineEvent,
  AnalysisCallbacks,
  SavedSession,
} from '../../types/types';

// Import the new shell and view components
import '../shell/assistant-shell';
import '../views/assistant-view';

// Import sub-components that are passed as slots or used directly
import '../modals/analysis-modal';
import '../modals/history-modal';

// Refactored logic handlers
import {ContentAnalysisManager} from '../../services/analysis/content-analysis-manager';
import {generateCompositeSystemInstruction} from '../../services/analysis/system-instruction-builder';
import {AudioService} from '../../services/audio/audio-service';

// Import OpenAI adapter
import {OpenAIAudioAdapter} from '../../services/audio/openai-audio-adapter';

const LOCAL_STORAGE_KEY = 'gemini-live-sessions';
const PROVIDER_KEY = 'voice-provider';

export type VoiceProvider = 'gemini' | 'openai';

@customElement('gdm-live-audio-openai')
export class GdmLiveAudioOpenAI extends LitElement {
  @state() isRecording = false;
  @state() status = '';
  @state() error = '';
  @state() processingState: ProcessingState = {
    active: false,
    step: '',
    progress: 0,
  };
  @state() showAnalysisPanel = false;
  @state() showTimelineModal = false;
  @state() showHistoryModal = false;
  @state() searchResults: SearchResult[] = [];
  @state() timelineEvents: TimelineEvent[] = [];
  @state() analyses: Analysis[] = [];
  @state() savedSessions: SavedSession[] = [];
  @state() systemInstruction =
    'Você é um assistente de voz prestativo que fala português do Brasil. Você não tem a capacidade de pesquisar na internet.';
  @state() inputNode?: GainNode;
  @state() outputNode?: GainNode;
  @state() activePersona: string | null = null;
  @state() bufferSeconds = 0;
  @state() retryCount = 0;
  @state() connecting = false;
  @state() pendingSeconds = 0;
  @state() voiceProvider: VoiceProvider = (process.env.DEFAULT_VOICE_PROVIDER as VoiceProvider) || 'openai';

  // Gemini-specific properties
  private client: GoogleGenAI;
  private session: Session;
  private contentAnalysisManager: ContentAnalysisManager;
  private audioService: AudioService;
  
  // OpenAI-specific properties
  private openAIAdapter: OpenAIAudioAdapter | null = null;
  
  // Common properties
  private readonly CONTEXT_WINDOW_SIZE = 1_000_000;
  private lastLoggedSources = '';
  private sessionGenCounter = 0;
  private currentSessionGen = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private isConnecting = false;
  private lastInterruptAt = 0;
  private healthTimer: number | null = null;
  private lastBufferState: 'healthy' | 'warn' | 'err' | 'high' | 'normal' | 'idle' | null = null;
  private lastConnectingState: boolean | null = null;
  private stopAutoReconnect = false;
  private currentModel: string | null = null;
  private unsupportedModels = new Set<string>();
  private sessionOpen = false;
  private models: string[] = [];

  static styles = css`
    :host {
      width: 100vw;
      height: 100vh;
      display: block;
    }
  `;

  constructor() {
    super();
    
    // Load saved provider preference
    const savedProvider = localStorage.getItem(PROVIDER_KEY) as VoiceProvider;
    if (savedProvider === 'gemini' || savedProvider === 'openai') {
      this.voiceProvider = savedProvider;
    }
    
    // Initialize Gemini client (still needed for content analysis)
    this.client = new GoogleGenAI({
      apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || '',
    });
    this.contentAnalysisManager = new ContentAnalysisManager(this.client);
    
    // Initialize based on provider
    if (this.voiceProvider === 'openai') {
      this.initOpenAI();
    } else {
      this.initGemini();
    }
    
    // Configure model fallback order
    const envModels = (process.env.LIVE_MODELS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const defaultModels = [
      'gemini-live-2.5-flash',
      'gemini-live-2.0-flash',
      'gemini-live-1.5-flash-8b',
    ];
    const LAST_MODEL_KEY = 'gemini-last-model';
    const configured = envModels.length ? envModels : defaultModels;
    const last = localStorage.getItem(LAST_MODEL_KEY);
    this.models = last && configured.includes(last)
      ? [last, ...configured.filter((m) => m !== last)]
      : configured;
    
    this.logEvent('Assistente inicializado com ' + this.voiceProvider.toUpperCase(), 'info');
    this.loadSessionsFromStorage();
    this.initSession();
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  private initOpenAI() {
    const apiKey = process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      this.error = 'OpenAI API key não configurada';
      this.logEvent('Erro: OpenAI API key ausente', 'error');
      return;
    }
    
    this.openAIAdapter = new OpenAIAudioAdapter({
      apiKey: apiKey,
      voice: (process.env.OPENAI_VOICE as any) || 'nova',
      instructions: this.systemInstruction,
      onTranscript: (text, type) => {
        if (type === 'final') {
          this.logEvent(`Transcrição: ${text}`, 'transcript');
        }
      },
      onError: (error) => {
        this.error = error.message;
        this.logEvent(`Erro OpenAI: ${error.message}`, 'error');
      },
      onConnectionStatusChange: (status) => {
        this.connecting = status === 'connecting';
        this.updateStatus(
          status === 'connecting' ? 'Conectando ao OpenAI...' :
          status === 'connected' ? 'Conectado ao OpenAI' :
          'Desconectado'
        );
      },
      onConversationItem: (item) => {
        // Handle conversation updates if needed
        console.log('Conversation item:', item);
      }
    });
    
    // Get audio nodes for visualization
    if (this.openAIAdapter) {
      const nodes = this.openAIAdapter.getAudioNodes();
      this.inputNode = nodes.inputNode;
      this.outputNode = nodes.outputNode;
    }
  }

  private initGemini() {
    this.audioService = new AudioService({
      onInputAudio: (audioBlob) => {
        if (this.sessionOpen && this.isRecording) {
          try {
            this.session.sendRealtimeInput({media: audioBlob});
          } catch (err) {
            this.sessionOpen = false;
          }
        }
      },
    });
    
    this.inputNode = this.audioService.inputNode;
    this.outputNode = this.audioService.outputNode;
  }

  private startHealthMonitoring() {
    this.healthTimer = window.setInterval(() => {
      if (this.voiceProvider === 'openai' && this.openAIAdapter) {
        const bufferInfo = this.openAIAdapter.getBufferInfo();
        this.bufferSeconds = bufferInfo.bufferSeconds;
        this.pendingSeconds = bufferInfo.pendingSeconds;
      } else if (this.audioService) {
        this.bufferSeconds = this.audioService.getBufferedOutputSeconds();
        this.pendingSeconds = this.audioService.getPendingOutputSeconds();
      }
      
      this.retryCount = this.reconnectAttempts;
      
      // Log connection state changes
      if (this.lastConnectingState !== this.connecting) {
        this.lastConnectingState = this.connecting;
        this.logEvent(
          this.connecting ? 'Estado de conexão: Conectando...' : 'Estado de conexão: Conectado.',
          this.connecting ? 'info' : 'connect',
        );
      }
      
      // Monitor buffer health
      const ms = Math.round(this.bufferSeconds * 1000);
      const activeOutput = this.voiceProvider === 'openai' 
        ? this.openAIAdapter?.hasActiveOutput() || false
        : this.audioService?.hasActiveOutput() || false;
      
      const state: typeof this.lastBufferState = !activeOutput && ms === 0
        ? 'idle'
        : ms < 60
        ? 'err'
        : ms < 120
        ? 'warn'
        : ms > 500
        ? 'high'
        : ms >= 200 && ms <= 350
        ? 'healthy'
        : 'normal';
      
      if (state !== this.lastBufferState) {
        this.lastBufferState = state;
        switch (state) {
          case 'healthy':
            this.logEvent(`Buffer saudável: ${ms} ms`, 'info');
            break;
          case 'warn':
            this.logEvent(`Buffer baixo: ${ms} ms`, 'info');
            break;
          case 'err':
            this.logEvent(`Buffer crítico: ${ms} ms`, 'error');
            break;
          case 'high':
            this.logEvent(`Buffer alto: ${ms} ms`, 'info');
            break;
        }
      }
    }, 500);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    
    if (this.voiceProvider === 'openai' && this.openAIAdapter) {
      this.openAIAdapter.disconnect();
    }
  }

  private logEvent(message: string, type: TimelineEvent['type']) {
    const timestamp = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const newEvent: TimelineEvent = {timestamp, message, type};
    const MAX_EVENTS = 300;
    const next = [newEvent, ...this.timelineEvents];
    this.timelineEvents = next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
  }

  private async initSession(newSystemInstruction?: string) {
    this.systemInstruction =
      newSystemInstruction ||
      generateCompositeSystemInstruction(this.analyses, this.activePersona);
    
    if (this.voiceProvider === 'openai') {
      await this.initOpenAISession();
    } else {
      await this.initGeminiSession();
    }
  }

  private async initOpenAISession() {
    if (!this.openAIAdapter) {
      this.initOpenAI();
      if (!this.openAIAdapter) return;
    }
    
    this.updateStatus('Conectando ao OpenAI...');
    this.isConnecting = true;
    
    try {
      // Update instructions
      this.openAIAdapter.updateConfiguration({
        instructions: this.systemInstruction
      });
      
      // Connect to OpenAI
      await this.openAIAdapter.connect();
      
      this.isConnecting = false;
      this.updateStatus('Conectado ao OpenAI');
      this.logEvent('Sessão OpenAI iniciada', 'connect');
    } catch (error) {
      this.isConnecting = false;
      this.error = 'Falha ao conectar com OpenAI';
      this.logEvent(`Erro ao conectar: ${error}`, 'error');
      this.updateStatus('Erro na conexão');
    }
  }

  private async initGeminiSession() {
    // Existing Gemini session initialization code
    // ... (keep the existing Gemini logic here)
    this.logEvent('Usando sessão Gemini (implementação existente)', 'info');
  }

  async toggleRecording() {
    if (this.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording() {
    if (this.voiceProvider === 'openai' && this.openAIAdapter) {
      try {
        await this.openAIAdapter.startRecording();
        this.isRecording = true;
        this.updateStatus('Gravando...');
        this.logEvent('Gravação iniciada (OpenAI)', 'info');
      } catch (error) {
        this.error = 'Erro ao iniciar gravação';
        this.logEvent(`Erro: ${error}`, 'error');
      }
    } else if (this.audioService) {
      // Existing Gemini recording logic
      await this.audioService.start();
      this.isRecording = true;
      this.updateStatus('Gravando...');
      this.logEvent('Gravação iniciada (Gemini)', 'info');
    }
  }

  private async stopRecording() {
    if (this.voiceProvider === 'openai' && this.openAIAdapter) {
      this.openAIAdapter.stopRecording();
      this.isRecording = false;
      this.updateStatus('Gravação parada');
      this.logEvent('Gravação parada (OpenAI)', 'info');
    } else if (this.audioService) {
      // Existing Gemini stop logic
      this.audioService.stop();
      this.isRecording = false;
      this.updateStatus('Gravação parada');
      this.logEvent('Gravação parada (Gemini)', 'info');
    }
  }

  switchProvider(provider: VoiceProvider) {
    if (provider === this.voiceProvider) return;
    
    // Stop current session
    this.stopRecording();
    
    if (this.voiceProvider === 'openai' && this.openAIAdapter) {
      this.openAIAdapter.disconnect();
      this.openAIAdapter = null;
    }
    
    // Save preference
    localStorage.setItem(PROVIDER_KEY, provider);
    this.voiceProvider = provider;
    
    // Initialize new provider
    if (provider === 'openai') {
      this.initOpenAI();
    } else {
      this.initGemini();
    }
    
    this.logEvent(`Mudado para provedor: ${provider.toUpperCase()}`, 'info');
    this.initSession();
  }

  private updateStatus(message: string) {
    this.status = message;
  }

  private loadSessionsFromStorage() {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        this.savedSessions = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  }

  render() {
    return html`
      <gdm-assistant-shell>
        <gdm-assistant-view
          .isRecording=${this.isRecording}
          .status=${this.status}
          .error=${this.error}
          .processingState=${this.processingState}
          .showAnalysisPanel=${this.showAnalysisPanel}
          .searchResults=${this.searchResults}
          .timelineEvents=${this.timelineEvents}
          .analyses=${this.analyses}
          .savedSessions=${this.savedSessions}
          .systemInstruction=${this.systemInstruction}
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}
          .activePersona=${this.activePersona}
          .bufferSeconds=${this.bufferSeconds}
          .retryCount=${this.retryCount}
          .connecting=${this.connecting}
          .pendingSeconds=${this.pendingSeconds}
          .voiceProvider=${this.voiceProvider}
          @start-recording=${this.startRecording}
          @stop-recording=${this.stopRecording}
        >
        </gdm-assistant-view>
      </gdm-assistant-shell>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-live-audio-openai': GdmLiveAudioOpenAI;
  }
}
