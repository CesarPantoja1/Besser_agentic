import React, { useState } from 'react';
import { Sparkles, FileText } from 'lucide-react';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownRenderer } from './MarkdownRenderer';

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

  // Editing mode — WYSIWYG inline editor (Notion-style)
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

  // Read-only rendered view — click to enter editing mode
  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="size-4.5 text-brand" />
          <h2 className="text-base font-bold text-foreground">Especificación del Producto</h2>
        </div>
      </div>

      {/* Clickable content area — click anywhere to start editing */}
      <div
        className="flex-1 overflow-y-auto cursor-text group"
        onClick={() => setIsEditing(true)}
        title="Haz clic para editar"
      >
        <div className="max-w-4xl mx-auto px-8 py-6 relative">
          {/* Subtle hover hint */}
          <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-brand/10 transition-colors pointer-events-none" />
          <MarkdownRenderer content={productMarkdown || ''} />
        </div>
      </div>
    </div>
  );
};
export default SDDProductView;
