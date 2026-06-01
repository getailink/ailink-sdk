// ─────────────────────────────────────────────
// AILink — React Chat Widget
// Drop this into any React/Next.js project.
// Styles are injected inline — no external CSS file required.
// This ensures styles are always present when installed from npm.
// ─────────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react';

// Inline styles — injected once per page.
// Removed import './widget.css' (Fix 11): that file is not included in the
// npm dist folder because tsconfig only compiles .ts files. Widget would
// render with no styles after npm install without this change.
const WIDGET_CSS = `
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

/** Inject widget CSS once into the document head. Safe to call multiple times. */
function injectStyles() {
  if (typeof document === 'undefined') return // SSR guard
  if (document.getElementById('ailink-widget-styles')) return
  const style = document.createElement('style')
  style.id = 'ailink-widget-styles'
  style.textContent = WIDGET_CSS
  document.head.appendChild(style)
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
}

interface AILinkWidgetProps {
  /** Your backend endpoint that calls ai.run() and returns { response: string } */
  endpoint: string;
  /** Widget header title. Default: 'AI Assistant' */
  title?: string;
  /** Input placeholder. Default: 'Ask me anything...' */
  placeholder?: string;
  /** Color theme. Default: 'light' */
  theme?: 'light' | 'dark';
  /** Widget position. Default: 'bottom-right' */
  position?: 'bottom-right' | 'bottom-left';
}

export function AILinkWidget({
  endpoint,
  title = 'AI Assistant',
  placeholder = 'Ask me anything...',
  theme = 'light',
  position = 'bottom-right',
}: AILinkWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  // Stable session ID generated once per widget mount — passed with every request
  // so the backend can maintain multi-turn conversation history
  const [sessionId] = useState(() => crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Inject inline styles once on mount (Fix 11: replaces import './widget.css')
  useEffect(() => { injectStyles() }, []);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      });

      if (!response.ok) {
        // Try to surface the backend's specific error message before falling back
        let serverError = `Server error: ${response.status}`;
        try {
          const errData = await response.json();
          serverError = errData?.error ?? errData?.message ?? serverError;
        } catch { /* ignore parse failure */ }
        throw new Error(serverError);
      }

      const data = await response.json();

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'No response received.',
      }]);
    } catch (err: any) {
      // Surface real backend error message — avoids hiding rate limits, auth failures, etc.
      const errorMessage = err.response?.data?.error ?? err.message ?? 'Something went wrong.';
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'error',
        content: errorMessage,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`ailink-widget ailink-widget--${position} ailink-widget--${theme}`}>
      {open && (
        <div className="ailink-window">
          {/* Header */}
          <div className="ailink-header">
            <span className="ailink-header-title">{title}</span>
            <button className="ailink-header-close" onClick={() => setOpen(false)}>×</button>
          </div>

          {/* Messages */}
          <div className="ailink-messages">
            {messages.length === 0 && (
              <div className="ailink-message ailink-message--assistant">
                Hi! How can I help you today?
              </div>
            )}
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`ailink-message ailink-message--${msg.role}`}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="ailink-typing">
                <span /><span /><span />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="ailink-input-area">
            <textarea
              ref={inputRef}
              className="ailink-input"
              placeholder={placeholder}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />
            <button
              className="ailink-send"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button className="ailink-toggle" onClick={() => setOpen(!open)}>
        {open ? (
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        ) : (
          <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
        )}
      </button>
    </div>
  );
}

export default AILinkWidget;
