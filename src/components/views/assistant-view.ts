/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {
  Analysis,
  ProcessingState,
  SearchResult,
  TimelineEvent,
  SavedSession,
} from '../../types/types';

// Import child components that this view renders.
import '../forms/analysis-form';
import '../controls/media-controls';
import '../modals/timeline-modal';
import '../modals/history-modal';
import '../ui/user-profile';
import '../visualization/orb-lite';
// 3D visuals are lazy-loaded when enabled via env

/**
 * A component that encapsulates the main user interface for the assistant,
 * including the 3D visualization, status messages, media controls, and search results.
 */
@customElement('gdm-assistant-view')
export class AssistantView extends LitElement {
  @property({type: String}) status = '';
  @property({type: String}) error = '';
  @property({type: Array}) searchResults: SearchResult[] = [];
  @property({type: Object}) inputNode!: AudioNode;
  @property({type: Object}) outputNode!: AudioNode;
  @property({type: Boolean}) isRecording = false;
  @property({type: Array}) analyses: Analysis[] = [];
  @property({type: Boolean}) showTimelineModal = false;
  @property({type: Boolean}) showHistoryModal = false;
  @property({type: Array}) timelineEvents: TimelineEvent[] = [];
  @property({type: Array}) savedSessions: SavedSession[] = [];
  @property({type: Object}) processingState: ProcessingState = {
    active: false,
    step: '',
    progress: 0,
  };
  @property({type: String}) activePersona: string | null = null;
  // Health overlay
  @property({type: Number}) bufferSeconds = 0;
  @property({type: Number}) pendingSeconds = 0;
  @property({type: Number}) retryCount = 0;
  @property({type: Boolean}) isConnecting = false;
  private threeLoaded = false;

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }

    .user-profile-container {
      position: absolute;
      bottom: 2vh;
      right: 2vw;
      z-index: 20;
    }

    #status {
      position: absolute;
      bottom: calc(2vh + 100px); /* Position above the control bar */
      left: 0;
      right: 0;
      z-index: 10;
      text-align: center;
      color: rgba(255, 255, 255, 0.7);
      font-family: sans-serif;
      transition: color 0.3s ease;
      text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
      pointer-events: none; /* Avoid interfering with controls */
    }

    #status.error {
      color: #ff8a80; /* A less harsh red */
    }

    .bottom-container {
      position: absolute;
      bottom: 2vh;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 800px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 10;
      align-items: center;
    }

    .search-results {
      background: rgba(0, 0, 0, 0.3);
      padding: 8px 16px;
      border-radius: 12px;
      font-family: sans-serif;
      font-size: 14px;
      color: #ccc;
      max-width: 100%;
      backdrop-filter: blur(10px);
    }

    .search-results p {
      margin: 0 0 8px 0;
      font-weight: bold;
    }

    .search-results ul {
      margin: 0;
      padding: 0;
      list-style: none;
      max-height: 100px;
      overflow-y: auto;
    }

    .search-results li {
      margin-bottom: 4px;
    }

    .search-results a {
      color: #87cefa;
      text-decoration: none;
    }
    .search-results a:hover {
      text-decoration: underline;
    }

    .health-bottom {
      align-self: center;
      font-family: system-ui, sans-serif;
      font-size: 11px;
      color: rgba(229, 231, 235, 0.9);
      background: rgba(0, 0, 0, 0.22);
      border-radius: 999px;
      padding: 4px 10px;
      backdrop-filter: blur(6px);
      display: inline-flex;
      gap: 10px;
      align-items: center;
      pointer-events: none;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      margin-top: 8px;
    }
    .status { opacity: 0.9; }
    .status.warn { color: #fde68a; }
    .metric { opacity: 0.9; }
    .metric.warn { color: #fde68a; }
    .metric.err { color: #fca5a5; }
    .sep { opacity: 0.4; }
  `;

  get enable3D() {
    return (process.env.ENABLE_3D || '').toLowerCase() === 'true';
  }

  protected async firstUpdated() {
    if (this.enable3D) {
      try {
        await import('../visualization/visual-3d');
        this.threeLoaded = true;
        this.requestUpdate();
      } catch (e) {
        console.error('Falha ao carregar visualização 3D:', e);
      }
    }
  }

  private onTimelineModalClose() {
    this.dispatchEvent(
      new CustomEvent('close-timeline', {bubbles: true, composed: true}),
    );
  }

  private onHistoryModalClose() {
    this.dispatchEvent(
      new CustomEvent('close-history', {bubbles: true, composed: true}),
    );
  }

  private _onShowHistory() {
    this.dispatchEvent(
      new CustomEvent('show-history', {bubbles: true, composed: true}),
    );
  }

  private _onPersonaChange(e: CustomEvent) {
    this.dispatchEvent(
      new CustomEvent('persona-change', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      
      <gdm-timeline-modal
        .show=${this.showTimelineModal}
        .events=${this.timelineEvents}
        .processingState=${this.processingState}
        @close=${this.onTimelineModalClose}></gdm-timeline-modal>

      <gdm-history-modal
        .show=${this.showHistoryModal}
        .sessions=${this.savedSessions}
        @close=${this.onHistoryModalClose}></gdm-history-modal>

      <gdm-analysis-form
        .analyses=${this.analyses}
        .processingState=${this.processingState}></gdm-analysis-form>

      <div class="user-profile-container">
        <gdm-user-profile
          .activePersona=${this.activePersona}
          @show-history=${this._onShowHistory}
          @persona-change=${this._onPersonaChange}></gdm-user-profile>
      </div>

      <div id="status" class=${this.error ? 'error' : ''}>
        ${this.error || this.status}
      </div>

      <div class="bottom-container">
        ${
          this.searchResults.length > 0
            ? html`
                <div class="search-results">
                  <p>Fontes da pesquisa:</p>
                  <ul>
                    ${this.searchResults.map(
                      (result) => html`
                        <li>
                          <a
                            href=${result.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            >${result.title || result.uri}</a
                          >
                        </li>
                      `,
                    )}
                  </ul>
                </div>
              `
            : ''
        }

        <gdm-media-controls
          .isRecording=${this.isRecording}
          .hasAnalyses=${this.analyses.length > 0}
          .hasTimelineEvents=${
            this.timelineEvents.length > 0
          }></gdm-media-controls>
        <div class="health-bottom">
          <span class="status ${this.isConnecting ? 'warn' : ''}">
            ${this.isConnecting ? 'Conectando' : 'Conectado'}
          </span>
          <span class="sep">•</span>
          <span class="metric ${
            this.bufferSeconds < 0.06 ? 'err' : this.bufferSeconds < 0.12 ? 'warn' : ''
          }">Buffer: ${Math.round(this.bufferSeconds * 1000)} ms</span>
          <span class="sep">•</span>
          <span class="metric">Fila: ${Math.round(this.pendingSeconds * 1000)} ms</span>
          <span class="sep">•</span>
          <span class="metric">Tent.: ${this.retryCount}</span>
        </div>
      </div>
      ${this.enable3D && this.threeLoaded
        ? html`<gdm-live-audio-visuals-3d
            .inputNode=${this.inputNode}
            .outputNode=${this.outputNode}></gdm-live-audio-visuals-3d>`
        : html`<gdm-orb-lite
            size="clamp(200px, 32vmin, 480px)"
            .animationDuration=${18}
            .paused=${this.isRecording || this.bufferSeconds < 0.06}
          ></gdm-orb-lite>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-assistant-view': AssistantView;
  }
}
