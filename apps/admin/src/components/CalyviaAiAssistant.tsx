'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Minus,
  Send,
  RotateCcw,
  Bot,
  User,
  ShieldCheck,
  ChevronRight,
  Maximize2,
  Calendar,
  Activity,
  BedDouble,
  CreditCard,
  AlertCircle,
  HelpCircle,
  Stethoscope,
} from 'lucide-react';
import { useAuth } from './AuthContext';

interface CalyviaAiAssistantProps {
  /** Active admin module, sent to the API so answers can be context-aware. */
  activeModule?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedFollowUps?: string[];
  referencedModules?: string[];
}

interface HeadsetIconProps extends React.SVGProps<SVGSVGElement> {}

export const PulseHeadsetIcon: React.FC<HeadsetIconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Headset arc */}
    <path d="M4 12V9a8 8 0 0 1 16 0v3" />
    {/* Left earpiece */}
    <rect x="2" y="11" width="4" height="6" rx="2" />
    {/* Right earpiece */}
    <rect x="18" y="11" width="4" height="6" rx="2" />
    {/* Microphone boom and mic */}
    <path d="M19 17v1a3 3 0 0 1-3 3h-2" />
    <circle cx="13" cy="21" r="1" fill="currentColor" />
    {/* Center vital/sound wave bridging the ears */}
    <path d="M6 14h3l1.5-2.5 2 5 1.5-2.5h4" />
  </svg>
);

