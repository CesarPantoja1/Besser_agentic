import React from 'react';
import { AlertTriangle, ShieldCheck, ArrowRight, Zap, RefreshCw, XCircle } from 'lucide-react';
import type { QualityReport, ImpactAnalysis } from '../types/sdd-types';

interface SDDDecisionModalProps {
  isOpen: boolean;
  gateType: 'quality' | 'impact' | null;
  qualityReport: QualityReport | null;
  impactAnalysis: ImpactAnalysis | null;
  diffSummary: string | null;
  onDecision: (decision: 'A' | 'B' | 'C') => void;
}

export const SDDDecisionModal: React.FC<SDDDecisionModalProps> = ({
  isOpen,
  gateType,
  qualityReport,
  impactAnalysis,
  diffSummary,
  onDecision,
}) => {
  if (!isOpen || !gateType) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">
        
        {/* Modal Header */}
        <div className={`px-6 py-4 border-b border-border/40 flex items-center gap-3 flex-shrink-0 ${
          gateType === 'quality' ? 'bg-amber-500/[0.04]' : 'bg-brand/[0.04]'
        }`}>
          <div className={`size-10 rounded-xl flex items-center justify-center ${
            gateType === 'quality' ? 'bg-amber-500/10 text-amber-500' : 'bg-brand/10 text-brand'
          }`}>
            {gateType === 'quality' ? <AlertTriangle className="size-5" /> : <ShieldCheck className="size-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {gateType === 'quality' ? 'Control de Calidad de Especificación' : 'Control de Compresión e Impacto'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {gateType === 'quality' 
                ? 'Se han detectado observaciones en las reglas de calidad.' 
                : 'El cambio impacta a otras fases del diseño.'}
            </p>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 select-text min-h-0">
          {diffSummary && (
            <div className="p-3 bg-muted/30 border border-border/40 rounded-xl">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                Cambio Propuesto
              </h4>
              <p className="text-xs text-foreground/80 leading-relaxed italic">{diffSummary}</p>
            </div>
          )}

          {/* Quality Report rendering */}
          {gateType === 'quality' && qualityReport && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                <span>⚠️</span> Observaciones de Calidad ({qualityReport.issues.length})
              </h4>
              <div className="space-y-3">
                {qualityReport.issues.map((issue, idx) => (
                  <div key={idx} className="p-3.5 border border-amber-500/10 bg-amber-500/[0.02] rounded-xl space-y-1.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        issue.severity === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                        {issue.severity === 'error' ? 'Error' : 'Advertencia'}
                      </span>
                      <span className="text-xs font-extrabold text-foreground">{issue.field}</span>
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed pl-1">{issue.description}</p>
                    {issue.suggestion && (
                      <div className="mt-2 pl-3 border-l-2 border-amber-500/30 text-[11px] text-muted-foreground italic leading-relaxed">
                        <strong className="text-[10px] font-bold uppercase not-italic text-amber-600 dark:text-amber-400 block mb-0.5">Sugerencia de corrección:</strong>
                        {issue.suggestion}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Impact Analysis rendering */}
          {gateType === 'impact' && impactAnalysis && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                <span>📊</span> Resumen del Análisis de Impacto
              </h4>
              <p className="text-xs text-foreground/80 leading-relaxed">{impactAnalysis.summary}</p>

              {impactAnalysis.warnings && impactAnalysis.warnings.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Alertas Importantes</h5>
                  <div className="space-y-2">
                    {impactAnalysis.warnings.map((warn, wIdx) => (
                      <div key={wIdx} className="p-3 border border-red-500/10 bg-red-500/[0.01] rounded-xl text-xs text-red-700 dark:text-red-300 leading-relaxed shadow-sm">
                        {warn}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Impact breakdown columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-muted/20 border border-border/30 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Impacto Product Brief</div>
                  <p className="text-xs font-medium text-foreground/80 leading-relaxed">
                    {impactAnalysis.product_impact || 'Sin impacto detectado.'}
                  </p>
                </div>
                <div className="p-3 bg-muted/20 border border-border/30 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Impacto Requisitos</div>
                  <p className="text-xs font-medium text-foreground/80 leading-relaxed">
                    {impactAnalysis.requirements_impact || 'Sin impacto detectado.'}
                  </p>
                </div>
                <div className="p-3 bg-muted/20 border border-border/30 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Impacto Diseño UML</div>
                  <p className="text-xs font-medium text-foreground/80 leading-relaxed">
                    {impactAnalysis.design_impact || 'Sin impacto detectado.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-shrink-0">
          {/* Action A: Cancel */}
          <button
            onClick={() => onDecision('A')}
            className="flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-bold rounded-xl border border-border/80 hover:bg-accent/40 text-foreground transition-all order-3 sm:order-1"
          >
            <XCircle className="size-3.5" />
            {gateType === 'quality' ? 'Cancelar Edición' : 'Anular Cambios'}
          </button>

          <div className="flex flex-col sm:flex-row gap-2 order-1 sm:order-2">
            {/* Action B: Auto-fix / Local Apply */}
            <button
              onClick={() => onDecision('B')}
              className="flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-bold rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98]"
            >
              {gateType === 'quality' ? (
                <>
                  <RefreshCw className="size-3.5" />
                  Corregir Automáticamente
                </>
              ) : (
                <>
                  <ArrowRight className="size-3.5" />
                  Aplicar solo aquí
                </>
              )}
            </button>

            {/* Action C: Ignore / Propagate */}
            <button
              onClick={() => onDecision('C')}
              className="flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98]"
            >
              {gateType === 'quality' ? (
                <>
                  <ShieldCheck className="size-3.5" />
                  Ignorar y Continuar
                </>
              ) : (
                <>
                  <Zap className="size-3.5 text-yellow-300" />
                  Aplicar + Propagar Cambios
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
export default SDDDecisionModal;
