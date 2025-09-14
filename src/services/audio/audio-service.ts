/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {createBlob, decode, decodeAudioData} from '../../utils/utils';
import type {Blob} from '@google/genai';

interface AudioServiceOptions {
  onInputAudio: (blob: Blob) => void;
}

const pcmProcessorWorklet = `
class PcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    // We expect one input, with one channel, of Float32Array data.
    const inputChannelData = inputs[0]?.[0];

    // If there's no data, don't do anything.
    if (inputChannelData) {
      // Post the raw PCM data back to the main thread.
      // The data is a Float32Array, which will be cloned.
      this.port.postMessage(inputChannelData);
    }
    
    return true; // Keep processor alive
  }
}

registerProcessor('pcm-processor', PcmProcessor);
`;

/**
 * Encapsulates all Web Audio API logic for microphone input and audio output.
 */
export class AudioService {
  private onInputAudio: (blob: Blob) => void;

  // Public nodes for visualizers
  public readonly inputNode: GainNode;
  public readonly outputNode: GainNode;

  // Private audio contexts and nodes
  private inputAudioContext: AudioContext;
  private outputAudioContext: AudioContext;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private outputSources = new Set<AudioBufferSourceNode>();
  private nextStartTime = 0;
  private workletModuleAdded = false;
  // Input batching state (40ms @16kHz => 640 samples)
  private readonly INPUT_SAMPLE_RATE = 16000;
  private readonly INPUT_BATCH_SAMPLES = 640;
  private pendingInputChunks: Float32Array[] = [];
  private pendingSamples = 0;
  // Output pacing state
  private readonly OUTPUT_SAMPLE_RATE = 24000;
  private readonly START_PREBUFFER_SEC = 0.25;
  private readonly MAX_BUFFER_SEC = 0.35;
  private readonly SCHEDULE_MARGIN_SEC = 0.05;
  private outputPendingBase64: string[] = [];
  private schedulingOutput = false;

