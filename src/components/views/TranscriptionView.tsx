import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Copy, Search, Trash2, ExternalLink, Globe, FileText, Bookmark, Download, Loader2, Languages, Play, Clock, X, Sparkles, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { MasterProfile } from '@/lib/store';

const LANGUAGES = [
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'Inglês' },
  { code: 'es', label: 'Espanhol' },
  { code: 'fr', label: 'Francês' },
  { code: 'de', label: 'Alemão' },
  { code: 'it', label: 'Italiano' },
  { code: 'ja', label: 'Japonês' },
  { code: 'ko', label: 'Coreano' },
  { code: 'zh', label: 'Chinês' },
  { code: 'ar', label: 'Árabe' },
  { code: 'ru', label: 'Russo' },
  { code: 'hi', label: 'Hindi' },
];

function detectPlatform(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
  if (url.includes('tiktok.com')) return 'TikTok';
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('kwai.com') || url.includes('kwatch')) return 'Kwai';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'Facebook';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'X/Twitter';
  if (url.includes('vimeo.com')) return 'Vimeo';
  return 'Outro';
}

const platformColors: Record<string, string> = {
  YouTube: 'bg-red-500/20 text-red-400',
  TikTok: 'bg-cyan-500/20 text-cyan-400',
  Instagram: 'bg-pink-500/20 text-pink-400',
  Kwai: 'bg-orange-500/20 text-orange-400',
  Facebook: 'bg-blue-500/20 text-blue-400',
  'X/Twitter': 'bg-sky-500/20 text-sky-400',
  Vimeo: 'bg-teal-500/20 text-teal-400',
  Outro: 'bg-muted text-muted-foreground',
  Manual: 'bg-muted text-muted-foreground',
  Upload: 'bg-emerald-500/20 text-emerald-400',
};

interface DBTranscription {
  id: string;
  video_url: string | null;
  platform: string | null;
  source_language: string | null;
  target_language: string | null;
  transcript_original: string | null;
  transcript_translated: string | null;
  status: string;
  created_at: string;
}

interface TranscriptionViewProps {
  profile: MasterProfile;
  onUpdate: (updates: Partial<MasterProfile>) => void;
  onXP: (amount: number) => void;
}

type ProcessingStatus = 'idle' | 'processing' | 'completed' | 'failed';

