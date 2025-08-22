/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {LitElement, css, html, svg} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import type {Analysis, ProcessingState} from '../../types/types';

@customElement('gdm-analysis-form')
export class GdmAnalysisForm extends LitElement {
  @property({type: Array}) analyses: Analysis[] = [];
  @property({type: Object}) processingState: ProcessingState = {
    active: false,
    step: '',
    progress: 0,
  };

  @state() private urlInput = '';
  @state() private selectedFile: File | null = null;
  @state() private animatedProgress = 0;
  @state() private isModeMenuOpen = false;
  @state() private selectedMode: 'default' | 'vibecode' | 'workflow' = 'default';
  private progressAnimationId: number | null = null;

  static styles = css`
    .input-container {
      position: absolute;
      top: 2vh;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 550px;
      z-index: 20;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .input-form {
      width: 100%;
      display: flex;
      gap: 8px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 24px;
      padding: 4px;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      align-items: center;
    }

    .input-form input[type='text'] {
      flex-grow: 1;
      border: none;
      background: transparent;
      color: white;
      padding: 10px 18px;
      font-size: 14px;
      outline: none;
      height: 40px;
      box-sizing: border-box;
      min-width: 0;
    }

    .input-form button {
      outline: none;
      border: none;
      color: white;
      border-radius: 20px;
      background: rgba(80, 120, 255, 0.5);
      height: 40px;
      cursor: pointer;
      font-size: 14px;
      white-space: nowrap;
      transition: background-color 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      flex-shrink: 0;
    }

    .input-form button.icon-button {
      background: transparent;
      width: 40px;
      padding: 0;
    }

    .input-form button:hover {
      background: rgba(80, 120, 255, 0.8);
    }

    .input-form button.icon-button:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .input-form button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .input-form button[type='submit'] {
      position: relative;
      overflow: hidden;
      transition: all 0.2s ease;
      min-width: 130px;
    }

    .input-form button[type='submit']:disabled {
      background: #282846; /* More discreet disabled background */
      opacity: 1; /* Override general disabled opacity */
      cursor: not-allowed;
    }

    .input-form button.icon-button:disabled {
      background: transparent;
    }

    .progress-bar {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: linear-gradient(
        90deg,
        rgba(80, 120, 255, 0.7) 0%,
        rgba(100, 140, 255, 0.9) 100%
      );
      border-radius: 20px;
      transition: none; /* JS will handle animation */
      z-index: 1;
    }

    .progress-text {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      color: white;
      width: 100%;
      overflow: hidden;
    }

    .progress-text .loader {
      flex-shrink: 0;
      margin-right: 8px;
    }

    .progress-text .step-text {
      flex-grow: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: left;
      min-width: 0;
    }

    .progress-text .progress-percent {
      flex-shrink: 0;
      margin-left: 8px;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    .loader {
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      animation: spin 1s linear infinite;
    }

    .content-pills-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-top: 8px;
    }
    .content-pill {
      display: flex;
      align-items: center;
      background: rgba(0, 0, 0, 0.4);
      padding: 6px 12px;
      border-radius: 16px;
      font-family: sans-serif;
      font-size: 13px;
      color: #eee;
      border: 1px solid #5078ff;
      backdrop-filter: blur(10px);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 250px;
    }
    .content-pill span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .content-pill button {
      background: none;
      border: none;
      color: #aaa;
      margin-left: 8px;
      padding: 0;
      font-size: 16px;
      cursor: pointer;
      line-height: 1;
    }
    .content-pill button:hover {
      color: #fff;
    }
    .mode-selector-container {
      position: relative;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mode-menu {
      position: absolute;
      top: calc(100% + 8px); /* Position dropdown below the button */
      right: 0;
      background: rgba(20, 20, 30, 0.95);
      border: 1px solid rgba(80, 120, 255, 0.3);
      border-radius: 16px;
      padding: 12px;
      z-index: 10;
      width: 320px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .mode-menu button {
      width: 100%;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.02);
      color: white;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
      transition: all 0.3s ease;
      position: relative;
    }
    .mode-menu button::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, rgba(80, 120, 255, 0.1) 0%, transparent 100%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .mode-menu button:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(80, 120, 255, 0.4);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(80, 120, 255, 0.2);
    }
    .mode-menu button:hover::before {
      opacity: 1;
    }
    .mode-menu button.active {
      border-color: #5078ff;
      background: linear-gradient(135deg, rgba(80, 120, 255, 0.2) 0%, rgba(80, 120, 255, 0.05) 100%);
      box-shadow: 0 4px 16px rgba(80, 120, 255, 0.3);
    }
    .mode-menu strong {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 2px;
      color: #ffffff;
      position: relative;
      z-index: 1;
    }
    .mode-menu span {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.4;
      position: relative;
      z-index: 1;
    }

    @media (max-width: 480px) {
      .input-form {
        padding: 2px;
        gap: 4px;
      }
      .input-form input[type='text'] {
        padding: 8px 12px;
        font-size: 13px;
      }
      .input-form button {
        height: 36px;
        border-radius: 18px;
      }
      .input-form button.icon-button {
        width: 36px;
        border-radius: 50%;
      }
      .input-form button[type='submit'] {
        padding: 0 12px;
        font-size: 13px;
        min-width: 110px;
      }
      .loader {
        width: 14px;
        height: 14px;
        border-width: 2px;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    document.body.addEventListener('click', this.handleOutsideClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.body.removeEventListener('click', this.handleOutsideClick);
  }

  private handleOutsideClick = (e: MouseEvent) => {
    const container = this.shadowRoot?.querySelector(
      '.mode-selector-container',
    );
    if (this.isModeMenuOpen && container && !e.composedPath().includes(container)) {
      this.isModeMenuOpen = false;
    }
  };


  willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('processingState')) {
      this.handleProgressChange(
        this.processingState.progress,
        this.processingState.active,
      );
    }
  }

  private handleProgressChange(targetProgress: number, isActive: boolean) {
    // Always cancel any previous animation when the state changes.
    if (this.progressAnimationId) {
      cancelAnimationFrame(this.progressAnimationId);
      this.progressAnimationId = null;
    }

    // This is the special "intelligent feedback" state.
    // When the progress hits 50%, we start a long, slow, simulated animation
    // to show that work is being done in the background.
    if (isActive && targetProgress === 50) {
      // First, do a quick animation to get to the 50% mark.
      this.animateTo(50, 300).then(() => {
        // After reaching 50%, start the slow simulation, but only if the
        // process is still active at 50% (it hasn't been cancelled or completed).
        if (this.processingState.active && this.processingState.progress === 50) {
          // This will be a long, slow animation to 94% with an easing
          // function to make it feel more natural as it decelerates.
          const fifteenSeconds = 15000;
          const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
          this.animateTo(94, fifteenSeconds, easeOutCubic);
        }
      });
      return; // The nested animations will handle it from here.
    }

    // For all other progress steps, just do a quick, standard animation.
    this.animateTo(targetProgress, 300);
  }

  private animateTo(
    target: number,
    duration: number,
    easing: (t: number) => number = (t) => t,
  ): Promise<void> {
    return new Promise((resolve) => {
      // It's possible a new animation was requested while this one was waiting
      // in the promise, so we cancel again just in case.
      if (this.progressAnimationId) {
        cancelAnimationFrame(this.progressAnimationId);
      }

      const start = this.animatedProgress;
      const change = target - start;
      let startTime: number | null = null;

      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progressRatio = Math.min(elapsed / duration, 1);
        const easedProgress = easing(progressRatio);

        this.animatedProgress = Math.round(start + change * easedProgress);

        if (elapsed < duration) {
          this.progressAnimationId = requestAnimationFrame(step);
        } else {
          this.animatedProgress = target;
          this.progressAnimationId = null;
          resolve();
        }
      };

      this.progressAnimationId = requestAnimationFrame(step);
    });
  }

  private handleUrlInputChange(e: Event) {
    this.urlInput = (e.target as HTMLInputElement).value;
    if (this.selectedFile) {
      this.selectedFile = null;
      const fileInput = this.shadowRoot?.getElementById(
        'file-input',
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  }

  private triggerFileInput() {
    this.shadowRoot?.getElementById('file-input')?.click();
  }

  private handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.urlInput = this.selectedFile.name; // Show file name in input
    } else {
      this.selectedFile = null;
    }
  }

  private handleAnalysisSubmit(e: Event) {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('analysis-submit', {
        detail: {
          urlOrTopic: this.urlInput.trim(),
          file: this.selectedFile,
          analysisMode: this.selectedMode,
        },
        bubbles: true,
        composed: true,
      }),
    );
    // Clear inputs after submission
    this.urlInput = '';
    this.selectedFile = null;
    this.isModeMenuOpen = false;
    this.selectedMode = 'default';
    const fileInput = this.shadowRoot?.getElementById(
      'file-input',
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  private removeAnalysis(idToRemove: string) {
    this.dispatchEvent(
      new CustomEvent('analysis-remove', {
        detail: {idToRemove},
        bubbles: true,
        composed: true,
      }),
    );
  }

  private toggleModeMenu() {
    this.isModeMenuOpen = !this.isModeMenuOpen;
  }

  private selectMode(mode: 'default' | 'vibecode' | 'workflow') {
    this.selectedMode = mode;
    this.isModeMenuOpen = false;
  }


  render() {
    const modeIcon = () => {
      if (this.selectedMode === 'vibecode') {
        return svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#A9BFFF"><path d="m321-240-57-57 179-179-179-179 57-57 236 236-236 236Zm318 0-57-57 179-179-179-179 57-57 236 236-236 236Z"/></svg>`;
      }
      if (this.selectedMode === 'workflow') {
         return svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#A9BFFF"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h440l200 200v440q0 33-23.5 56.5T760-120H200Zm0-80h560v-400H600v-160H200v560Zm80-80h400v-80H280v80Zm0-160h400v-80H280v80Zm0-160h280v-80H280v80Zm-80 400v-560 560Z"/></svg>`;
      }
      return svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#ffffff"><path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/></svg>`;
    };
    return html`
      <div class="input-container">
        <form class="input-form" @submit=${this.handleAnalysisSubmit}>
          <input
            type="text"
            id="url-input"
            aria-label="URL, tópico de pesquisa ou nome do arquivo"
            placeholder="Cole uma URL, digite um tema ou carregue um arquivo"
            .value=${this.urlInput}
            @input=${this.handleUrlInputChange}
            ?disabled=${this.processingState.active} />
          <button
            type="button"
            class="icon-button"
            @click=${this.triggerFileInput}
            ?disabled=${this.processingState.active}
            title="Carregar um arquivo"
            aria-label="Carregar um arquivo">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24px"
              viewBox="0 -960 960 960"
              width="24px"
              fill="#ffffff">
              <path
                d="M440-320v-320H320l160-200 160 200H520v320H440ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
            </svg>
          </button>
           <div class="mode-selector-container">
             <button
              type="button"
              class="icon-button mode-button"
              @click=${this.toggleModeMenu}
              ?disabled=${this.processingState.active}
              title="Selecionar modo de análise"
              aria-label="Selecionar modo de análise">
                ${modeIcon()}
            </button>
            ${this.isModeMenuOpen ? html`
              <div class="mode-menu">
                <button
                  class="mode-option ${this.selectedMode === 'default' ? 'active' : ''}"
                  @click=${() => this.selectMode('default')}>
                  <strong>Modo Padrão</strong>
                  <span>Análise geral e abrangente do conteúdo fornecido.</span>
                </button>
                <button
                  class="mode-option ${this.selectedMode === 'vibecode' ? 'active' : ''}"
                  @click=${() => this.selectMode('vibecode')}>
                  <strong>Vibecode</strong>
                  <span>Análise visual e funcional de apps (para vídeos).</span>
                </button>
                <button
                  class="mode-option ${this.selectedMode === 'workflow' ? 'active' : ''}"
                  @click=${() => this.selectMode('workflow')}>
                  <strong>Workflow</strong>
                  <span>Analisa fluxos de trabalho (n8n) e gera o JSON.</span>
                </button>
              </div>
            ` : ''}
          </div>
          <button
            type="submit"
            aria-label="Analisar, Pesquisar ou Adicionar Contexto"
            ?disabled=${
              (!this.urlInput.trim() && !this.selectedFile) ||
              this.processingState.active
            }>
            ${this.processingState.active
              ? html`
                  <div
                    class="progress-bar"
                    style="width: ${this.animatedProgress}%"></div>
                  <div class="progress-text">
                    <div class="loader"></div>
                    <span
                      class="step-text"
                      title="${this.processingState.step}"
                      >${this.processingState.step}</span
                    >
                    <span class="progress-percent"
                      >${this.animatedProgress}%</span
                    >
                  </div>
                `
              : this.analyses.length > 0
              ? 'Adicionar'
              : 'Analisar'}
          </button>
        </form>
        <input
          type="file"
          id="file-input"
          style="display: none;"
          @change=${this.handleFileSelect}
          accept="image/*,video/*,application/pdf,.csv,.xls,.xlsx,.doc,.docx,.md,.xlm" />

        ${this.analyses.length > 0
          ? html`
              <div class="content-pills-container">
                ${this.analyses.map(
                  (analysis) => html`
                    <div class="content-pill" title=${analysis.source}>
                      <span>${analysis.title}</span>
                      <button
                        @click=${() => this.removeAnalysis(analysis.id)}
                        title="Remover contexto"
                        aria-label="Remover ${analysis.title} do contexto">
                        ×
                      </button>
                    </div>
                  `,
                )}
              </div>
            `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-analysis-form': GdmAnalysisForm;
  }
}