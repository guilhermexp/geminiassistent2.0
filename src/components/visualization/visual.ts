/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {Analyser} from '../../services/audio/analyser';

@customElement('gdm-live-audio-visuals')
export class GdmLiveAudioVisuals extends LitElement {
  private inputAnalyser: Analyser;
  private outputAnalyser: Analyser;

  private _outputNode: AudioNode;

  @property()
  set outputNode(node: AudioNode) {
    this._outputNode = node;
    this.outputAnalyser = new Analyser(this._outputNode);
  }

  get outputNode() {
    return this._outputNode;
  }

  private _inputNode: AudioNode;

  @property()
  set inputNode(node: AudioNode) {
    this._inputNode = node;
    this.inputAnalyser = new Analyser(this._inputNode);
  }

  get inputNode() {
    return this._inputNode;
  }

  private canvas: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private isAnimating = false;
  private idleTimer: number | null = null;
  private inactiveFrames = 0;
  private readonly INACTIVE_FRAMES_TO_PAUSE = 120; // ~2s

  static styles = css`
    canvas {
      width: 400px;
      aspect-ratio: 1 / 1;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.startIdleProbe();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stop();
    this.stopIdleProbe();
  }

  private start() {
    if (this.isAnimating) return;
    this.isAnimating = true;
    const tick = () => {
      if (!this.isAnimating) return;
      this.rafId = requestAnimationFrame(tick);
      this.visualize();
      // Auto-pause when low activity
      const level = this.getActivityLevel();
      if (level < 8) {
        this.inactiveFrames++;
        if (this.inactiveFrames >= this.INACTIVE_FRAMES_TO_PAUSE) {
          this.stop();
          this.startIdleProbe();
          this.inactiveFrames = 0;
        }
      } else {
        this.inactiveFrames = 0;
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stop() {
    this.isAnimating = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private startIdleProbe() {
    if (this.idleTimer) return;
    this.idleTimer = window.setInterval(() => {
      this.inputAnalyser?.update();
      this.outputAnalyser?.update();
      if (this.getActivityLevel() >= 12) {
        this.stopIdleProbe();
        this.start();
      }
    }, 300);
  }

  private stopIdleProbe() {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private getActivityLevel(): number {
    if (!this.inputAnalyser || !this.outputAnalyser) return 0;
    const bins = [0, 1, 2, 3];
    let sum = 0;
    for (const i of bins) {
      sum += (this.inputAnalyser.data[i] || 0) + (this.outputAnalyser.data[i] || 0);
    }
    return sum / (bins.length * 2);
  }

  private visualize() {
    if (this.canvas && this.outputAnalyser) {
      const canvas = this.canvas;
      const canvasCtx = this.canvasCtx;

      const WIDTH = canvas.width;
      const HEIGHT = canvas.height;

      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
      canvasCtx.fillStyle = '#1f2937';
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      const barWidth = WIDTH / this.outputAnalyser.data.length;
      let x = 0;

      const inputGradient = canvasCtx.createLinearGradient(0, 0, 0, HEIGHT);
      inputGradient.addColorStop(1, '#D16BA5');
      inputGradient.addColorStop(0.5, '#E78686');
      inputGradient.addColorStop(0, '#FB5F5F');
      canvasCtx.fillStyle = inputGradient;

      this.inputAnalyser.update();

      for (let i = 0; i < this.inputAnalyser.data.length; i++) {
        const barHeight = this.inputAnalyser.data[i] * (HEIGHT / 255);
        canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
        x += barWidth;
      }

      canvasCtx.globalCompositeOperation = 'lighter';

      const outputGradient = canvasCtx.createLinearGradient(0, 0, 0, HEIGHT);
      outputGradient.addColorStop(1, '#3b82f6');
      outputGradient.addColorStop(0.5, '#10b981');
      outputGradient.addColorStop(0, '#ef4444');
      canvasCtx.fillStyle = outputGradient;

      x = 0;
      this.outputAnalyser.update();

      for (let i = 0; i < this.outputAnalyser.data.length; i++) {
        const barHeight = this.outputAnalyser.data[i] * (HEIGHT / 255);
        canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
        x += barWidth;
      }
    }
    // draw-only; RAF loop managed by start/stop
  }

  protected firstUpdated() {
    this.canvas = this.shadowRoot!.querySelector('canvas');
    const hc = navigator.hardwareConcurrency || 8;
    const dm = (navigator as any).deviceMemory || 8;
    const lowTier = hc <= 4 || dm <= 4;
    const size = lowTier ? 300 : 400;
    this.canvas.width = size;
    this.canvas.height = size;
    this.canvasCtx = this.canvas.getContext('2d');
  }

  protected render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-live-audio-visuals': GdmLiveAudioVisuals;
  }
}
