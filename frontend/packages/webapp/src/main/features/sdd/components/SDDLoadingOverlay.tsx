import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface SDDLoadingOverlayProps {
  isVisible: boolean;
  message: string | null;
}

export const SDDLoadingOverlay: React.FC<SDDLoadingOverlayProps> = ({
  isVisible,
  message,
}) => {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 bg-background/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border/80 rounded-2xl p-8 max-w-sm w-full flex flex-col items-center text-center shadow-2xl animate-scale-in">
        
        {/* Animated Glow Wave spinner */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute size-14 bg-brand/10 rounded-full animate-ping opacity-60"></div>
          <div className="absolute size-10 bg-brand/20 rounded-full animate-pulse"></div>
          <div className="relative size-12 bg-card border border-brand/20 rounded-full flex items-center justify-center shadow-md">
            <Loader2 className="size-5 text-brand animate-spin" />
          </div>
        </div>

        <h3 className="text-sm font-bold text-foreground mb-1.5 flex items-center gap-1.5 justify-center">
          <Sparkles className="size-4 text-brand animate-pulse" />
          Procesando Arquitectura
        </h3>
        
        <p className="text-xs text-muted-foreground leading-relaxed">
          {message || 'Generando especificaciones inteligentes... Por favor espera un momento.'}
        </p>

        {/* Micro loading progress animation */}
        <div className="w-24 h-[3px] bg-muted/60 rounded-full mt-5 overflow-hidden border border-border/10">
          <div className="h-full bg-brand rounded-full animate-progress-bar w-1/2"></div>
        </div>
        
      </div>
    </div>
  );
};
export default SDDLoadingOverlay;
