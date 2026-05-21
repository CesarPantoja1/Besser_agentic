import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, Sparkles, AlertCircle, Play } from 'lucide-react';

interface SDDChatProps {
  activePhase: 'product' | 'requirements' | 'design';
  wsPhase: 'idle' | 'processing' | 'awaiting_quality' | 'awaiting_impact';
  statusMessage: string | null;
  history: string[];
  onSendMessage: (prompt: string) => void;
}

export const SDDChat: React.FC<SDDChatProps> = ({
  activePhase,
  wsPhase,
  statusMessage,
  history,
  onSendMessage,
}) => {
  const [input, setInput] = useState('');
  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom of activity logs when history updates
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, statusMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || wsPhase !== 'idle') return;
    onSendMessage(input);
    setInput('');
  };

  // Quick suggestions based on the active phase
  const getSuggestions = () => {
    switch (activePhase) {
      case 'product':
        return [
          'Añadir soporte para cobros con Stripe',
          'Soportar notificaciones push y por email',
          'Excluir el módulo de analítica avanzada',
        ];
      case 'requirements':
        return [
          'Agregar requisitos de seguridad OWASP',
          'Hacer que el login requiera 2FA obligatorio',
          'Añadir rendimiento: < 1s tiempo de respuesta',
        ];
      case 'design':
        return [
          'Añadir patrón Repository en la persistencia',
          'Crear una interfaz para notificaciones',
          'Hacer la clase de Pago abstracta',
        ];
      default:
        return [];
    }
  };

  const phaseLabels = {
    product: 'Product Brief',
    requirements: 'Requisitos',
    design: 'Diseño UML',
  };

  return (
    <div className="flex flex-col h-full bg-card border border-border/40 rounded-xl overflow-hidden shadow-sm">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-border/40 bg-muted/20 flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Terminal className="size-3.5 text-brand" />
          Iteración de Arquitectura ({phaseLabels[activePhase]})
        </span>
        <span className="flex h-2 w-2 relative">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${wsPhase !== 'idle' ? 'bg-brand' : 'bg-emerald-500'}`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${wsPhase !== 'idle' ? 'bg-brand' : 'bg-emerald-500'}`}></span>
        </span>
      </div>

      {/* Activity Log / Messages view */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin select-text">
        {history.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <Sparkles className="size-6 text-brand/40 mb-2 animate-pulse" />
            <p className="text-xs leading-relaxed">
              Describe los cambios que deseas en el panel de entrada de abajo para modificar interactivamente la especificación actual.
            </p>
          </div>
        ) : (
          history.map((log, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border text-xs leading-relaxed shadow-sm transition-all ${
                log.includes('❌')
                  ? 'bg-red-500/[0.02] border-red-500/10 text-red-600 dark:text-red-400'
                  : log.includes('⚠️')
                  ? 'bg-amber-500/[0.02] border-amber-500/10 text-amber-600 dark:text-amber-400'
                  : log.includes('✅')
                  ? 'bg-emerald-500/[0.02] border-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-muted/30 border-border/40 text-foreground/80'
              }`}
            >
              {log}
            </div>
          ))
        )}

        {/* Live processing status banner */}
        {wsPhase !== 'idle' && statusMessage && (
          <div className="p-3 rounded-lg border border-brand/10 bg-brand/[0.02] text-xs leading-relaxed text-brand flex items-center gap-2 animate-pulse">
            <AlertCircle className="size-3.5 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        <div ref={historyEndRef} />
      </div>

      {/* Suggested actions chips */}
      {wsPhase === 'idle' && (
        <div className="px-4 py-2 border-t border-border/20 bg-muted/[0.08] flex-shrink-0">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Sparkles className="size-3 text-brand" />
            Sugerencias de Iteración
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {getSuggestions().map((sug, idx) => (
              <button
                key={idx}
                onClick={() => setInput(sug)}
                className="text-[10px] py-1 px-2 rounded-md bg-muted/60 border border-border/30 hover:border-brand/40 text-foreground/80 hover:text-foreground text-left transition-all leading-tight truncate max-w-full"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Input form */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border/40 bg-muted/10 flex-shrink-0 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={wsPhase !== 'idle'}
          placeholder={
            wsPhase !== 'idle'
              ? 'Esperando respuesta del servidor...'
              : `Modificar ${phaseLabels[activePhase]}...`
          }
          className="flex-1 px-3 py-2 text-xs rounded-lg border border-border/80 bg-card focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all placeholder:text-muted-foreground/60 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || wsPhase !== 'idle'}
          className="size-8 rounded-lg bg-brand text-brand-foreground hover:bg-brand/95 flex items-center justify-center transition-all disabled:opacity-50 active:scale-[0.96]"
        >
          <Send className="size-3.5" />
        </button>
      </form>
    </div>
  );
};
export default SDDChat;
