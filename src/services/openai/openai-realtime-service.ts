/**
 * OpenAI Realtime API Service
 * Handles WebSocket connection and communication with OpenAI's Realtime API
 */

export interface OpenAIRealtimeConfig {
  apiKey: string;
  model?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  instructions?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface OpenAIRealtimeCallbacks {
  onAudioDelta?: (base64Audio: string) => void;
  onTranscript?: (text: string, type: 'partial' | 'final') => void;
  onError?: (error: Error) => void;
  onConnectionStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void;
  onConversationItem?: (item: any) => void;
  onTurnEnd?: () => void;
}

interface ServerEvent {
  type: string;
  [key: string]: any;
}

interface ClientEvent {
  type: string;
  [key: string]: any;
}

export class OpenAIRealtimeService {
  private ws: WebSocket | null = null;
  private config: OpenAIRealtimeConfig;
  private callbacks: OpenAIRealtimeCallbacks;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private sessionId: string | null = null;
  private conversationId: string | null = null;

  constructor(config: OpenAIRealtimeConfig, callbacks: OpenAIRealtimeCallbacks = {}) {
    this.config = {
      model: 'gpt-4o-realtime-preview-2024-12-17',
      voice: 'alloy',
      temperature: 0.8,
      ...config
    };
    this.callbacks = callbacks;
  }

  /**
   * Connect to OpenAI Realtime API via WebSocket
   */
  async connect(): Promise<void> {
    if (this.ws && this.isConnected) {
      console.log('Already connected to OpenAI Realtime API');
      return;
    }

    this.callbacks.onConnectionStatusChange?.('connecting');

    try {
      // Prefer a proxy URL when available to avoid sending headers from the browser.
      let wsUrl = (process.env.OPENAI_REALTIME_URL as string) || '';
      const model = this.config.model;
      if (wsUrl) {
        // If not an absolute ws(s) URL, prefix with current origin.
        const isAbsoluteWs = /^wss?:\/\//i.test(wsUrl);
        if (!isAbsoluteWs && typeof window !== 'undefined') {
          const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${proto}//${window.location.host}${wsUrl}`;
        }
        wsUrl += (wsUrl.includes('?') ? '&' : '?') + `model=${model}`;
      } else {
        wsUrl = `wss://api.openai.com/v1/realtime?model=${model}`;
      }

      // In Node contexts we can attach headers directly. In browsers, connect via proxy.
      const isDirectOpenAI = /api\.openai\.com\/v1\/realtime/i.test(wsUrl);
      const isBrowser = typeof window !== 'undefined';
      if (isDirectOpenAI && !isBrowser) {
        this.ws = new WebSocket(wsUrl, {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        } as any);
      } else {
        this.ws = new WebSocket(wsUrl);
      }

      this.setupEventHandlers();
      
      await this.waitForConnection();
      
      // Configure session after connection
      await this.configureSession();
      
    } catch (error) {
      console.error('Failed to connect to OpenAI Realtime API:', error);
      this.callbacks.onError?.(error as Error);
      this.handleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('Connected to OpenAI Realtime API');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.callbacks.onConnectionStatusChange?.('connected');
    };

    this.ws.onclose = (event) => {
      console.log('Disconnected from OpenAI Realtime API:', event.code, event.reason);
      this.isConnected = false;
      this.callbacks.onConnectionStatusChange?.('disconnected');
      
      if (!event.wasClean) {
        this.handleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.callbacks.onError?.(new Error('WebSocket connection error'));
    };

    this.ws.onmessage = (event) => {
      try {
        const serverEvent: ServerEvent = JSON.parse(event.data);
        this.handleServerEvent(serverEvent);
      } catch (error) {
        console.error('Failed to parse server event:', error);
      }
    };
  }

  private handleServerEvent(event: ServerEvent): void {
    switch (event.type) {
      case 'session.created':
        this.sessionId = event.session?.id;
        console.log('Session created:', this.sessionId);
        break;

      case 'conversation.created':
        this.conversationId = event.conversation?.id;
        break;

      case 'response.audio_transcript.delta':
        this.callbacks.onTranscript?.(event.delta, 'partial');
        break;

      case 'response.audio_transcript.done':
        this.callbacks.onTranscript?.(event.transcript, 'final');
        break;

      case 'response.audio.delta':
        // Audio comes as base64 encoded PCM16 24kHz mono
        if (event.delta) {
          this.callbacks.onAudioDelta?.(event.delta);
        }
        break;

      case 'response.done':
        this.callbacks.onTurnEnd?.();
        break;

      case 'conversation.item.created':
      case 'conversation.item.truncated':
      case 'conversation.item.deleted':
        this.callbacks.onConversationItem?.(event.item);
        break;

      case 'error':
        console.error('Server error:', event.error);
        this.callbacks.onError?.(new Error(event.error?.message || 'Unknown server error'));
        break;

      default:
        // Handle other event types as needed
        console.log('Unhandled event type:', event.type);
    }
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      const checkConnection = setInterval(() => {
        if (this.isConnected) {
          clearInterval(checkConnection);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });
  }

  private async configureSession(): Promise<void> {
    const sessionConfig: ClientEvent = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.config.instructions || 'You are a helpful voice assistant.',
        voice: this.config.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        temperature: this.config.temperature,
        max_response_output_tokens: this.config.maxTokens || 4096
      }
    };

    this.sendEvent(sessionConfig);
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.callbacks.onError?.(new Error('Failed to reconnect after multiple attempts'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Send audio input to the API
   * @param audioData PCM16 16kHz mono audio data as base64
   */
  sendAudioInput(audioData: string): void {
    if (!this.isConnected) {
      console.warn('Not connected to OpenAI Realtime API');
      return;
    }

    const event: ClientEvent = {
      type: 'input_audio_buffer.append',
      audio: audioData
    };

    this.sendEvent(event);
  }

  /**
   * Send text input to the API
   */
  sendTextInput(text: string): void {
    if (!this.isConnected) {
      console.warn('Not connected to OpenAI Realtime API');
      return;
    }

    const event: ClientEvent = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: text
        }]
      }
    };

