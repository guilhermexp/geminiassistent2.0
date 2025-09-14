/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {LitElement, css, html} from 'lit';
import {styleMap} from 'lit/directives/style-map.js';
import {customElement, property} from 'lit/decorators.js';

/**
 * Lightweight, CSS-only animated orb. Designed to be extremely cheap:
 * - Only uses transform/opacity animations
 * - Honors prefers-reduced-motion and a `paused` prop
 * - No Canvas/WebGL, no timers
 */
@customElement('gdm-orb-lite')
export class GdmOrbLite extends LitElement {
  /** CSS size, e.g., `192px` or `clamp(128px, 22vmin, 320px)` */
  @property({type: String}) size = 'clamp(128px, 22vmin, 320px)';
  /** Animation duration in seconds (lower = faster) */
  @property({type: Number}) animationDuration = 20;
  /** Pause animation entirely */
  @property({type: Boolean}) paused = false;

  static styles = css`
    :host {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      pointer-events: none; /* purely visual */
    }

    .orb {
      position: relative;
      width: var(--orb-size, 240px);
      height: var(--orb-size, 240px);
      border-radius: 50%;
      overflow: hidden;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.35);
      will-change: transform, opacity;
      transform: translateZ(0);
      isolation: isolate;
    }

    /* Soft elliptical drop shadow */
    .orb::before {
      content: '';
      position: absolute;
      left: 50%;
      top: 55%;
      width: 120%;
      height: 120%;
      transform: translate(-50%, 0) scaleY(0.55);
      border-radius: 50%;
      background: radial-gradient(60% 60% at 50% 50%, rgba(0,0,0,0.45), rgba(0,0,0,0.0) 70%);
      z-index: -1;
      filter: blur(6px);
    }

    /* Base color blend */
    .layer.base {
      position: absolute;
      inset: 0;
      background: radial-gradient(120% 120% at 30% 26%,
          rgba(255,255,255,0.85) 0%,
          rgba(218,228,255,0.74) 24%,
          rgba(136,170,245,0.58) 52%,
          rgba(70,110,220,0.42) 72%,
          rgba(30, 54, 160,0.28) 100%),
        /* cool rim + subtle warm sectors (darker hues) */
        conic-gradient(from -20deg at 55% 55%,
          rgba(60, 210, 200, 0.62) 0deg,
          rgba(85, 140, 240, 0.68) 60deg,
          rgba(160, 165, 255, 0.60) 120deg,
          rgba(235, 120, 180, 0.40) 210deg,
          rgba(60, 200, 175, 0.54) 300deg,
          rgba(60, 210, 200, 0.62) 360deg);
      opacity: 0.98;
      mix-blend-mode: screen;
      animation: spin var(--orb-dur, 20s) linear infinite;
      animation-play-state: var(--orb-play, running);
    }

    /* Soft highlight */
    .layer.shine {
      position: absolute;
      inset: -15%;
      background:
        radial-gradient(45% 38% at 28% 22%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.0) 65%),
        radial-gradient(70% 70% at 28% 8%, rgba(60,255,250,0.65) 0%, rgba(60,255,250,0.0) 55%);
      transform: rotate(10deg);
      animation: drift calc(var(--orb-dur, 20s) * 1.3) ease-in-out infinite;
      animation-play-state: var(--orb-play, running);
      opacity: 0.9;
    }

    /* Subtle dots for texture (no filters) */
    .layer.dots {
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(230,235,255,0.18) 0.8px, transparent 0.8px);
      background-size: 5px 5px;
      mix-blend-mode: soft-light;
      opacity: 0.42;
      /* Fade dots towards rim */
      -webkit-mask-image: radial-gradient(75% 75% at 50% 55%, rgba(0,0,0,1), rgba(0,0,0,0) 85%);
      mask-image: radial-gradient(75% 75% at 50% 55%, rgba(0,0,0,1), rgba(0,0,0,0) 85%);
      animation: spin var(--orb-dur, 20s) linear reverse infinite;
      animation-play-state: var(--orb-play, running);
    }

    /* Extra color swirl to add vibrance */
    .layer.tint {
      position: absolute;
      inset: 0;
      background: conic-gradient(from 100deg at 50% 50%,
        rgba(255, 90, 150, 0.32),
        rgba(70, 155, 255, 0.44),
        rgba(70, 210, 190, 0.36),
        rgba(150, 110, 255, 0.34),
        rgba(255, 90, 150, 0.32));
      mix-blend-mode: screen;
      opacity: 0.28;
      animation: spin calc(var(--orb-dur, 20s) * 1.7) linear reverse infinite;
      animation-play-state: var(--orb-play, running);
    }

    /* Color blobs that orbit inside to show clear motion */
    .blob {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 70%;
      height: 70%;
      border-radius: 50%;
      filter: blur(2px);
      opacity: 0.55;
      mix-blend-mode: screen;
      transform-origin: center;
      transform: translate(-50%, -50%) rotate(0deg) translateX(22%);
      animation: orbitA calc(var(--orb-dur, 20s) * 2) linear infinite;
      animation-play-state: var(--orb-play, running);
      will-change: transform, opacity;
    }

    .blob.b2 {
      width: 62%;
      height: 62%;
      opacity: 0.6;
      transform: translate(-50%, -50%) rotate(180deg) translateX(20%);
      animation: orbitB calc(var(--orb-dur, 20s) * 2.3) linear infinite;
      animation-play-state: var(--orb-play, running);
    }

    .blob.b3 {
      width: 58%;
      height: 58%;
      opacity: 0.45;
      transform: translate(-50%, -50%) rotate(110deg) translateX(16%);
      animation: orbitA calc(var(--orb-dur, 20s) * 2.6) linear reverse infinite;
      animation-play-state: var(--orb-play, running);
    }

    .blob.b1 { /* aqua → cyan (darker) */
      background: radial-gradient(55% 55% at 50% 50%, rgba(48, 190, 175, 0.75), rgba(48,190,175,0.0) 70%);
    }
    .blob.b2 { /* lavender (darker) */
      background: radial-gradient(60% 60% at 50% 50%, rgba(120, 130, 255, 0.72), rgba(120,130,255,0.0) 70%);
    }
    .blob.b3 { /* soft magenta (darker) */
      background: radial-gradient(58% 58% at 50% 50%, rgba(220, 70, 125, 0.55), rgba(220,70,125,0.0) 70%);
    }

    @keyframes orbitA {
      0% { transform: translate(-50%, -50%) rotate(0deg) translateX(22%); }
      50% { transform: translate(-50%, -50%) rotate(180deg) translateX(18%); }
      100% { transform: translate(-50%, -50%) rotate(360deg) translateX(22%); }
    }
    @keyframes orbitB {
      0% { transform: translate(-50%, -50%) rotate(180deg) translateX(20%); }
      50% { transform: translate(-50%, -50%) rotate(360deg) translateX(16%); }
      100% { transform: translate(-50%, -50%) rotate(540deg) translateX(20%); }
    }

    /* Rim hue (lavender/azure) and small magenta hotspot bottom-left */
    .layer.rim {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(120% 120% at 78% 58%, rgba(120,135,245,0.55), rgba(120,135,245,0.00) 40%),
        radial-gradient(120% 120% at 12% 88%, rgba(230, 70, 135, 0.45), rgba(230, 70, 135, 0.00) 35%);
      mix-blend-mode: screen;
      opacity: 0.6;
      animation: spin calc(var(--orb-dur, 20s) * 1.2) linear infinite;
      animation-play-state: var(--orb-play, running);
    }

    /* Subtle darkening overlay for deeper overall tone */
    .layer.shade {
      position: absolute;
      inset: -8%;
      background: radial-gradient(70% 65% at 50% 55%, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.12) 60%, rgba(0,0,0,0.22) 100%);
      mix-blend-mode: multiply;
      pointer-events: none;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes drift {
      0%, 100% { transform: translateY(-2%) rotate(15deg); }
      50% { transform: translateY(2%) rotate(15deg); }
    }

    /* Respect reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .layer.base,
      .layer.shine,
      .layer.dots { animation: none !important; }
    }
  `;

  render() {
    const playState = this.paused ? 'paused' : 'running';
    const vars = {
      '--orb-size': this.size,
      '--orb-dur': `${this.animationDuration}s`,
      '--orb-play': playState,
    } as Record<string, string>;

    return html`
      <div class="orb" style=${styleMap(vars)}>
        <div class="layer base"></div>
        <div class="layer rim"></div>
        <div class="layer tint"></div>
        <div class="blob b1"></div>
        <div class="blob b2"></div>
        <div class="blob b3"></div>
        <div class="layer shade"></div>
        <div class="layer shine"></div>
        <div class="layer dots"></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-orb-lite': GdmOrbLite;
  }
}
