/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {LitElement, css, html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

// Replicating the types from the React example
interface UserData {
  name: string;
  email: string;
  avatar: string;
}

const demoUser: UserData = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  avatar: 'https://github.com/educlopez.png',
};

@customElement('gdm-user-profile')
export class GdmUserProfile extends LitElement {
  @property({type: String}) activePersona: string | null = null;
  @state() private user: UserData = demoUser;

  @state() private isDropdownOpen = false;
  @state() private isEditModalOpen = false;
  @state() private isPersonaModalOpen = false;

  // Temp state for editing profile
  @state() private tempName = '';
  @state() private tempEmail = '';

  static styles = css`
    :host {
      position: relative;
      font-family: sans-serif;
      color: #eee;
    }

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid rgba(255, 255, 255, 0.3);
      transition: border-color 0.2s;
    }

    .avatar:hover {
      border-color: #5078ff;
    }

    .dropdown {
      position: absolute;
      bottom: calc(100% + 12px);
      right: 0;
      background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%);
      border: 1px solid rgba(80, 120, 255, 0.2);
      border-radius: 16px;
      padding: 12px;
      z-index: 100;
      min-width: 260px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 
                  0 0 80px rgba(80, 120, 255, 0.1);
      display: flex;
      flex-direction: column;
      gap: 2px;
      backdrop-filter: blur(20px);
      animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .dropdown::after {
      content: '';
      position: absolute;
      bottom: -8px;
      right: 20px;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid #1e1e1e;
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 14px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.85);
      text-align: left;
      font-size: 14px;
      font-weight: 500;
      position: relative;
      overflow: hidden;
    }

    .dropdown-item::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 0;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(80, 120, 255, 0.1));
      transition: width 0.3s ease;
    }

    .dropdown-item:hover {
      background: rgba(80, 120, 255, 0.08);
      color: #fff;
      transform: translateX(2px);
    }

    .dropdown-item:hover::before {
      width: 100%;
    }

    .dropdown-item:hover svg {
      transform: scale(1.1);
      filter: drop-shadow(0 0 6px rgba(80, 120, 255, 0.5));
    }

    .dropdown-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
      margin: 8px 4px;
    }

    .dropdown-item svg {
      flex-shrink: 0;
      transition: all 0.2s ease;
      color: rgba(80, 120, 255, 0.8);
    }

    .dropdown-header {
      padding: 8px 14px;
      margin-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .user-info img {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 2px solid rgba(80, 120, 255, 0.3);
    }

    .user-details {
      flex: 1;
    }

    .user-name {
      font-weight: 600;
      font-size: 14px;
      color: #fff;
      margin-bottom: 2px;
    }

    .user-email {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
    }

    /* Modal styles */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(5px);
    }

    .modal-content {
      background: #1e1e1e;
      padding: 24px;
      border-radius: 12px;
      width: clamp(300px, 90vw, 450px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 85vh;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h4 {
      margin: 0;
      color: #5078ff;
    }

    .close-button {
      background: none;
      border: none;
      color: #aaa;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 50%;
    }
    .close-button:hover {
      color: #fff;
      background-color: rgba(255, 255, 255, 0.1);
    }

    /* Edit Profile Modal */
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .form-group label {
      font-size: 13px;
      color: #ccc;
    }

    .form-group input {
      padding: 10px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(0, 0, 0, 0.2);
      color: #eee;
      font-size: 14px;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 8px;
    }

    .modal-actions button {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-weight: 500;
    }

    .save-button {
      background: #5078ff;
      color: white;
    }

    /* Persona Modal Styles */
    .persona-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      margin: 0 -8px;
      padding: 0 8px;
    }
    .persona-item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      border: 2px solid transparent;
      background-color: rgba(255, 255, 255, 0.05);
      transition: all 0.2s ease;
      text-align: left;
      color: #eee;
      width: 100%;
    }
    .persona-item:hover {
      background-color: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .persona-item.active {
      border-color: #5078ff;
      background-color: rgba(80, 120, 255, 0.1);
    }
    .persona-name {
      font-weight: 600;
      font-size: 15px;
      margin-bottom: 4px;
    }
    .persona-description {
      font-size: 13px;
      color: #ccc;
      line-height: 1.4;
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
    if (this.isDropdownOpen && !e.composedPath().includes(this)) {
      this.isDropdownOpen = false;
    }
  };

  private toggleDropdown(e: Event) {
    e.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  private openEditModal() {
    this.tempName = this.user.name;
    this.tempEmail = this.user.email;
    this.isEditModalOpen = true;
    this.isDropdownOpen = false;
  }

  private openHistoryModal() {
    this.dispatchEvent(
      new CustomEvent('show-history', {bubbles: true, composed: true}),
    );
    this.isDropdownOpen = false;
  }

  private openPersonaModal() {
    this.isPersonaModalOpen = true;
    this.isDropdownOpen = false;
  }

  private selectPersona(persona: string | null) {
    this.dispatchEvent(
      new CustomEvent('persona-change', {
        detail: {persona},
        bubbles: true,
        composed: true,
      }),
    );
    this.isPersonaModalOpen = false;
  }

  private handleSaveProfile() {
    this.user = {...this.user, name: this.tempName, email: this.tempEmail};
    this.isEditModalOpen = false;
  }

  render() {
    return html`
      <div>
        <img
          src="${this.user.avatar}"
          alt="User Avatar"
          class="avatar"
          @click=${this.toggleDropdown} />

