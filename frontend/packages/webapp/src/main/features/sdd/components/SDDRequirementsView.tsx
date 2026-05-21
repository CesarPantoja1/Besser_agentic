import React, { useState } from 'react';
import { Sparkles, ClipboardList } from 'lucide-react';
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

  // Editing mode — WYSIWYG inline editor (Notion-style)
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

  // Read-only rendered view — click to enter editing mode
  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4.5 text-brand" />
          <h2 className="text-base font-bold text-foreground">Especificación de Requisitos EARS</h2>
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
          <MarkdownRenderer content={requirementsMarkdown || ''} />
        </div>
      </div>
    </div>
  );
};
export default SDDRequirementsView;
