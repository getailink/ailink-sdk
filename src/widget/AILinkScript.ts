// ─────────────────────────────────────────────
// AILink — Plain HTML Script Widget
// For non-React projects.
// Reads config from data attributes on a div.
// ─────────────────────────────────────────────

(function () {
  // Inline styles — no external CDN dependency.
  // Previously loaded from CDN (widget.css) which
  // does not exist yet and would silently break styling for every user.
  const INLINE_CSS = `
.ailink-widget{position:fixed;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.ailink-widget--bottom-right{bottom:24px;right:24px}
.ailink-widget--bottom-left{bottom:24px;left:24px}
.ailink-toggle{width:56px;height:56px;border-radius:50%;background:#6C47FF;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(108,71,255,.4);transition:transform .2s,box-shadow .2s}
.ailink-toggle:hover{transform:scale(1.05);box-shadow:0 6px 20px rgba(108,71,255,.5)}
.ailink-toggle svg{width:24px;height:24px;fill:white}
.ailink-window{position:absolute;bottom:70px;width:360px;height:500px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.15);display:flex;flex-direction:column;overflow:hidden;animation:ailink-slide-up .2s ease}
.ailink-widget--bottom-right .ailink-window{right:0}
.ailink-widget--bottom-left .ailink-window{left:0}
@keyframes ailink-slide-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.ailink-header{background:#6C47FF;color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between}
.ailink-header-title{font-weight:600;font-size:15px}
.ailink-header-close{background:none;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;opacity:.8;padding:0}
.ailink-header-close:hover{opacity:1}
.ailink-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.ailink-messages::-webkit-scrollbar{width:4px}
.ailink-messages::-webkit-scrollbar-thumb{background:#e0e0e0;border-radius:2px}
.ailink-message{max-width:80%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5}
.ailink-message--user{background:#6C47FF;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.ailink-message--assistant{background:#f5f5f5;color:#0A0A0A;align-self:flex-start;border-bottom-left-radius:4px}
.ailink-message--error{background:#FFF0F0;color:#EF4444;align-self:flex-start;border:1px solid #FECACA}
.ailink-typing{display:flex;align-items:center;gap:4px;padding:10px 14px;background:#f5f5f5;border-radius:12px;border-bottom-left-radius:4px;align-self:flex-start}
.ailink-typing span{width:6px;height:6px;background:#aaa;border-radius:50%;animation:ailink-bounce 1.2s infinite}
.ailink-typing span:nth-child(2){animation-delay:.2s}
.ailink-typing span:nth-child(3){animation-delay:.4s}
@keyframes ailink-bounce{0%,80%,100%{transform:scale(.8);opacity:.5}40%{transform:scale(1.1);opacity:1}}
.ailink-input-area{padding:12px 16px;border-top:1px solid #f0f0f0;display:flex;gap:8px}
.ailink-input{flex:1;border:1px solid #e0e0e0;border-radius:8px;padding:10px 12px;font-size:14px;outline:none;resize:none;font-family:inherit;transition:border-color .2s}
.ailink-input:focus{border-color:#6C47FF}
.ailink-send{width:38px;height:38px;background:#6C47FF;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .2s;align-self:flex-end}
.ailink-send:hover{background:#5535ee}
.ailink-send:disabled{background:#c4b5fd;cursor:not-allowed}
.ailink-send svg{width:16px;height:16px;fill:white}
.ailink-widget--dark .ailink-window{background:#1a1a2e}
.ailink-widget--dark .ailink-message--assistant{background:#252540;color:#e0e0e0}
.ailink-widget--dark .ailink-typing{background:#252540}
.ailink-widget--dark .ailink-input-area{border-color:#333}
.ailink-widget--dark .ailink-input{background:#252540;border-color:#444;color:#e0e0e0}
.ailink-widget--dark .ailink-input:focus{border-color:#6C47FF}
@media(max-width:480px){.ailink-window{width:calc(100vw - 32px)}.ailink-widget--bottom-right{right:16px;bottom:16px}.ailink-widget--bottom-left{left:16px;bottom:16px}}
`

  // Wait for the DOM to be fully loaded before accessing elements.
  // Without this, scripts placed in <head> silently fail — the widget div
  // doesn't exist yet when the IIFE executes immediately.
  document.addEventListener('DOMContentLoaded', function() {
  // Find the ailink widget container
  const container = document.getElementById('ailink-widget');
  if (!container) return;
  const widgetContainer = container;

  const endpoint = widgetContainer.dataset.endpoint || '/api/ailink';
  const title = widgetContainer.dataset.title || 'AI Assistant';
  const placeholder = widgetContainer.dataset.placeholder || 'Ask me anything...';
  const theme = widgetContainer.dataset.theme || 'light';
  const position = widgetContainer.dataset.position || 'bottom-right';

  // Inject styles inline — no external CDN required
  const style = document.createElement('style');
  style.textContent = INLINE_CSS;
  document.head.appendChild(style);

  // State
  let open = false;
  let loading = false;
  const messages: Array<{ role: string; content: string }> = [];
  // Stable session ID for multi-turn memory — generated once per page load
  const sessionId: string = crypto.randomUUID();

  // Build widget HTML
  widgetContainer.className = `ailink-widget ailink-widget--${position} ailink-widget--${theme}`;

  function render() {
    widgetContainer.innerHTML = `
      ${open ? `
        <div class="ailink-window">
          <div class="ailink-header">
            <span class="ailink-header-title"></span>
            <button class="ailink-header-close" id="ailink-close">×</button>
          </div>
          <div class="ailink-messages" id="ailink-messages"></div>
          <div class="ailink-input-area">
            <textarea class="ailink-input" id="ailink-input" rows="1"></textarea>
            <button class="ailink-send" id="ailink-send">
              <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>
      ` : ''}
      <button class="ailink-toggle" id="ailink-toggle">
        <svg viewBox="0 0 24 24">
          ${open
            ? '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>'
            : '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>'
          }
        </svg>
      </button>
    `;

    if (open) {
      const headerTitle = widgetContainer.querySelector('.ailink-header-title');
      if (headerTitle) {
        headerTitle.textContent = title;
      }
      const inputEl = widgetContainer.querySelector('#ailink-input') as HTMLTextAreaElement;
      if (inputEl) {
        inputEl.placeholder = placeholder;
      }
      const sendBtn = widgetContainer.querySelector('#ailink-send') as HTMLButtonElement;
      if (sendBtn) {
        sendBtn.disabled = loading;
      }
    }

    const messagesContainer = document.getElementById('ailink-messages');
    if (messagesContainer) {
      if (messages.length === 0) {
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'ailink-message ailink-message--assistant';
        welcomeMsg.textContent = 'Hi! How can I help you today?';
        messagesContainer.appendChild(welcomeMsg);
      } else {
        messages.forEach(m => {
          const msgDiv = document.createElement('div');
          msgDiv.className = `ailink-message ailink-message--${m.role}`;
          msgDiv.textContent = m.content;
          messagesContainer.appendChild(msgDiv);
        });
      }

      if (loading) {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'ailink-typing';
        for (let i = 0; i < 3; i++) {
          const dot = document.createElement('span');
          typingDiv.appendChild(dot);
        }
        messagesContainer.appendChild(typingDiv);
      }
    }

    bindEvents();
    scrollToBottom();
  }

  function bindEvents() {
    document.getElementById('ailink-toggle')?.addEventListener('click', () => {
      open = !open;
      render();
      if (open) document.getElementById('ailink-input')?.focus();
    });

    document.getElementById('ailink-close')?.addEventListener('click', () => {
      open = false;
      render();
    });

    document.getElementById('ailink-send')?.addEventListener('click', sendMessage);

    document.getElementById('ailink-input')?.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter' && !ke.shiftKey) {
        ke.preventDefault();
        sendMessage();
      }
    });
  }

  function scrollToBottom() {
    const el = document.getElementById('ailink-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  async function sendMessage() {
    const inputEl = document.getElementById('ailink-input') as HTMLTextAreaElement;
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text || loading) return;

    messages.push({ role: 'user', content: text });
    inputEl.value = '';
    loading = true;
    render();

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      });
      if (!res.ok) {
        // Attempt to extract specific backend error before falling back to generic message
        let errMsg = `Server error: ${res.status}`;
        try {
          const errData = await res.json();
          errMsg = errData?.error ?? errData?.message ?? errMsg;
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }
      const data = await res.json();
      messages.push({ role: 'assistant', content: data.response || 'No response.' });
    } catch (err: any) {
      // Surface real error — rate limits, auth failures, etc. are now visible
      const errorMessage = err.response?.data?.error ?? err.message ?? 'Something went wrong.';
      messages.push({ role: 'error', content: errorMessage });
    } finally {
      loading = false;
      render();
    }
  }

  function escapeHtml(str: string) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  render();
  }); // end DOMContentLoaded
})();
