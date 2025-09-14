/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import type {Analysis, SavedSession} from '../../types/types';

@customElement('gdm-app-sidebar')
export class GdmAppSidebar extends LitElement {
  @property({type: Boolean}) panelOpen = false;
  @property({type: Array}) analyses: Analysis[] = [];
  @property({type: Array}) savedSessions: SavedSession[] = [];
  @state() private query = '';

  static styles = css`
    :host {
      display: block;
      height: 100%;
      color: #e5e7eb;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    }
    .wrap {
      box-sizing: border-box;
      height: 100%;
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: rgba(30,30,30,0.9);
      color: #eee;
      border-right: 1px solid rgba(255,255,255,0.2);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .title {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 20px;
      letter-spacing: -0.01em;
    }
    .dot { width: 10px; height: 10px; border-radius: 999px; background: #60a5fa; display: inline-block; box-shadow: 0 0 8px rgba(96,165,250,0.8); }
    .hbtn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.06);
      color: #e5e7eb;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .search {
      position: relative;
      padding: 14px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .search input {
      width: 100%;
      box-sizing: border-box;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      color: #e5e7eb;
      padding: 12px 14px 12px 40px;
      height: 44px;
      border-radius: 14px;
      outline: none;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 2px rgba(255,255,255,0.02);
    }
    .search input::placeholder { color: rgba(229,231,235,0.6); }
    .search .icon { position: absolute; left: 28px; top: 22px; opacity: 0.85; filter: drop-shadow(0 1px 0 rgba(0,0,0,0.2)); }
    .sectionLabel { font-size: 11px; letter-spacing: 0.14em; opacity: 0.58; padding: 12px 14px 6px; }
    .row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; gap: 10px; cursor: pointer; }
    .row:hover { background: rgba(255,255,255,0.04); }
    .row .left { display: inline-flex; align-items: center; gap: 12px; }
    .checkbox { width: 18px; height: 18px; border-radius: 6px; display: inline-block; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.02); box-shadow: inset 0 1px 0 rgba(255,255,255,0.03); }
    .chev { opacity: 0.6; }
    .list { overflow: auto; padding: 6px 10px 16px; }
    .item { padding: 12px 10px; border-radius: 12px; margin: 4px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border: 1px solid transparent; }
    .item:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.06); }
    .chip { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.08); padding: 6px 10px; border-radius: 999px; margin: 6px 8px; font-size: 12px; }
    .chip button { background: transparent; border: none; color: inherit; cursor: pointer; }
  `;

  private emit(name: string, detail: any = {}) {
    this.dispatchEvent(new CustomEvent(name, {detail, bubbles: true, composed: true}));
  }

  private onRemoveAnalysis(id: string) {
    this.emit('analysis-remove', {idToRemove: id});
  }

  render() {
    const q = this.query.trim().toLowerCase();
    const filtered = (this.savedSessions || []).filter((s) => !q || s.title.toLowerCase().includes(q));

    return html`
      <div class="wrap">
        <div class="panel">
          <div class="header">
            <div class="title"><span class="dot"></span><span>Voice Notes</span></div>
            <div>
              <button class="hbtn" title="Novo" @click=${() => this.emit('show-analysis')}>＋</button>
            </div>
          </div>
          <div class="search">
            <span class="icon">🔎</span>
            <input
              type="search"
              placeholder="Search notes..."
              .value=${this.query}
              @input=${(e: any) => (this.query = e.target.value)} />
          </div>
          <div class="sectionLabel">FILTERS</div>
          <div class="row" @click=${() => this.emit('show-history')}>
            <div class="left"><span class="checkbox"></span><span>Categories</span></div>
            <span class="chev">›</span>
          </div>
          ${this.analyses?.length ? html`
            <div class="list">
              ${this.analyses.map(a => html`
                <span class="chip" title=${a.title}>
                  <span>${a.title}</span>
                  <button title="Remover" @click=${() => this.onRemoveAnalysis(a.id)}>×</button>
                </span>
              `)}
            </div>
          `: ''}

          <div class="list">
            ${filtered.map(s => html`
              <div class="item"
                   title=${s.title}
                   @click=${() => this.emit('load-session', {sessionId: s.id})}>${s.title}</div>
            `)}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-app-sidebar': GdmAppSidebar;
  }
}
