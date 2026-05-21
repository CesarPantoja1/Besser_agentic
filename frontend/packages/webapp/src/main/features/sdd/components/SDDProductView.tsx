import React, { useState, useEffect } from 'react';
import { Sparkles, Edit2, Check, X, FileText } from 'lucide-react';

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
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (productMarkdown) {
      setEditContent(productMarkdown);
    }
  }, [productMarkdown]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || wsPhase !== 'idle') return;
    onGenerate(prompt);
  };

  const handleSaveEdit = () => {
    if (!editContent.trim()) return;
    onManualEdit(editContent);
    setIsEditing(false);
  };

  // CTA State (Not created yet)
  if (!productCreated) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto px-4 py-16 animate-fade-in">
        <div className="size-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mb-6 shadow-sm">
          <FileText className="size-8 text-brand animate-pulse" />
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

  // Active SPEC state (Created)
  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Especificación del Producto</h2>
        </div>

        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
              >
                <Check className="size-3.5" />
                Guardar cambios
              </button>
              <button
                onClick={() => {
                  setEditContent(productMarkdown || '');
                  setIsEditing(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border/60 hover:bg-accent/40 transition-colors"
              >
                <X className="size-3.5" />
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-brand/20 bg-brand/[0.03] text-brand hover:bg-brand/[0.08] transition-colors"
            >
              <Edit2 className="size-3.5" />
              Editar Manualmente
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-[500px] p-6 rounded-xl border border-border/80 bg-card font-mono text-sm leading-relaxed focus:border-brand focus:ring-1 focus:ring-brand outline-none resize-none transition-all duration-200"
          />
        ) : (
          <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-brand prose-pre:bg-muted/40 prose-pre:border prose-pre:border-border/40 select-text leading-relaxed">
            {/* Simple markdown parsing for rendering visual blocks */}
            {productMarkdown ? (
              <div className="space-y-6">
                {productMarkdown.split('\n\n').map((block, idx) => {
                  const trimmed = block.trim();
                  if (trimmed.startsWith('# ')) {
                    return <h1 key={idx} className="text-3xl font-extrabold border-b border-border/40 pb-2 mt-8 mb-4">{trimmed.replace('# ', '')}</h1>;
                  }
                  if (trimmed.startsWith('## ')) {
                    return <h2 key={idx} className="text-2xl font-bold border-b border-border/20 pb-1 mt-6 mb-3">{trimmed.replace('## ', '')}</h2>;
                  }
                  if (trimmed.startsWith('### ')) {
                    return <h3 key={idx} className="text-xl font-bold mt-4 mb-2">{trimmed.replace('### ', '')}</h3>;
                  }
                  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    return (
                      <ul key={idx} className="list-disc pl-5 space-y-1.5 my-3">
                        {trimmed.split('\n').map((li, lIdx) => (
                          <li key={lIdx} className="text-sm text-foreground/90">
                            {li.replace(/^[-*]\s+/, '')}
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  return <p key={idx} className="text-sm text-foreground/80 leading-relaxed my-3 whitespace-pre-wrap">{trimmed}</p>;
                })}
              </div>
            ) : (
              <p className="text-muted-foreground italic text-center">Cargando contenido...</p>
            )}
          </article>
        )}
      </div>
    </div>
  );
};
export default SDDProductView;
