import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, User, Sparkles, Copy, Check, Lightbulb, Trash2, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { UserProfile, ReferenceItem } from '@/lib/store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const suggestions = [
  { icon: '🎬', text: 'Me dê 5 ideias de vídeos virais para TikTok' },
  { icon: '🪝', text: 'Crie 5 hooks poderosos para os primeiros 3 segundos' },
  { icon: '📢', text: 'Gere 5 CTAs criativos para engajar a audiência' },
  { icon: '📝', text: 'Crie uma legenda otimizada para um vídeo de review' },
  { icon: '#️⃣', text: 'Sugira hashtags trending para nicho de tech' },
  { icon: '🛒', text: 'Dê ideias de produtos para TikTok Shop' },
  { icon: '📈', text: 'Estratégias para crescer de 0 a 10k seguidores' },
  { icon: '💰', text: 'Como monetizar um perfil com 5k seguidores' },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Message[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    onError(data.error || `Erro ${resp.status}`);
    return;
  }

  if (!resp.body) { onError('Sem resposta'); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;

  while (!done) {
    const { done: readerDone, value } = await reader.read();
    if (readerDone) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') { done = true; break; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buffer = line + '\n' + buffer;
        break;
      }
    }
  }

  // flush
  if (buffer.trim()) {
    for (let raw of buffer.split('\n')) {
      if (!raw) continue;
      if (raw.endsWith('\r')) raw = raw.slice(0, -1);
      if (!raw.startsWith('data: ')) continue;
      const json = raw.slice(6).trim();
      if (json === '[DONE]') continue;
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {}
    }
  }

  onDone();
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copiado!');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Copiar">
      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

interface AIChatViewProps {
  profile: UserProfile;
  onUpdate: (u: Partial<UserProfile>) => void;
  onXP: (n: number) => void;
}

export function AIChatView({ profile, onUpdate, onXP }: AIChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: newMessages,
        onDelta: upsert,
        onDone: () => setIsLoading(false),
        onError: (msg) => {
          toast.error(msg);
          setIsLoading(false);
        },
      });
    } catch {
      toast.error('Erro ao conectar com a IA');
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-wide text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> Pesquisa <span className="text-primary">AI</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Seu assistente inteligente para criação de conteúdo</p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearChat} className="gap-2 text-muted-foreground">
            <Trash2 className="w-3.5 h-3.5" /> Limpar
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-16 h-16 rounded-2xl gradient-red flex items-center justify-center pulse-glow">
              <Bot className="w-8 h-8 text-primary-foreground" />
            </div>
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              Pergunte qualquer coisa sobre TikTok, estratégias de conteúdo, trends e crescimento.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full">
              {suggestions.map(s => (
                <button
                  key={s.text}
                  onClick={() => send(s.text)}
                  className="text-left p-3 rounded-lg bg-secondary border border-border hover:border-primary/30 hover:bg-primary/5 text-xs text-foreground transition-all flex items-start gap-2"
                >
                  <span className="text-base">{s.icon}</span>
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}
          >
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg gradient-red flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
            <div className={`max-w-[75%] rounded-xl p-4 text-sm ${
              m.role === 'user'
                ? 'bg-primary/15 text-foreground border border-primary/30'
                : 'glass-card text-foreground'
            }`}>
              {m.role === 'assistant' ? (
                <div className="prose prose-sm prose-invert max-w-none prose-p:text-foreground/80 prose-li:text-foreground/80 prose-headings:text-gradient-red prose-headings:font-black prose-strong:text-yellow-300 prose-strong:font-bold prose-strong:drop-shadow-[0_0_8px_hsl(48_96%_53%/0.7)] prose-em:text-cyan-300 prose-em:font-semibold prose-em:not-italic prose-code:text-pink-300 prose-code:bg-pink-500/15 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-l-4 prose-blockquote:border-purple-400/60 prose-blockquote:bg-purple-500/10 prose-blockquote:text-purple-200 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded-r prose-blockquote:not-italic prose-a:text-emerald-300 prose-a:font-semibold prose-li:marker:text-orange-400 prose-ol:marker:text-orange-400">
                  <ReactMarkdown
                    components={{
                      li: ({ children }) => {
                        const colors = ['text-cyan-300', 'text-yellow-300', 'text-pink-300', 'text-emerald-300', 'text-purple-300', 'text-orange-300', 'text-blue-300'];
                        const text = String(children);
                        let hash = 0;
                        for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
                        const color = colors[hash % colors.length];
                        return <li className={`${color} font-semibold drop-shadow-[0_0_6px_currentColor]`}>{children}</li>;
                      },
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <span>{m.content}</span>
              )}
              {m.role === 'assistant' && m.content && (
                <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border">
                  <CopyButton text={m.content} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
                        title="Salvar como ideia"
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[160px]">
                      {([
                        { value: 'crescimento', label: '📈 Crescimento' },
                        { value: 'monetizacao', label: '💰 Monetização' },
                        { value: 'vendas', label: '🛒 Vendas' },
                      ] as const).map(cat => (
                        <DropdownMenuItem
                          key={cat.value}
                          onClick={() => {
                            const ref: ReferenceItem = {
                              id: Date.now().toString(),
                              type: 'idea',
                              url: '',
                              title: m.content.slice(0, 80).replace(/[#*\n]/g, '').trim(),
                              niche: 'IA',
                              description: m.content,
                              category: cat.value,
                              refType: 'hook',
                              createdAt: new Date().toISOString(),
                              favorite: false,
                            };
                            onUpdate({ references: [...profile.references, ref] });
                            onXP(1);
                            toast.success(`Ideia salva como ${cat.label}! Acesse em Inspirações.`);
                          }}
                        >
                          {cat.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </motion.div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg gradient-red flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-4 border-t border-border">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
          placeholder="Pergunte sobre TikTok, trends, estratégias..."
          className="bg-secondary border-border flex-1"
          disabled={isLoading}
        />
        <Button onClick={() => send(input)} className="gradient-red text-primary-foreground glow-red" size="icon" disabled={isLoading}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
