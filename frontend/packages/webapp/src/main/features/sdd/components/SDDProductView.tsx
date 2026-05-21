import React, { useState, useEffect } from 'react';
import { Sparkles, Edit2, FileText } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MarkdownEditor } from './MarkdownEditor';

interface SDDProductViewProps {
  productCreated: boolean;
  productMarkdown: string | null;
  onGenerate: (prompt: string) => void;
  onModify: (prompt: string) => void;
  onManualEdit: (content: string) => void;
  wsPhase: string;
}

export const SDDProductView: React.FC<SDDProductViewProps> = ({
  productCreated,
  productMarkdown,
  onGenerate,
  onModify,
  onManualEdit,
  wsPhase,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || wsPhase !== 'idle') return;
    onGenerate(prompt);
  };

  const handleSaveEdit = (content: string) => {
    if (!content.trim()) return;
    onManualEdit(content);
    setIsEditing(false);
  };

  // CTA State (Not created yet)
  if (!productCreated) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto px-4 py-16 animate-fade-in">
        <div className="size-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mb-6 shadow-sm">
          <FileText className="size-8 text-brand" />
        </div>
        
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">Comienza tu Especificación</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">
          Describe tu idea, el problema que resuelve y quiénes serán los usuarios. El asistente inteligente generará un Product Brief formal con alcance, objetivos y limitaciones.
        </p>

        <form onSubmit={handleCreate} className="w-full space-y-4">
          <div className="relative group">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={wsPhase !== 'idle'}
              rows={4}
              placeholder="Ej: Quiero una aplicación móvil para clínicas dentales que permita agendar citas, ver historial médico, recibir recordatorios por WhatsApp y pagar en línea..."
              className="w-full p-4 rounded-xl border border-border/80 bg-card hover:border-brand/40 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all duration-200 resize-none text-sm leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={!prompt.trim() || wsPhase !== 'idle'}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold rounded-xl bg-brand text-brand-foreground hover:bg-brand/95 shadow-md shadow-brand/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="size-4" />
            Generar Product Brief
          </button>
        </form>
      </div>
    );
  }

  // Editing mode — use the full MarkdownEditor with live preview
  if (isEditing) {
    return (
      <div className="h-full">
        <MarkdownEditor
          initialContent={productMarkdown || ''}
          onSave={handleSaveEdit}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  // Active SPEC state (Created) — rendered markdown view
  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Especificación del Producto</h2>
        </div>

        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-brand/20 bg-brand/[0.03] text-brand hover:bg-brand/[0.08] transition-colors"
        >
          <Edit2 className="size-3.5" />
          Editar Manualmente
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        <MarkdownRenderer content={productMarkdown || ''} />
      </div>
    </div>
  );
};
export default SDDProductView;