export function TranscriptionView({ profile, onUpdate, onXP }: TranscriptionViewProps) {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [manualText, setManualText] = useState('');
  const [targetLang, setTargetLang] = useState('pt');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [detectedLang, setDetectedLang] = useState('');
  const [currentPlatform, setCurrentPlatform] = useState('');
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [processingMessage, setProcessingMessage] = useState('');

  const [history, setHistory] = useState<DBTranscription[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [inputMode, setInputMode] = useState<'url' | 'text' | 'file'>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const xpAwardedRef = useRef<Set<string>>(new Set());

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback((recordId: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('transcriptions')
          .select('*')
          .eq('id', recordId)
          .single();

        if (error || !data) return;

        if (data.status === 'completed') {
          stopPolling();
          setOriginalText(data.transcript_original || '');
          setTranslatedText(data.transcript_translated || '');
          setDetectedLang(data.source_language || 'Auto');
          setProcessingStatus('completed');
          setProcessingMessage('Transcrição real concluída com sucesso.');
          setIsTranscribing(false);

          if (!xpAwardedRef.current.has(recordId)) {
            xpAwardedRef.current.add(recordId);
            toast.success('Transcrição real extraída com sucesso!');
            onXP(5);
          }
          loadHistory();
        } else if (data.status === 'failed') {
          stopPolling();
          setProcessingStatus('failed');
          setProcessingMessage('Não foi possível processar. Tente a opção "Enviar Arquivo" para transcrição garantida.');
          setDetectedLang(data.source_language || 'Auto');
          setIsTranscribing(false);
          if (!xpAwardedRef.current.has(recordId)) {
            xpAwardedRef.current.add(recordId);
            toast.error('Não foi possível processar. Tente enviar o arquivo de áudio diretamente.');
          }
          loadHistory();
        }
        // else still "processing", keep polling
      } catch {
        // Network hiccup, keep polling
      }
    }, 3000);
  }, [stopPolling, onXP]);

  // On mount: check for any "processing" transcriptions and resume polling
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const record = data[0] as DBTranscription;
        setCurrentRecordId(record.id);
        setUrl(record.video_url || '');
        setCurrentPlatform(record.platform || 'Outro');
        setProcessingStatus('processing');
        setProcessingMessage('Processando áudio real do link...');
        setIsTranscribing(true);
        startPolling(record.id);
      }
    })();
    return () => stopPolling();
  }, [user, startPolling, stopPolling]);

  // Load history from DB
  const loadHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistory((data as DBTranscription[]) || []);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [user]);

  const filteredHistory = useMemo(() => {
    if (!historySearch) return history;
    const q = historySearch.toLowerCase();
    return history.filter(h =>
      (h.video_url || '').toLowerCase().includes(q) ||
      (h.platform || '').toLowerCase().includes(q) ||
      (h.source_language || '').toLowerCase().includes(q) ||
      (h.target_language || '').toLowerCase().includes(q) ||
      (h.transcript_original || '').toLowerCase().includes(q)
    );
  }, [history, historySearch]);

  const handleTranscribe = async () => {
    if (inputMode === 'url' && !url.trim()) {
      toast.error('Cole o link do vídeo');
      return;
    }
    if (inputMode === 'text' && !manualText.trim()) {
      toast.error('Cole ou digite o texto para traduzir');
      return;
    }
    if (inputMode === 'file' && !selectedFile) {
      toast.error('Selecione um arquivo de áudio ou vídeo');
      return;
    }

    setIsTranscribing(true);

    if (inputMode === 'url' || inputMode === 'file') {
      setOriginalText('');
      setTranslatedText('');
      setDetectedLang('');
      setCurrentRecordId(null);
      setProcessingStatus('processing');
      setProcessingMessage(inputMode === 'file' ? 'Enviando arquivo e transcrevendo...' : 'Processando áudio real do link...');
    }

    try {
      if (inputMode === 'file' && selectedFile) {
        // Refresh session to ensure valid token for RLS
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const currentUser = sessionData?.session?.user;
        if (sessionError || !currentUser?.id) {
          throw new Error('Sessão expirada. Faça login novamente para enviar arquivo.');
        }

        setCurrentPlatform('Upload');
        const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');

        // Storage RLS exige que a 1ª pasta seja o auth.uid()
        const filePath = `${currentUser.id}/transcription-uploads/${profile.id}/${Date.now()}-${safeFileName}`;
        console.log('[Transcribe] Uploading to path:', filePath, 'user:', currentUser.id);
        const { error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(filePath, selectedFile);

        if (uploadError) {
          throw new Error('Erro ao enviar arquivo: ' + uploadError.message);
        }

        // Invoke edge function with file path (returns queued record id immediately)
        const { data, error } = await supabase.functions.invoke('transcribe', {
          body: {
            videoUrl: '',
            platform: 'Upload',
            sourceLanguage: null,
            targetLanguage: null,
            masterProfileId: profile.id,
            fileStoragePath: filePath,
          },
        });

        if (error) throw new Error(error.message || 'Erro ao iniciar transcrição');

        const recordId = data?.id as string | undefined;
        if (!recordId) throw new Error('Não foi possível iniciar a transcrição em segundo plano.');

        setCurrentRecordId(recordId);
        setProcessingMessage('Transcrição iniciada. Processando áudio em segundo plano...');
        startPolling(recordId);
      } else if (inputMode === 'url') {
        const platform = detectPlatform(url);
        setCurrentPlatform(platform);

        const { data, error } = await supabase.functions.invoke('transcribe', {
          body: {
            videoUrl: url,
            platform,
            sourceLanguage: null,
            targetLanguage: null,
            masterProfileId: profile.id,
          },
        });

        if (error) throw new Error(error.message || 'Erro ao iniciar transcrição');

        const recordId = data?.id as string | undefined;
        if (!recordId) throw new Error('Não foi possível iniciar a transcrição em segundo plano.');

        setCurrentRecordId(recordId);
        setProcessingMessage('Transcrição iniciada. Processando áudio em segundo plano...');
        startPolling(recordId);
      } else {
        setOriginalText(manualText);
        setCurrentPlatform('Manual');
        setDetectedLang('Auto-detectado');
        setCurrentRecordId(null);
        setProcessingStatus('idle');
        setProcessingMessage('');
        toast.success('Texto processado!');
        onXP(2);
        setIsTranscribing(false);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'Não foi possível processar';
      toast.error(msg);
      if (inputMode === 'url' || inputMode === 'file') {
        setOriginalText('');
        setTranslatedText('');
        setProcessingStatus('failed');
        setProcessingMessage(msg);
      }
      setIsTranscribing(false);
    }
  };

  const handleTranslate = async () => {
    if (!originalText) {
      toast.error('Gere a transcrição primeiro');
      return;
    }

    setIsTranslating(true);
    try {
      const targetLabel = LANGUAGES.find(l => l.code === targetLang)?.label || targetLang;
      // Only send sourceLanguage if it's a real language, not a placeholder
      const validSource = detectedLang && detectedLang !== 'Auto-detectado' && detectedLang !== 'Auto' ? detectedLang : undefined;

      const { data, error } = await supabase.functions.invoke('translate', {
        body: {
          text: originalText,
          targetLanguage: targetLabel,
          sourceLanguage: validSource,
        },
      });

      if (error) throw new Error(error.message);
      const translated = data.translatedText || '';
      setTranslatedText(translated);

      // Update DB record if exists
      if (currentRecordId) {
        await supabase
          .from('transcriptions')
          .update({
            transcript_translated: translated,
            target_language: targetLabel,
          })
          .eq('id', currentRecordId);
        await loadHistory();
      }

      toast.success('Tradução concluída!');
      onXP(2);
    } catch (err) {
      console.error(err);
      toast.error('Erro na tradução. Tente novamente.');
    } finally {
      setIsTranslating(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const saveAsInspiration = () => {
    if (!originalText) return;
    const newRef = {
      id: Date.now().toString(),
      type: 'idea' as const,
      url: url || '',
      title: `Transcrição: ${url ? url.slice(0, 40) : 'Manual'}`,
      niche: 'Transcrição',
      description: originalText.slice(0, 200),
      createdAt: new Date().toISOString(),
    };
    onUpdate({ references: [...(profile.references || []), newRef] });
    onXP(2);
    toast.success('Salvo como inspiração! +2 XP');
  };

  const saveAsContent = () => {
    if (!originalText) return;
    const newContent = {
      id: Date.now().toString(),
      title: `Transcrição: ${url ? url.slice(0, 30) : 'Manual'}`,
      category: 'crescimento' as const,
      objective: 'Transcrição de vídeo',
      videoLink: url,
      imageUrl: '',
      description: originalText.slice(0, 500),
      hashtags: '',
      cta: '',
      observations: translatedText ? `Tradução: ${translatedText.slice(0, 300)}` : '',
      status: 'idea' as const,
      priority: 'medium' as const,
      accountId: (profile.accounts || [])[0]?.id || '',
      favorite: false,
      createdAt: new Date().toISOString(),
    };
    onUpdate({ contents: [...(profile.contents || []), newContent] });
    onXP(2);
    toast.success('Salvo como conteúdo! +2 XP');
  };

  const exportText = () => {
    const content = `=== TRANSCRIÇÃO ===\n\n${originalText}\n\n=== TRADUÇÃO (${LANGUAGES.find(l => l.code === targetLang)?.label}) ===\n\n${translatedText || 'Não traduzido'}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transcricao-${Date.now()}.txt`;
    link.click();
    toast.success('Arquivo exportado!');
  };

  const deleteHistoryEntry = async (id: string) => {
    const { error } = await supabase.from('transcriptions').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover');
      return;
    }
    setHistory(prev => prev.filter(h => h.id !== id));
    toast.success('Transcrição removida');
  };

  const clearHistory = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('transcriptions')
      .delete()
      .eq('user_id', user.id);
    if (error) {
      toast.error('Erro ao limpar histórico');
      return;
    }
    setHistory([]);
    toast.success('Histórico limpo');
  };

  const openHistoryEntry = (entry: DBTranscription) => {
    setOriginalText(entry.transcript_original || '');
    setTranslatedText(entry.transcript_translated || '');
    setDetectedLang(entry.source_language || 'Auto');
    setCurrentPlatform(entry.platform || 'Outro');
    setUrl(entry.video_url || '');
    setCurrentRecordId(entry.id);
    setProcessingStatus(entry.status === 'completed' ? 'completed' : 'failed');
    setProcessingMessage(
      entry.status === 'completed'
        ? 'Transcrição real carregada do histórico.'
        : 'Transcrição indisponível para este vídeo.'
    );
    setShowHistory(false);
    toast.success('Transcrição carregada');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight">
            <span className="text-gradient-red">Transcrição</span>
            <span className="text-foreground"> de Vídeos</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Cole o link do YouTube, TikTok ou Instagram para obter transcrição real quando houver legenda pública disponível</p>
        </div>
        <Button
          variant="outline"
          onClick={() => { setShowHistory(true); loadHistory(); }}
          className="border-border/60 shrink-0"
        >
          <Clock className="w-4 h-4 mr-2" />
          Histórico ({history.length})
        </Button>
      </div>

      {/* Input Mode Toggle */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={inputMode === 'url' ? 'default' : 'outline'}
          onClick={() => setInputMode('url')}
          className={inputMode === 'url' ? 'gradient-red text-primary-foreground border-0 text-xs' : 'border-border/60 text-xs'}
        >
          <ExternalLink className="w-3.5 h-3.5 mr-1" />
          Link do Vídeo
        </Button>
        <Button
          size="sm"
          variant={inputMode === 'file' ? 'default' : 'outline'}
          onClick={() => setInputMode('file')}
          className={inputMode === 'file' ? 'gradient-red text-primary-foreground border-0 text-xs' : 'border-border/60 text-xs'}
        >
          <Upload className="w-3.5 h-3.5 mr-1" />
          Enviar Arquivo
        </Button>
        <Button
          size="sm"
          variant={inputMode === 'text' ? 'default' : 'outline'}
          onClick={() => setInputMode('text')}
          className={inputMode === 'text' ? 'gradient-red text-primary-foreground border-0 text-xs' : 'border-border/60 text-xs'}
        >
          <FileText className="w-3.5 h-3.5 mr-1" />
          Texto Manual
        </Button>
      </div>

      {/* Input Area */}
      <div className="bg-card border border-border/60 rounded-xl p-5 space-y-4">
        {inputMode === 'url' ? (
          <div>
            <label className="text-xs font-semibold text-foreground/70 mb-2 block">Link do Vídeo</label>
            <Input
              placeholder="Cole o link do vídeo (YouTube, TikTok, Instagram, Kwai...)"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="bg-secondary border-border"
            />
            {url && (
              <div className="flex items-center gap-2 mt-2">
                <Badge className={platformColors[detectPlatform(url)] || platformColors.Outro}>
                  {detectPlatform(url)}
                </Badge>
              </div>
            )}
          </div>
        ) : inputMode === 'file' ? (
          <div>
            <label className="text-xs font-semibold text-foreground/70 mb-2 block">Arquivo de Áudio/Vídeo</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*,.mp3,.mp4,.m4a,.wav,.ogg,.webm,.aac,.flac"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0] || null;
                if (file && file.size > 20 * 1024 * 1024) {
                  toast.error('Arquivo muito grande. Máximo 20MB.');
                  return;
                }
                setSelectedFile(file);
              }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="bg-secondary border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <Upload className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">({(selectedFile.size / (1024 * 1024)).toFixed(1)}MB)</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={e => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Clique para selecionar um arquivo de áudio ou vídeo</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">MP3, MP4, M4A, WAV, OGG, WebM, AAC, FLAC (máx 20MB)</p>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground/80 mt-2">
              💡 Dica: Se o link do YouTube não funcionar, baixe o áudio do vídeo e envie aqui para transcrição garantida.
            </p>
          </div>
        ) : (
          <div>
            <label className="text-xs font-semibold text-foreground/70 mb-2 block">Texto para Traduzir</label>
            <Textarea
              placeholder="Cole ou digite o texto que deseja traduzir..."
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              className="bg-secondary border-border min-h-[120px]"
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger className="bg-secondary border-border sm:w-48">
              <Globe className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(l => (
                <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleTranscribe}
            disabled={isTranscribing}
            className="gradient-red text-primary-foreground border-0 flex-1 sm:flex-none"
          >
            {isTranscribing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando...</>
            ) : (
              <><Play className="w-4 h-4 mr-2" />{inputMode === 'url' ? 'Gerar Transcrição' : inputMode === 'file' ? 'Transcrever Arquivo' : 'Processar Texto'}</>
            )}
          </Button>
        </div>

        {(inputMode === 'url' || inputMode === 'file') && processingStatus !== 'idle' && (
          <div className="flex items-center gap-2 text-xs">
            <Badge
              variant="outline"
              className={
                processingStatus === 'completed'
                  ? 'border-primary/30 text-primary'
                  : processingStatus === 'failed'
                    ? 'border-destructive/30 text-destructive'
                    : 'border-border text-muted-foreground'
              }
            >
              {processingStatus === 'processing'
                ? '⏳ Processando'
                : processingStatus === 'completed'
                  ? '✓ Concluído'
                  : '✗ Falhou'}
            </Badge>
            {processingMessage && (
              <span className="text-muted-foreground">{processingMessage}</span>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {originalText && (
        <div className="space-y-4">
          {detectedLang && (
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Idioma detectado:</span>
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">{detectedLang}</Badge>
              {currentPlatform && (
                <Badge className={platformColors[currentPlatform] || platformColors.Outro}>
                  {currentPlatform}
                </Badge>
              )}
            </div>
          )}

          <div className="bg-card border border-border/60 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Texto Original
              </h3>
              <Button size="sm" variant="ghost" onClick={() => copyText(originalText, 'Texto original')} className="text-xs text-muted-foreground hover:text-foreground">
                <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
              </Button>
            </div>
            <p className="text-sm text-foreground/85 whitespace-pre-line leading-relaxed max-h-64 overflow-y-auto">{originalText}</p>
          </div>

          {!translatedText && (
            <Button
              onClick={handleTranslate}
              disabled={isTranslating}
              className="w-full gradient-red text-primary-foreground border-0"
            >
              {isTranslating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Traduzindo...</>
              ) : (
                <><Languages className="w-4 h-4 mr-2" />Traduzir para {LANGUAGES.find(l => l.code === targetLang)?.label}</>
              )}
            </Button>
          )}

          {translatedText && (
            <div className="bg-card border border-primary/20 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Languages className="w-4 h-4 text-primary" />
                  Tradução ({LANGUAGES.find(l => l.code === targetLang)?.label})
                </h3>
                <Button size="sm" variant="ghost" onClick={() => copyText(translatedText, 'Tradução')} className="text-xs text-muted-foreground hover:text-foreground">
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                </Button>
              </div>
              <p className="text-sm text-foreground/85 whitespace-pre-line leading-relaxed max-h-64 overflow-y-auto">{translatedText}</p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-card border border-border/60 rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Ações Rápidas
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button size="sm" variant="outline" onClick={saveAsInspiration} className="border-border/60 text-xs">
                <Bookmark className="w-3.5 h-3.5 mr-1" /> Salvar Inspiração
              </Button>
              <Button size="sm" variant="outline" onClick={saveAsContent} className="border-border/60 text-xs">
                <FileText className="w-3.5 h-3.5 mr-1" /> Salvar Conteúdo
              </Button>
              <Button size="sm" variant="outline" onClick={exportText} className="border-border/60 text-xs">
                <Download className="w-3.5 h-3.5 mr-1" /> Exportar Texto
              </Button>
              {translatedText && (
                <Button
                  size="sm" variant="outline"
                  onClick={() => { setTranslatedText(''); toast.info('Selecione outro idioma e traduza novamente'); }}
                  className="border-border/60 text-xs"
                >
                  <Languages className="w-3.5 h-3.5 mr-1" /> Outra Tradução
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Histórico de Transcrições
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por vídeo, plataforma, idioma..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="pl-9 bg-secondary border-border"
              />
            </div>

            {history.length > 0 && (
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={clearHistory} className="text-xs text-destructive hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpar Histórico
                </Button>
              </div>
            )}

            {loadingHistory ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Carregando...</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma transcrição encontrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map(entry => (
                  <div
                    key={entry.id}
                    className="bg-secondary/50 border border-border/40 rounded-lg p-3 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {entry.video_url ? entry.video_url.slice(0, 60) : 'Texto manual'}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge className={`text-[10px] ${platformColors[entry.platform || 'Outro'] || platformColors.Outro}`}>
                            {entry.platform || 'Outro'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {entry.source_language || 'Auto'} → {entry.target_language || 'N/A'}
                          </span>
                          <Badge variant="outline" className={`text-[10px] ${
                            entry.status === 'completed' ? 'border-green-500/30 text-green-400' :
                            entry.status === 'failed' ? 'border-destructive/30 text-destructive' :
                            'border-yellow-500/30 text-yellow-400'
                          }`}>
                            {entry.status === 'completed' ? '✓ Concluído' : entry.status === 'failed' ? '✗ Falhou' : '⏳ Processando'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(entry.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {entry.status === 'completed' && (
                          <Button size="sm" variant="ghost" onClick={() => openHistoryEntry(entry)} className="h-7 w-7 p-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => deleteHistoryEntry(entry.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
