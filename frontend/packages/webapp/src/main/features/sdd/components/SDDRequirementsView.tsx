import React, { useState } from 'react';
import { Sparkles, Edit2, ClipboardList } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MarkdownEditor } from './MarkdownEditor';

interface SDDRequirementsViewProps {
  requirementsCreated: boolean;
  requirementsMarkdown: string | null;
  onGenerate: () => void;
  onManualEdit: (content: string) => void;
  wsPhase: string;
}

export const SDDRequirementsView: React.FC<SDDRequirementsViewProps> = ({
  requirementsCreated,
  requirementsMarkdown,
  onGenerate,
  onManualEdit,
  wsPhase,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleSaveEdit = (content: string) => {
    if (!content.trim()) return;
    onManualEdit(content);
    setIsEditing(false);
  };

  // CTA State (Not created yet)
  if (!requirementsCreated) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto px-4 py-16 animate-fade-in">
        <div className="size-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mb-6 shadow-sm">
          <ClipboardList className="size-8 text-brand" />
        </div>
        
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">Generar Requisitos de Software</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">
          El asistente analizará el Product Brief para derivar requisitos funcionales estructurados en sintaxis EARS (Easy Approach to Requirements Syntax) y requisitos no funcionales detallados.
        </p>

        <button
          onClick={onGenerate}
          disabled={wsPhase !== 'idle'}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold rounded-xl bg-brand text-brand-foreground hover:bg-brand/95 shadow-md shadow-brand/10 transition-all duration-200 disabled:opacity-50"
        >
          <Sparkles className="size-4" />
          Auto-Generar Requisitos EARS
        </button>
      </div>
    );
  }

  // Editing mode — use the full MarkdownEditor with live preview
  if (isEditing) {
    return (
      <div className="h-full">
        <MarkdownEditor
          initialContent={requirementsMarkdown || ''}
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
          <ClipboardList className="size-5 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Especificación de Requisitos EARS</h2>
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
        <MarkdownRenderer content={requirementsMarkdown || ''} />
      </div>
    </div>
  );
};
export default SDDRequirementsView;
