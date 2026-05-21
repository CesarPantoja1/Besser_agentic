import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, Eye, Code, Columns, Maximize2, Minimize2 } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MarkdownEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

type ViewMode = 'split' | 'edit' | 'preview';

/**
 * Split-pane markdown editor with live preview.
 * Left: syntax-aware textarea. Right: rendered preview.
 * Supports view mode toggling (split, edit-only, preview-only).
 */
export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  initialContent,
  onSave,
  onCancel,
}) => {
  const [content, setContent] = useState(initialContent);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Focus the textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Synchronize scroll positions between editor and preview
  const handleEditorScroll = useCallback(() => {
    if (textareaRef.current && previewRef.current && viewMode === 'split') {
      const editor = textareaRef.current;
      const preview = previewRef.current;
      const scrollRatio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
      preview.scrollTop = scrollRatio * (preview.scrollHeight - preview.clientHeight);
    }
  }, [viewMode]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onSave(content);
      return;
    }
    // Escape to cancel
    if (e.key === 'Escape') {
      onCancel();
      return;
    }
    // Tab inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      setContent(newContent);
      // Restore cursor position
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/20 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {/* View mode toggles */}
          <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/40">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                viewMode === 'edit'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Solo editor"
            >
              <Code className="size-3" />
              Editor
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                viewMode === 'split'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Editor + vista previa"
            >
              <Columns className="size-3" />
              Dividido
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                viewMode === 'preview'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Solo vista previa"
            >
              <Eye className="size-3" />
              Vista previa
            </button>
          </div>

          <span className="text-[10px] text-muted-foreground/60 ml-2 hidden md:inline">
            Ctrl+S para guardar · Esc para cancelar
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-border/60 hover:bg-accent/40 transition-colors"
          >
            <X className="size-3" />
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(content)}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
          >
            <Check className="size-3" />
            Guardar cambios
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Editor pane */}
        {viewMode !== 'preview' && (
          <div className={`flex flex-col overflow-hidden ${viewMode === 'split' ? 'w-1/2 border-r border-border/30' : 'w-full'}`}>
            <div className="px-3 py-1.5 bg-muted/10 border-b border-border/20 flex-shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Markdown</span>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onScroll={handleEditorScroll}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="flex-1 p-4 bg-card text-sm font-mono leading-relaxed resize-none outline-none border-none text-foreground/90 selection:bg-brand/20 overflow-auto"
              style={{ tabSize: 2 }}
            />
          </div>
        )}

        {/* Preview pane */}
        {viewMode !== 'edit' && (
          <div className={`flex flex-col overflow-hidden ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div className="px-3 py-1.5 bg-muted/10 border-b border-border/20 flex-shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Vista previa</span>
            </div>
            <div
              ref={previewRef}
              className="flex-1 overflow-auto p-6"
            >
              <MarkdownRenderer content={content} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownEditor;
