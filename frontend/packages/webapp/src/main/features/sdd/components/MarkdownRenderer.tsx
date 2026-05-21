import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content with full GFM support (tables, strikethrough, task lists, etc.)
 * Uses proper heading hierarchy, styled lists, code blocks, and tables.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) {
    return <p className="text-muted-foreground italic text-center py-8">Cargando contenido...</p>;
  }

  return (
    <div className={`sdd-markdown-content ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground border-b border-border/40 pb-2.5 mt-8 mb-5 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-foreground border-b border-border/20 pb-1.5 mt-7 mb-4">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-bold text-foreground mt-5 mb-3">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold text-foreground mt-4 mb-2">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-sm text-foreground/85 leading-relaxed my-3 whitespace-pre-wrap">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 space-y-1.5 my-3 text-sm text-foreground/85">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 space-y-1.5 my-3 text-sm text-foreground/85">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-1">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/90">{children}</em>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-[3px] border-brand/50 pl-4 py-1 my-4 bg-brand/[0.03] rounded-r-lg text-sm text-foreground/80 italic">
              {children}
            </blockquote>
          ),
          code: ({ className: codeClassName, children }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded-md bg-muted/80 border border-border/40 text-[12px] font-mono text-brand font-medium">
                  {children}
                </code>
              );
            }
            return (
              <code className={`block p-4 rounded-xl bg-muted/50 border border-border/40 text-[12px] font-mono leading-relaxed overflow-x-auto my-4 ${codeClassName || ''}`}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="rounded-xl bg-muted/50 border border-border/40 overflow-x-auto my-4">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-5 rounded-xl border border-border/50">
              <table className="w-full text-sm border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/40 border-b border-border/60">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/30">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-muted/20 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2.5 text-left text-[11px] font-bold text-foreground uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 text-sm text-foreground/85">
              {children}
            </td>
          ),
          hr: () => (
            <hr className="border-border/30 my-6" />
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-medium">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};

export default MarkdownRenderer;