  constructor(options: AudioServiceOptions) {
    this.onInputAudio = options.onInputAudio;

    this.inputAudioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)({sampleRate: 16000});
    this.outputAudioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)({sampleRate: 24000});

    this.inputNode = this.inputAudioContext.createGain();
    this.outputNode = this.outputAudioContext.createGain();

    this.outputNode.connect(this.outputAudioContext.destination);
    this.nextStartTime = this.outputAudioContext.currentTime;
  }

  /**
   * Requests microphone access and starts capturing audio.
   */
  public async start(): Promise<void> {
    if (this.mediaStream) {
      return; // Already started
    }

    if (this.inputAudioContext.state === 'suspended') {
      await this.inputAudioContext.resume();
    }

    if (!this.inputAudioContext.audioWorklet) {
      throw new Error('AudioWorklet is not supported by this browser.');
    }

    if (!this.workletModuleAdded) {
      const blob = new Blob([pcmProcessorWorklet], {
        type: 'application/javascript',
      });
      const workletURL = URL.createObjectURL(blob);

      try {
        await this.inputAudioContext.audioWorklet.addModule(workletURL);
        this.workletModuleAdded = true;
      } catch (e) {
        console.error('Error adding audio worklet module', e);
        throw e;
      } finally {
        URL.revokeObjectURL(workletURL);
      }
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
      },
      video: false,
    });

    this.sourceNode = this.inputAudioContext.createMediaStreamSource(
      this.mediaStream,
    );

    this.audioWorkletNode = new AudioWorkletNode(
      this.inputAudioContext,
      'pcm-processor',
    );

    this.audioWorkletNode.port.onmessage = (event) => {
      const pcmData: Float32Array = event.data; // Float32Array
      this.enqueueInput(pcmData);
      this.drainInputBatches();
    };

    // The visualizer taps into `inputNode`. The worklet also gets data from it.
    this.sourceNode.connect(this.inputNode);
    this.inputNode.connect(this.audioWorkletNode);
    // The worklet node does not need to be connected to the destination.
    // This prevents microphone feedback.
  }

  /**
   * Stops capturing audio and releases the microphone.
   */
  public stop(): void {
    if (!this.mediaStream) return;

    if (this.audioWorkletNode) {
      // Flush any remaining input
      this.flushPendingInput();
      this.audioWorkletNode.port.onmessage = null;
      // Disconnect the input node from the worklet, leaving other connections intact
      this.inputNode.disconnect(this.audioWorkletNode);
      this.audioWorkletNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  /**
   * Decodes and schedules a chunk of audio data for playback.
   * @param base64Data The base64-encoded audio data to play.
   */
  public async playAudioChunk(base64Data: string): Promise<void> {
    // Enqueue and schedule when there is room to keep latency low
    this.outputPendingBase64.push(base64Data);
    this.scheduleOutputIfNeeded();
  }

  /**
   * Immediately stops all scheduled audio playback.
   */
  public interruptPlayback(): void {
    for (const source of this.outputSources.values()) {
      source.stop();
      this.outputSources.delete(source);
    }
    this.nextStartTime = 0;
    // Drop any queued audio to prioritize barge-in
    this.outputPendingBase64 = [];
  }

  /**
   * Returns the number of seconds of audio currently scheduled ahead of
   * the AudioContext's current time. Useful for UI health indicators.
   */
  public getBufferedOutputSeconds(): number {
    const now = this.outputAudioContext.currentTime;
    return Math.max(0, this.nextStartTime - now);
  }

  /** Returns true if there is audio scheduled or waiting to be scheduled. */
  public hasActiveOutput(): boolean {
    return this.outputSources.size > 0 || this.outputPendingBase64.length > 0;
  }

  /** Returns an estimate of queued audio (not yet scheduled) in seconds. */
  public getPendingOutputSeconds(): number {
    let bytes = 0;
    for (const b64 of this.outputPendingBase64) {
      bytes += this.base64ByteLength(b64);
    }
    const samples = bytes / 2; // Int16 mono
    return samples / this.OUTPUT_SAMPLE_RATE;
  }

  private base64ByteLength(b64: string): number {
    // Compute bytes from base64 length without decoding
    const len = b64.length;
    let padding = 0;
    if (b64.endsWith('==')) padding = 2;
    else if (b64.endsWith('=')) padding = 1;
    return Math.floor((len * 3) / 4) - padding;
  }

  private async scheduleOutputIfNeeded() {
    if (this.schedulingOutput) return;
    this.schedulingOutput = true;
    try {
      while (
        this.outputPendingBase64.length > 0 &&
        this.getBufferedOutputSeconds() < this.MAX_BUFFER_SEC
      ) {
        // Compute start time with prebuffer when starting from empty
        if (this.outputSources.size === 0) {
          this.nextStartTime =
            this.outputAudioContext.currentTime + this.START_PREBUFFER_SEC;
        }
        // Maintain a margin to avoid underflows
        this.nextStartTime = Math.max(
          this.nextStartTime,
          this.outputAudioContext.currentTime + this.SCHEDULE_MARGIN_SEC,
        );

        const base64Data = this.outputPendingBase64.shift()!;
        const audioBuffer = await decodeAudioData(
          decode(base64Data),
          this.outputAudioContext,
          24000,
          1,
        );

        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputNode);
        source.addEventListener('ended', () => {
          this.outputSources.delete(source);
          // Try to schedule more when space frees up
          this.scheduleOutputIfNeeded();
        });

        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.outputSources.add(source);
      }
    } finally {
      this.schedulingOutput = false;
    }
  }

  // -------------------------
  // Input batching helpers
  // -------------------------
  private enqueueInput(chunk: Float32Array) {
    if (!chunk || chunk.length === 0) return;
    this.pendingInputChunks.push(chunk);
    this.pendingSamples += chunk.length;
  }

  private drainInputBatches() {
    while (this.pendingSamples >= this.INPUT_BATCH_SAMPLES) {
      const out = new Float32Array(this.INPUT_BATCH_SAMPLES);
      let remaining = this.INPUT_BATCH_SAMPLES;
      let offset = 0;
      while (remaining > 0 && this.pendingInputChunks.length > 0) {
        const head = this.pendingInputChunks[0];
        const toCopy = Math.min(remaining, head.length);
        out.set(head.subarray(0, toCopy), offset);
        offset += toCopy;
        remaining -= toCopy;
        if (toCopy === head.length) {
          this.pendingInputChunks.shift();
        } else {
          this.pendingInputChunks[0] = head.subarray(toCopy);
        }
      }
      this.pendingSamples -= this.INPUT_BATCH_SAMPLES;
      this.onInputAudio(createBlob(out));
    }
  }

  private flushPendingInput() {
    if (this.pendingSamples === 0) return;
    // Concatenate remaining into a single chunk and send
    const out = new Float32Array(this.pendingSamples);
    let offset = 0;
    while (this.pendingInputChunks.length > 0) {
      const buf = this.pendingInputChunks.shift()!;
      out.set(buf, offset);
      offset += buf.length;
    }
    this.pendingSamples = 0;
    this.onInputAudio(createBlob(out));
  }
}