        ${this.isDropdownOpen
          ? html`
              <div class="dropdown">
                <div class="dropdown-header">
                  <div class="user-info">
                    <img src="${this.user.avatar}" alt="${this.user.name}" />
                    <div class="user-details">
                      <div class="user-name">${this.user.name}</div>
                      <div class="user-email">${this.user.email}</div>
                    </div>
                  </div>
                </div>
                
                <button class="dropdown-item" @click=${this.openEditModal}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="20px"
                    viewBox="0 -960 960 960"
                    width="20px"
                    fill="currentColor">
                    <path
                      d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z" />
                  </svg>
                  <span>Editar Perfil</span>
                </button>
                
                <button class="dropdown-item" @click=${this.openPersonaModal}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="20px"
                    viewBox="0 -960 960 960"
                    width="20px"
                    fill="currentColor">
                    <path
                      d="M480-400q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0 160q-100 0-170-70t-70-170q0-100 70-170t170-70q100 0 170 70t70 170q0 100-70 170t-170 70Zm0-320q-17 0-28.5 11.5T440-520q0 17 11.5 28.5T480-480q17 0 28.5-11.5T520-520q0-17-11.5-28.5T480-560Zm0 320q66 0 113-47t47-113q0-66-47-113t-113-47q-66 0-113 47t-47 113q0 66 47 113t113 47Zm0-480q134 0 227 93t93 227q0 134-93 227t-227 93q-134 0-227-93t-93-227q0-134 93-227t227-93Z" />
                  </svg>
                  <span>Alterar Persona</span>
                </button>
                
                <div class="dropdown-divider"></div>
                
                <button
                  class="dropdown-item"
                  @click=${this.openHistoryModal}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="20px"
                    viewBox="0 -960 960 960"
                    width="20px"
                    fill="currentColor">
                    <path
                      d="M480-120q-138 0-240.5-91.5T122-440h82q14 104 92.5 172T480-200q117 0 198.5-81.5T760-480q0-117-81.5-198.5T480-760q-69 0-129 32t-101 88h110v80H120v-240h80v94q51-64 124.5-99T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm112-192L440-464v-216h80v184l128 128-56 56Z" />
                  </svg>
                  <span>Histórico de Sessões</span>
                </button>
              </div>
            `
          : ''}
      </div>

      ${this.isEditModalOpen ? this.renderEditModal() : ''}
      ${this.isPersonaModalOpen ? this.renderPersonaModal() : ''}
    `;
  }

  renderEditModal() {
    return html`
      <div class="modal-overlay" @click=${() => (this.isEditModalOpen = false)}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h4>Edit Profile</h4>
            <button
              class="close-button"
              @click=${() => (this.isEditModalOpen = false)}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="24px"
                viewBox="0 -960 960 960"
                width="24px"
                fill="currentColor">
                <path
                  d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
              </svg>
            </button>
          </div>
          <div class="form-group">
            <label for="name">Name</label>
            <input
              id="name"
              type="text"
              .value=${this.tempName}
              @input=${(e: Event) =>
                (this.tempName = (e.target as HTMLInputElement).value)} />
          </div>
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              .value=${this.tempEmail}
              @input=${(e: Event) =>
                (this.tempEmail = (e.target as HTMLInputElement).value)} />
          </div>
          <div class="modal-actions">
            <button class="save-button" @click=${this.handleSaveProfile}>
              Save
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderPersonaModal() {
    const personas = [
      {
        key: 'tutor',
        name: 'Tutor',
        description: 'Ensina sobre o conteúdo de forma didática.',
      },
      {
        key: 'coding-engineer',
        name: 'Engenheiro de Codificação',
        description: 'Fornece respostas técnicas e focadas em código.',
      },
      {
        key: 'direct',
        name: 'Direto',
        description: 'Responde de forma rápida e objetiva.',
      },
      {
        key: 'data-analyst',
        name: 'Analista de Dados',
        description: 'Atua como um parceiro de negócios focado em dados.',
      },
    ];

    return html`
      <div
        class="modal-overlay"
        @click=${() => (this.isPersonaModalOpen = false)}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h4>Selecione uma Persona</h4>
            <button
              class="close-button"
              @click=${() => (this.isPersonaModalOpen = false)}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="24px"
                viewBox="0 -960 960 960"
                width="24px"
                fill="currentColor">
                <path
                  d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
              </svg>
            </button>
          </div>
          <div class="persona-list">
            ${personas.map(
              (p) => html`
                <button
                  class="persona-item ${this.activePersona === p.key
                    ? 'active'
                    : ''}"
                  @click=${() => this.selectPersona(p.key)}>
                  <span class="persona-name">${p.name}</span>
                  <span class="persona-description">${p.description}</span>
                </button>
              `,
            )}
            <button
              class="persona-item ${!this.activePersona ? 'active' : ''}"
              @click=${() => this.selectPersona(null)}>
              <span class="persona-name">Padrão</span>
              <span class="persona-description"
                >O assistente prestativo e geral.</span
              >
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-user-profile': GdmUserProfile;
  }
}
