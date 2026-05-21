import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  Undo2, Redo2, Bold, Italic, Strikethrough, Code,
  Heading1, Heading2, Heading3, List, ListOrdered,
  Quote, Minus, Link2, Table,
} from 'lucide-react';

interface MarkdownEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

/* ────────────────────────────────────────────────────
 *  Minimal Markdown ↔ HTML converters
 * ──────────────────────────────────────────────────── */

function markdownToHtml(md: string): string {
  let html = md;

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings (must come before bold so ## isn't caught by **)
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr/>');

  // Blockquote (simple, one level)
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '<br>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Unordered lists
  html = html.replace(/(?:^[-*]\s+.+\n?)+/gm, (match) => {
    const items = match.trim().split('\n').map(li => `<li>${li.replace(/^[-*]\s+/, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/(?:^\d+\.\s+.+\n?)+/gm, (match) => {
    const items = match.trim().split('\n').map(li => `<li>${li.replace(/^\d+\.\s+/, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // Tables
  html = html.replace(/(?:^\|.+\|$\n?)+/gm, (match) => {
    const rows = match.trim().split('\n').filter(r => !r.match(/^\|[\s-:|]+\|$/));
    if (rows.length === 0) return match;
    const headerCells = rows[0].split('|').filter(c => c.trim() !== '').map(c => `<th>${c.trim()}</th>`).join('');
    const bodyRows = rows.slice(1).map(row => {
      const cells = row.split('|').filter(c => c.trim() !== '').map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  });

  // Paragraphs: wrap remaining plain-text lines
  html = html.split('\n\n').map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    // Don't wrap blocks that are already wrapped in block-level tags
    if (/^<(h[1-6]|ul|ol|pre|blockquote|hr|table|div)[\s>]/i.test(trimmed)) return trimmed;
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return html;
}

function htmlToMarkdown(el: HTMLElement): string {
  let md = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      md += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as HTMLElement).tagName.toLowerCase();
      const inner = htmlToMarkdown(node as HTMLElement);
      switch (tag) {
        case 'h1': md += `# ${inner}\n\n`; break;
        case 'h2': md += `## ${inner}\n\n`; break;
        case 'h3': md += `### ${inner}\n\n`; break;
        case 'h4': md += `#### ${inner}\n\n`; break;
        case 'p': md += `${inner}\n\n`; break;
        case 'strong': case 'b': md += `**${inner}**`; break;
        case 'em': case 'i': md += `*${inner}*`; break;
        case 'del': case 's': md += `~~${inner}~~`; break;
        case 'code': {
          const parent = (node as HTMLElement).parentElement;
          if (parent && parent.tagName.toLowerCase() === 'pre') {
            md += inner; // handled by pre
          } else {
            md += `\`${inner}\``;
          }
          break;
        }
        case 'pre': md += `\`\`\`\n${inner}\n\`\`\`\n\n`; break;
        case 'blockquote': md += inner.split('\n').filter(l => l.trim()).map(l => `> ${l}`).join('\n') + '\n\n'; break;
        case 'ul': {
          const items = Array.from((node as HTMLElement).children);
          md += items.map(li => `- ${htmlToMarkdown(li as HTMLElement).trim()}`).join('\n') + '\n\n';
          break;
        }
        case 'ol': {
          const items = Array.from((node as HTMLElement).children);
          md += items.map((li, i) => `${i + 1}. ${htmlToMarkdown(li as HTMLElement).trim()}`).join('\n') + '\n\n';
          break;
        }
        case 'li': md += inner; break;
        case 'a': {
          const href = (node as HTMLAnchorElement).getAttribute('href') || '';
          md += `[${inner}](${href})`;
          break;
        }
        case 'hr': md += '---\n\n'; break;
        case 'br': md += '\n'; break;
        case 'table': {
          const thead = (node as HTMLElement).querySelector('thead');
          const tbody = (node as HTMLElement).querySelector('tbody');
          if (thead) {
            const ths = Array.from(thead.querySelectorAll('th'));
            md += '| ' + ths.map(th => th.textContent?.trim() || '').join(' | ') + ' |\n';
            md += '| ' + ths.map(() => '---').join(' | ') + ' |\n';
          }
          if (tbody) {
            const rows = Array.from(tbody.querySelectorAll('tr'));
            rows.forEach(row => {
              const tds = Array.from(row.querySelectorAll('td'));
              md += '| ' + tds.map(td => td.textContent?.trim() || '').join(' | ') + ' |\n';
            });
          }
          md += '\n';
          break;
        }
        case 'div': md += inner; break;
        default: md += inner; break;
      }
    }
  }
  return md;
}

/* ────────────────────────────────────────────────────
 *  Toolbar button descriptor
 * ──────────────────────────────────────────────────── */

interface ToolbarAction {
  icon: React.ReactNode;
  label: string;
  command: string;
  value?: string;
}

const DIVIDER = 'DIVIDER';

type ToolbarItem = ToolbarAction | typeof DIVIDER;

/* ────────────────────────────────────────────────────
 *  WYSIWYG Markdown Editor (Notion-style)
 * ──────────────────────────────────────────────────── */

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  initialContent,
  onSave,
  onCancel,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const savedContentRef = useRef(initialContent);

  // Initialize the contentEditable with rendered HTML from the markdown source
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = markdownToHtml(initialContent);
    }
  }, []); // Only on mount

  // Toolbar actions
  const toolbarItems: ToolbarItem[] = [
    { icon: <Undo2 className="size-3.5" />, label: 'Deshacer', command: 'undo' },
    { icon: <Redo2 className="size-3.5" />, label: 'Rehacer', command: 'redo' },
    DIVIDER,
    { icon: <Bold className="size-3.5" />, label: 'Negrita', command: 'bold' },
    { icon: <Italic className="size-3.5" />, label: 'Cursiva', command: 'italic' },
    { icon: <Strikethrough className="size-3.5" />, label: 'Tachado', command: 'strikeThrough' },
    { icon: <Code className="size-3.5" />, label: 'Código', command: 'insertHTML', value: '<code>código</code>' },
    DIVIDER,
    { icon: <Heading1 className="size-3.5" />, label: 'Encabezado 1', command: 'formatBlock', value: 'h1' },
    { icon: <Heading2 className="size-3.5" />, label: 'Encabezado 2', command: 'formatBlock', value: 'h2' },
    { icon: <Heading3 className="size-3.5" />, label: 'Encabezado 3', command: 'formatBlock', value: 'h3' },
    DIVIDER,
    { icon: <List className="size-3.5" />, label: 'Lista', command: 'insertUnorderedList' },
    { icon: <ListOrdered className="size-3.5" />, label: 'Lista numerada', command: 'insertOrderedList' },
    { icon: <Quote className="size-3.5" />, label: 'Cita', command: 'formatBlock', value: 'blockquote' },
    DIVIDER,
    { icon: <Minus className="size-3.5" />, label: 'Línea horizontal', command: 'insertHorizontalRule' },
    { icon: <Table className="size-3.5" />, label: 'Tabla', command: 'insertHTML', value: '<table><thead><tr><th>Columna 1</th><th>Columna 2</th></tr></thead><tbody><tr><td>dato</td><td>dato</td></tr></tbody></table>' },
    { icon: <Link2 className="size-3.5" />, label: 'Enlace', command: 'createLink' },
  ];

  const executeCommand = useCallback((command: string, value?: string) => {
    // Focus editor first to ensure commands work
    editorRef.current?.focus();

    if (command === 'createLink') {
      const url = prompt('URL del enlace:');
      if (url) {
        document.execCommand('createLink', false, url);
      }
      return;
    }

    if (command === 'formatBlock' && value) {
      document.execCommand('formatBlock', false, `<${value}>`);
      return;
    }

    document.execCommand(command, false, value || undefined);
    setIsDirty(true);
  }, []);

  // Convert editor content back to markdown and save
  const handleSave = useCallback(() => {
    if (editorRef.current) {
      const md = htmlToMarkdown(editorRef.current).replace(/\n{3,}/g, '\n\n').trim();
      savedContentRef.current = md;
      onSave(md);
      setIsDirty(false);
    }
  }, [onSave]);

  // Keyboard shortcuts inside the editor
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  }, [handleSave, onCancel]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Formatting Toolbar ── */}
      <div className="flex items-center gap-0.5 px-4 py-2 border-b border-border/40 bg-muted/15 flex-shrink-0 overflow-x-auto">
        {toolbarItems.map((item, idx) => {
          if (item === DIVIDER) {
            return <div key={`d-${idx}`} className="w-px h-5 bg-border/40 mx-1.5 flex-shrink-0" />;
          }
          const action = item as ToolbarAction;
          return (
            <button
              key={idx}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent stealing focus from contentEditable
                executeCommand(action.command, action.value);
              }}
              title={action.label}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 active:bg-accent/80 transition-colors flex-shrink-0"
            >
              {action.icon}
            </button>
          );
        })}

        {/* Save/Cancel actions on the right */}
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground/50 mr-2 hidden lg:inline flex-shrink-0">
          Ctrl+S guardar
        </span>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onCancel(); }}
          className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-border/50 hover:bg-accent/40 text-muted-foreground transition-colors flex-shrink-0 mr-1.5"
        >
          Cancelar
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
          className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm flex-shrink-0"
        >
          Guardar
        </button>
      </div>

      {/* ── Editable Content Surface ── */}
      <div className="flex-1 overflow-y-auto">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => setIsDirty(true)}
          onKeyDown={handleKeyDown}
          className="sdd-wysiwyg-editor max-w-4xl mx-auto px-8 py-6 outline-none min-h-full text-sm leading-relaxed text-foreground/90 cursor-text"
          style={{ caretColor: 'var(--brand, #6366f1)' }}
        />
      </div>

      {/* Dirty indicator */}
      {isDirty && (
        <div className="px-4 py-1.5 border-t border-amber-500/20 bg-amber-500/[0.04] text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5 flex-shrink-0">
          <div className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
          Cambios sin guardar — Ctrl+S para guardar
        </div>
      )}
    </div>
  );
};

export default MarkdownEditor;