export const CalyviaAiAssistant: React.FC<CalyviaAiAssistantProps> = ({ activeModule }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user, token } = useAuth();

  const canViewBilling = [
    'SUPER_ADMIN',
    'FACILITY_ADMIN',
    'MEDICAL_DIRECTOR',
    'FINANCE_BILLING',
    'MANAGEMENT_EXECUTIVE',
  ].includes(String(user?.role || ''));

  const initialSuggestions = [
    'Give me today\'s operational summary',
    'What appointments are scheduled for today?',
    'Summarize bed census & ward occupancy',
    ...(canViewBilling ? ['Summarize outstanding invoices and billing'] : []),
  ];

  // Initial welcome greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-1',
          role: 'assistant',
          content: `Hello **${user?.fullName || 'there'}** 👋\n\nI am **Calyvia AI**, your institutional copilot. I answer from live Calyvia operational data and will say when a figure is unavailable.\n\nI can help with **bed census**, **appointments**, ${canViewBilling ? '**billing**,' : ''} **detox protocols (CIWA/COWS)**, and navigating the **28 system modules**.\n\n*What would you like to review?*`,
          timestamp: new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
          suggestedFollowUps: initialSuggestions,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, canViewBilling]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Call backend API (uses NEXT_PUBLIC_API_URL with localhost fallback for local development)
      const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const apiEndpoint = configuredApiUrl.endsWith('/api/v1')
        ? `${configuredApiUrl}/ai-extension/chat`
        : `${configuredApiUrl.replace(/\/$/, '')}/api/v1/ai-extension/chat`;

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          message: text,
          conversationHistory: messages.slice(-4).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          contextModule: activeModule,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
          suggestedFollowUps: data.suggestedFollowUps,
          referencedModules: data.referencedModules,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error(`API request failed (${res.status})`);
      }
    } catch (err: any) {
      // Never invent metrics when the grounded service is unavailable.
      const isAuthError = String(err?.message || '').includes('401');
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: isAuthError
          ? `Your session has expired. Please sign in again before asking Calyvia AI.`
          : `I could not reach the live Calyvia data service, so I have not guessed any figures. Please retry in a moment.`,
        timestamp: new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
        suggestedFollowUps: ['Retry: give me today\'s operational summary'],
        referencedModules: [],
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Conversation reset. Ready for a new institutional query. What would you like to review?`,
        timestamp: new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
        suggestedFollowUps: initialSuggestions,
      },
    ]);
  };

  // Helper function to render simple markdown formatting
  const renderFormattedText = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-1.5 text-xs leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} className="h-1" />;
          }

          // Headers
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-serif text-sm font-bold text-foreground pt-1.5 pb-0.5 border-b border-border/60">
                {line.replace('### ', '')}
              </h4>
            );
          }
          if (line.startsWith('#### ')) {
            return (
              <h5 key={idx} className="font-semibold text-xs text-foreground pt-1 text-primary">
                {line.replace('#### ', '')}
              </h5>
            );
          }

          // Bullet points
          if (line.startsWith('* ') || line.startsWith('- ')) {
            const raw = line.substring(2);
            return (
              <div key={idx} className="flex items-start space-x-1.5 pl-1">
                <span className="text-primary font-bold">•</span>
                <span>{renderInline(raw)}</span>
              </div>
            );
          }

          // Numbered lists
          if (/^\d+\.\s/.test(line)) {
            return (
              <div key={idx} className="flex items-start space-x-1.5 pl-1">
                <span className="font-mono text-primary font-semibold">{line.match(/^\d+\./)?.[0]}</span>
                <span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
              </div>
            );
          }

          // Tables (simple line)
          if (line.startsWith('|') && line.endsWith('|')) {
            if (line.includes('---')) return null;
            const cells = line.split('|').filter(c => c.trim().length > 0);
            return (
              <div key={idx} className="grid grid-cols-4 gap-1 p-1 bg-surface-subtle rounded border border-border/60 text-[11px] font-mono">
                {cells.map((c, i) => (
                  <span key={i} className="truncate">{renderInline(c.trim())}</span>
                ))}
              </div>
            );
          }

          return (
            <p key={idx}>{renderInline(line)}</p>
          );
        })}
      </div>
    );
  };

  // Render formatting as React nodes so model/tool text is never injected as HTML.
  const renderInline = (text: string): React.ReactNode[] =>
    text
      .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
      .filter((token) => token.length > 0)
      .map((token, idx) => {
        if (token.startsWith('**') && token.endsWith('**')) {
          return (
            <strong key={idx} className="font-semibold text-foreground">
              {token.slice(2, -2)}
            </strong>
          );
        }
        if (token.startsWith('`') && token.endsWith('`')) {
          return (
            <code
              key={idx}
              className="px-1 py-0.5 bg-surface-subtle border border-border rounded text-[11px] font-mono text-primary"
            >
              {token.slice(1, -1)}
            </code>
          );
        }
        return <React.Fragment key={idx}>{token}</React.Fragment>;
      });

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 md:right-8 z-30 pb-safe">
        {!isOpen && (
          <button
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            title="Open Calyvia AI assistant"
            aria-label="Open Calyvia AI assistant"
            className="group relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-primary hover:bg-primary-hover active:scale-95 text-primary-foreground rounded-full shadow-elevated border border-primary/20 hover:-translate-y-1 transition-all duration-200 cursor-pointer focus-visible:ring-4 focus-visible:ring-primary/40 focus-visible:outline-hidden"
          >
            <PulseHeadsetIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground group-hover:scale-105 transition-transform duration-200" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-primary animate-pulse" />
          </button>
        )}
      </div>

      {/* AI Chat Panel / Popup */}
      {isOpen && (
        <div
          className={`fixed bottom-20 md:bottom-6 right-2 sm:right-6 md:right-8 z-50 flex flex-col bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden transition-all duration-200 ${
            isMinimized
              ? 'w-72 h-14'
              : 'w-[420px] max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-7rem)] sm:max-h-[calc(100vh-6rem)]'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 bg-surface-subtle border-b border-border flex items-center justify-between flex-shrink-0 select-none">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 shadow-xs">
                <PulseHeadsetIcon className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="font-serif text-sm font-bold text-foreground truncate">
                    Calyvia AI
                  </h3>
                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live Supabase</span>
                  </span>
                </div>
                {!isMinimized && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    Wellness Center Management Assistant
                  </p>
                )}
              </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center space-x-1">
              {!isMinimized && (
                <button
                  onClick={handleResetChat}
                  title="New Conversation"
                  aria-label="New Conversation"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Expand' : 'Minimize'}
                aria-label={isMinimized ? 'Expand' : 'Minimize'}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden cursor-pointer"
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                aria-label="Close Assistant"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger-soft transition-colors focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-hidden cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Conversation Area (Visible when not minimized) */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-start space-x-2 max-w-[92%]">
                        {!isUser && (
                          <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Bot className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div
                          className={`p-3.5 rounded-2xl shadow-xs ${
                            isUser
                              ? 'bg-primary text-primary-foreground rounded-tr-xs font-medium'
                              : 'bg-surface-subtle border border-border text-foreground rounded-tl-xs'
                          }`}
                        >
                          {isUser ? (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          ) : (
                            renderFormattedText(msg.content)
                          )}
                        </div>
                      </div>

                      {/* Timestamp & Module chips */}
                      <div className="flex items-center space-x-2 px-1 pt-1 text-[10px] text-muted-foreground">
                        <span>{msg.timestamp}</span>
                        {msg.referencedModules && msg.referencedModules.length > 0 && (
                          <span className="flex items-center space-x-1 font-mono text-[9px] text-primary">
                            <span>•</span>
                            <span>Modules: {msg.referencedModules.join(', ')}</span>
                          </span>
                        )}
                      </div>

                      {/* Suggested Follow-ups on latest assistant message */}
                      {!isUser && msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5 pl-8">
                          {msg.suggestedFollowUps.map((prompt, i) => (
                            <button
                              key={i}
                              onClick={() => handleSendMessage(prompt)}
                              className="text-[11px] px-2.5 py-1 rounded-xl bg-surface border border-border text-foreground hover:bg-primary-soft hover:text-primary hover:border-primary/30 transition-all text-left shadow-2xs flex items-center space-x-1"
                            >
                              <span>{prompt}</span>
                              <ChevronRight className="w-3 h-3 text-muted-foreground" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Loading / Thinking Indicator */}
                {isLoading && (
                  <div className="flex items-start space-x-2 max-w-[85%] animate-pulse">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    </div>
                    <div className="p-3 rounded-2xl bg-surface-subtle border border-border text-muted-foreground text-xs rounded-tl-xs">
                      Calyvia AI is reviewing live institutional data...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="p-3 bg-surface border-t border-border space-y-2">
                <div className="relative flex items-end bg-surface-subtle border border-border rounded-2xl p-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about bed census, appointments, billing, or protocols..."
                    className="w-full bg-transparent px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none resize-none max-h-28"
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim() || isLoading}
                    title="Send message"
                    aria-label="Send message"
                    className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-xs flex-shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Privacy & Governance Notice */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                  <div className="flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3 text-secondary" />
                    <span>Role-based data access • No diagnosis or prescribing</span>
                  </div>
                  <span className="font-mono">Press ↵ to send</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
