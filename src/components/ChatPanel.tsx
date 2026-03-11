import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  streamingContent: string;
  onSendMessage: (message: string, deepResearch?: boolean) => void;
  placeholder?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  showDeepResearch?: boolean;
}

export function ChatPanel({
  messages,
  isLoading,
  streamingContent,
  onSendMessage,
  placeholder = 'Type a message...',
  title = 'AI Assistant',
  subtitle = 'Ask questions or request changes',
  actions,
  showDeepResearch = false,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [deepResearch, setDeepResearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, streamingContent]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const displayMessages = messages.filter((m) => m.role !== 'system');

  return (
    <div className="h-full flex flex-col bg-chat">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-chat-border">
        <div>
          <h2 className="text-sm font-semibold text-chat-foreground">{title}</h2>
          <p className="text-xs text-chat-foreground/50">{subtitle}</p>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-scroll px-5 py-4 space-y-4">
        {displayMessages.length === 0 && !streamingContent && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-chat-foreground/40 text-sm mb-2">Your AI assistant is ready</p>
              <p className="text-chat-foreground/25 text-xs">Ask anything about your document</p>
            </div>
          </div>
        )}

        {displayMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-chat-user text-primary-foreground rounded-br-md'
                  : 'bg-chat-ai text-chat-foreground rounded-bl-md'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed bg-chat-ai text-chat-foreground">
              <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {isLoading && !streamingContent && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-chat-ai">
              <Loader2 className="w-4 h-4 text-chat-accent animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-chat-border">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none bg-chat-input text-chat-foreground text-sm rounded-xl px-4 py-3 placeholder:text-chat-foreground/30 focus:outline-none focus:ring-1 focus:ring-chat-accent disabled:opacity-40 border border-chat-border"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