    this.sendEvent(event);
    this.commitInput();
  }

  /**
   * Commit the input buffer and trigger a response
   */
  commitInput(): void {
    const event: ClientEvent = {
      type: 'input_audio_buffer.commit'
    };
    this.sendEvent(event);

    // Trigger response generation
    this.sendEvent({ type: 'response.create' });
  }

  /**
   * Interrupt the current response
   */
  interruptResponse(): void {
    if (!this.isConnected) return;

    const event: ClientEvent = {
      type: 'response.cancel'
    };

    this.sendEvent(event);
  }

  /**
   * Clear the input audio buffer
   */
  clearInputBuffer(): void {
    const event: ClientEvent = {
      type: 'input_audio_buffer.clear'
    };
    this.sendEvent(event);
  }

  private sendEvent(event: ClientEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not ready, cannot send event:', event.type);
      return;
    }

    try {
      this.ws.send(JSON.stringify(event));
    } catch (error) {
      console.error('Failed to send event:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  /**
   * Disconnect from the API
   */
  disconnect(): void {
    if (this.ws) {
      this.isConnected = false;
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
      this.sessionId = null;
      this.conversationId = null;
    }
  }

  /**
   * Update session configuration
   */
  updateSession(updates: Partial<OpenAIRealtimeConfig>): void {
    Object.assign(this.config, updates);
    
    if (this.isConnected) {
      this.configureSession();
    }
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Add function calling capability
   */
  registerFunction(name: string, description: string, parameters: any): void {
    const event: ClientEvent = {
      type: 'session.update',
      session: {
        tools: [{
          type: 'function',
          name: name,
          description: description,
          parameters: parameters
        }]
      }
    };

    this.sendEvent(event);
  }
}
