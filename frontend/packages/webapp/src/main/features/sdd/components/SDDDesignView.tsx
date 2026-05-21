import React, { useState } from 'react';
import { Sparkles, Layout, Database, Layers, ArrowRight, Eye, Code, ArrowUpRight, HelpCircle } from 'lucide-react';

interface SDDDesignViewProps {
  designCreated: boolean;
  designData: any | null; // ClassDiagramDesign
  onApplyToCanvas: (diagram: any) => void;
  wsPhase: string;
  onGenerate: () => void;
}

export const SDDDesignView: React.FC<SDDDesignViewProps> = ({
  designCreated,
  designData,
  onApplyToCanvas,
  wsPhase,
  onGenerate,
}) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'json'>('visual');

  // CTA State (Not created yet)
  if (!designCreated) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto px-4 py-16 animate-fade-in">
        <div className="size-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mb-6 shadow-sm">
          <Layout className="size-8 text-brand animate-pulse" />
        </div>
        
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">Generar Modelo de Diseño UML</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">
          El asistente analizará las especificaciones y requisitos para generar una arquitectura de clases UML óptima. Esto incluye la definición de entidades, atributos con tipos, métodos con firmas completas, y sus relaciones (herencia, composición, asociación, etc.).
        </p>

        <button
          onClick={onGenerate}
          disabled={wsPhase !== 'idle'}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold rounded-xl bg-brand text-brand-foreground hover:bg-brand/95 shadow-md shadow-brand/10 transition-all duration-200 disabled:opacity-50"
        >
          <Sparkles className="size-4" />
          Auto-Generar Diseño de Clases
        </button>
      </div>
    );
  }

  const classes = designData?.classes || [];
  const relationships = designData?.relationships || [];
  const systemName = designData?.systemName || 'Sistema de Software';

  // Get visibility symbol
  const getVisibilitySymbol = (visibility?: string) => {
    switch (visibility) {
      case 'public': return '+';
      case 'private': return '-';
      case 'protected': return '#';
      default: return '+';
    }
  };

  return (
    <div className="flex flex-col h-full p-6 animate-fade-in overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-6 flex-shrink-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Layout className="size-5 text-brand" />
            <h2 className="text-lg font-bold text-foreground">{systemName}</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Arquitectura UML generada a partir de los requisitos</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tabs switch */}
          <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/40">
            <button
              onClick={() => setActiveTab('visual')}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'visual'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="size-3" />
              Vista Arquitectura
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'json'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Code className="size-3" />
              Estructura JSON
            </button>
          </div>

          {/* Export to Canvas Action */}
          <button
            onClick={() => onApplyToCanvas(designData)}
            disabled={wsPhase !== 'idle'}
            className="flex items-center gap-2 py-1.5 px-4 text-xs font-bold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98]"
          >
            <ArrowUpRight className="size-3.5" />
            Exportar al Editor Canvas
          </button>
        </div>
      </div>

      {/* Main content viewport */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === 'visual' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden">
            {/* Classes Explorer (2 cols) */}
            <div className="lg:col-span-2 flex flex-col h-full bg-muted/10 border border-border/40 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-muted/30 border-b border-border/40 flex items-center justify-between flex-shrink-0">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="size-3.5 text-brand" />
                  Clases e Interfaces ({classes.length})
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {classes.map((cls: any, cIdx: number) => (
                    <div
                      key={cIdx}
                      className="bg-card border border-border/60 hover:border-brand/40 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      {/* Class Header */}
                      <div className="px-4 py-3 border-b border-border/40 bg-muted/30 flex items-center justify-between">
                        <span className={`text-sm font-extrabold tracking-tight ${cls.isAbstract || cls.isInterface ? 'italic' : ''}`}>
                          {cls.className}
                        </span>
                        {cls.isInterface ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            interface
                          </span>
                        ) : cls.isAbstract ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                            abstract
                          </span>
                        ) : cls.isEnumeration ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-500 border border-teal-500/20">
                            enum
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand/10 text-brand border border-brand/20">
                            class
                          </span>
                        )}
                      </div>

                      {/* Class Attributes */}
                      <div className="p-3 border-b border-border/30 bg-card">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Atributos</div>
                        {cls.attributes && cls.attributes.length > 0 ? (
                          <div className="space-y-1.5 font-mono text-[11px]">
                            {cls.attributes.map((attr: any, aIdx: number) => (
                              <div key={aIdx} className="flex items-center justify-between text-foreground/80 hover:text-foreground">
                                <span>
                                  <span className="text-brand/80 font-bold mr-1.5">{getVisibilitySymbol(attr.visibility)}</span>
                                  {attr.name}
                                </span>
                                <span className="text-muted-foreground text-[10px]">{attr.type}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic pl-3">Sin atributos</div>
                        )}
                      </div>

                      {/* Class Methods */}
                      <div className="p-3 bg-card">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Métodos</div>
                        {cls.methods && cls.methods.length > 0 ? (
                          <div className="space-y-1.5 font-mono text-[11px]">
                            {cls.methods.map((method: any, mIdx: number) => {
                              const params = method.parameters
                                ?.map((p: any) => `${p.name}: ${p.type}`)
                                .join(', ') || '';
                              return (
                                <div key={mIdx} className="flex items-start justify-between gap-1 text-foreground/80 hover:text-foreground">
                                  <span className="truncate">
                                    <span className="text-emerald-500/80 font-bold mr-1.5">{getVisibilitySymbol(method.visibility)}</span>
                                    <span className="font-semibold">{method.name}</span>
                                    <span className="text-muted-foreground">({params})</span>
                                  </span>
                                  <span className="text-muted-foreground text-[10px] flex-shrink-0">:{method.returnType}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic pl-3">Sin métodos</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Relationships & Connections (1 col) */}
            <div className="flex flex-col h-full bg-muted/10 border border-border/40 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-muted/30 border-b border-border/40 flex items-center justify-between flex-shrink-0">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="size-3.5 text-brand" />
                  Relaciones ({relationships.length})
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {relationships.length > 0 ? (
                  relationships.map((rel: any, rIdx: number) => (
                    <div
                      key={rIdx}
                      className="bg-card border border-border/50 hover:border-brand/30 rounded-xl p-3.5 flex items-center gap-3 transition-colors shadow-sm"
                    >
                      <div className="flex-1 text-right">
                        <div className="text-xs font-extrabold text-foreground">{rel.source}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Multiplicidad: {rel.sourceMultiplicity}</div>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center px-1.5 flex-shrink-0">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-brand/[0.06] text-brand border border-brand/10 mb-1">
                          {rel.type}
                        </span>
                        <div className="flex items-center gap-1 w-12 text-muted-foreground">
                          <div className="h-[1px] bg-border flex-1"></div>
                          <ArrowRight className="size-3 flex-shrink-0 text-brand" />
                        </div>
                        {rel.name && <span className="text-[9px] text-muted-foreground mt-1 truncate max-w-[80px]">{rel.name}</span>}
                      </div>

                      <div className="flex-1 text-left">
                        <div className="text-xs font-extrabold text-foreground">{rel.target}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Multiplicidad: {rel.targetMultiplicity}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <HelpCircle className="size-8 text-muted-foreground/60 mb-2" />
                    <p className="text-xs text-muted-foreground">No se detectaron relaciones directas en esta arquitectura.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full bg-card border border-border/80 rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b border-border/40 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground flex-shrink-0">
              <span>Estructura de Datos JSON compatible con el canvas</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(designData, null, 2));
                }}
                className="text-[10px] font-bold px-2 py-1 rounded bg-muted hover:bg-muted-hover text-foreground active:scale-95 transition-all"
              >
                Copiar JSON
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-foreground select-text bg-card">
              {JSON.stringify(designData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
export default SDDDesignView;
