/**
 * Audio Adapter for OpenAI Realtime API
 * Converts between OpenAI's audio format and the app's audio processing
 */

import { AudioService } from './audio-service';
import { OpenAIRealtimeService, OpenAIRealtimeCallbacks } from '../openai/openai-realtime-service';

export interface OpenAIAudioConfig {
  apiKey: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  instructions?: string;
  onTranscript?: (text: string, type: 'partial' | 'final') => void;
  onError?: (error: Error) => void;
  onConnectionStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void;
  onConversationItem?: (item: any) => void;
}

export class OpenAIAudioAdapter {
  private audioService: AudioService;
  private openAIService: OpenAIRealtimeService;
  private isRecording = false;

  constructor(config: OpenAIAudioConfig) {
    // Create OpenAI callbacks
    const callbacks: OpenAIRealtimeCallbacks = {
      onAudioDelta: (base64Audio) => this.handleAudioOutput(base64Audio),
      onTranscript: config.onTranscript,
      onError: config.onError,
      onConnectionStatusChange: config.onConnectionStatusChange,
      onConversationItem: config.onConversationItem,
      onTurnEnd: () => this.handleTurnEnd()
    };

    // Initialize services
    this.openAIService = new OpenAIRealtimeService(
      {
        apiKey: config.apiKey,
        voice: config.voice || 'alloy',
        instructions: config.instructions
      },
      callbacks
    );

    // Create audio service with callback to send audio to OpenAI
    this.audioService = new AudioService({
      onInputAudio: (blob) => this.handleAudioInput(blob)
    });
  }

  /**
   * Connect to OpenAI and prepare audio
   */
  async connect(): Promise<void> {
    await this.openAIService.connect();
  }

  /**
   * Start recording and streaming audio
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) return;
    
    this.isRecording = true;
    await this.audioService.start();
  }

  /**
   * Stop recording
   */
  stopRecording(): void {
    if (!this.isRecording) return;
    
    this.isRecording = false;
    this.audioService.stop();
    
    // Commit any pending audio to OpenAI
    this.openAIService.commitInput();
  }

  /**
   * Handle audio input from microphone
   */
  private handleAudioInput(blob: any): void {
    if (!this.isRecording) return;

    // Convert Float32Array to base64 PCM16
    const float32Data = blob.data as Float32Array;
    const pcm16Data = this.float32ToPCM16(float32Data);
    const base64Audio = this.arrayBufferToBase64(pcm16Data.buffer);
    
    // Send to OpenAI
    this.openAIService.sendAudioInput(base64Audio);
  }

  /**
   * Handle audio output from OpenAI
   */
  private async handleAudioOutput(base64Audio: string): Promise<void> {
    // OpenAI sends PCM16 24kHz mono audio
    // The AudioService expects base64 audio at 24kHz which matches!
    await this.audioService.playAudioChunk(base64Audio);
  }

  /**
   * Handle turn end from OpenAI
   */
  private handleTurnEnd(): void {
    // Could be used to trigger UI updates or other actions
    console.log('OpenAI finished speaking');
  }

  /**
   * Convert Float32Array to PCM16 (Int16Array)
   */
  private float32ToPCM16(float32: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      // Clamp the value between -1 and 1
      let sample = Math.max(-1, Math.min(1, float32[i]));
      // Convert to 16-bit PCM
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    return pcm16;
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Send text message to OpenAI
   */
  sendTextMessage(text: string): void {
    this.openAIService.sendTextInput(text);
  }

  /**
   * Interrupt the current response
   */
  interrupt(): void {
    this.audioService.interruptPlayback();
    this.openAIService.interruptResponse();
  }

  /**
   * Disconnect from OpenAI and cleanup
   */
  disconnect(): void {
    this.stopRecording();
    this.audioService.interruptPlayback();
    this.openAIService.disconnect();
  }

  /**
   * Get audio nodes for visualization
   */
  getAudioNodes(): { inputNode: GainNode; outputNode: GainNode } {
    return {
      inputNode: this.audioService.inputNode,
      outputNode: this.audioService.outputNode
    };
  }

  /**
   * Update OpenAI configuration
   */
  updateConfiguration(updates: Partial<OpenAIAudioConfig>): void {
    if (updates.apiKey || updates.voice || updates.instructions) {
      this.openAIService.updateSession({
        apiKey: updates.apiKey,
        voice: updates.voice,
        instructions: updates.instructions
      });
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.openAIService.getConnectionStatus();
  }

  /**
   * Get buffer information for UI
   */
  getBufferInfo(): { bufferSeconds: number; pendingSeconds: number } {
    return {
      bufferSeconds: this.audioService.getBufferedOutputSeconds(),
      pendingSeconds: this.audioService.getPendingOutputSeconds()
    };
  }

  /**
   * Check if audio is currently playing
   */
  hasActiveOutput(): boolean {
    return this.audioService.hasActiveOutput();
  }
}