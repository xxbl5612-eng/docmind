import { useState, useRef, useCallback, useEffect } from 'react';
import { chatApi } from '@/lib/api';
import type { ApiResponse, ChatMessage, ChatResponseData } from '@/types';

const QUICK_ACTIONS = [
  { label: '文档处理', prompt: 'DocMind 可以处理哪些类型的文档？每个功能怎么使用？' },
  { label: '文档摘要', prompt: '如何使用 AI 对文档进行摘要？' },
  { label: '格式转换', prompt: 'DocMind 支持哪些格式转换？' },
  { label: '协作功能', prompt: 'DocMind 的实时协作功能怎么用？' },
];

const INITIAL_POSITION = { x: 0, y: 0 }; // Will be calculated

interface Props {
  documentId?: string | null;
  documentTitle?: string;
}

export default function DraggableAiAssistant({ documentId, documentTitle }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: documentId
        ? `你好！我是 DocMind 智能助手。我看到你正在查看「${documentTitle || '文档'}」，有什么我可以帮助你的吗？`
        : '你好！我是 DocMind 智能助手。我可以帮你了解项目功能、解答文档处理问题，以及提供各种知识帮助。请问有什么需要？',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(INITIAL_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0, startY: 0, posX: 0, posY: 0,
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize position on client side
  useEffect(() => {
    if (position.x === 0 && position.y === 0) {
      setPosition({
        x: window.innerWidth - 420,
        y: window.innerHeight - 560,
      });
    }
  }, [position.x, position.y]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Clamp position to keep panel within viewport
  const clampPosition = useCallback((x: number, y: number) => {
    const pw = panelRef.current?.offsetWidth || 380;
    const ph = panelRef.current?.offsetHeight || 520;
    return {
      x: Math.max(0, Math.min(x, window.innerWidth - pw)),
      y: Math.max(0, Math.min(y, window.innerHeight - ph)),
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newPos = clampPosition(
        dragRef.current.posX + dx,
        dragRef.current.posY + dy,
      );
      setPosition(newPos);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, clampPosition]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const { data } = await chatApi.send(newMessages, documentId);
      const resp = data as ApiResponse<ChatResponseData>;
      if (resp.success && resp.data) {
        setMessages([...newMessages, { role: 'assistant', content: resp.data.message }]);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: '抱歉，我暂时无法回答这个问题。请稍后再试。' }]);
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: '网络连接失败，请检查网络后重试。' }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, documentId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }, [input, sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([
      {
        role: 'assistant',
        content: documentId
          ? `好的，已清空对话。我仍然可以看到「${documentTitle || '文档'}」，有什么需要帮助的吗？`
          : '好的，已清空对话。有什么新的问题吗？',
      },
    ]);
  }, [documentId, documentTitle]);

  // Minimized floating button
  if (!isOpen) {
    return (
      <div
        className="fixed z-50 cursor-pointer group"
        style={{ right: 24, bottom: 24 }}
        onClick={() => setIsOpen(true)}
      >
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
        </div>
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white" />
        <div className="absolute right-16 top-1/2 -translate-y-1/2 bg-surface-800 text-white text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          需要帮助吗？
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-[380px] bg-white rounded-2xl shadow-2xl border border-surface-200 flex flex-col overflow-hidden transition-shadow"
      style={{
        left: position.x,
        top: position.y,
        height: '520px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}
    >
      {/* Header with drag handle */}
      <div
        className={`flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white shrink-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 select-none">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
          <span className="font-semibold text-sm">DocMind 助手</span>
          {documentTitle && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full max-w-[120px] truncate">
              {documentTitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white"
            title="清空对话"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white"
            title="最小化"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-50">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary-500 text-white rounded-br-md'
                  : 'bg-white text-surface-700 rounded-bl-md border border-surface-200 shadow-sm'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-surface-500 rounded-2xl rounded-bl-md px-4 py-3 border border-surface-200 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      {messages.length <= 1 && (
        <div className="px-4 py-2 bg-surface-50 border-t border-surface-100 shrink-0">
          <p className="text-xs text-surface-400 mb-2">快速提问</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                className="text-xs px-2.5 py-1.5 rounded-full bg-white border border-surface-200 text-surface-600 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-3 bg-white border-t border-surface-200 shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 rounded-xl border border-surface-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-surface-100 disabled:text-surface-400"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-xl bg-primary-500 text-white hover:bg-primary-600 disabled:bg-surface-200 disabled:text-surface-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
