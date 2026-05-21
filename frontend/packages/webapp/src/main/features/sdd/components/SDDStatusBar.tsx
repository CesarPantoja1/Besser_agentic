import React from 'react';
import { Settings, RefreshCw, Trash2, Cpu } from 'lucide-react';
import type { SDDConfig } from '../types/sdd-types';

interface SDDStatusBarProps {
  config: SDDConfig;
  isConnected: boolean;
  onOpenConfig: () => void;
  onResetSession: () => void;
  wsPhase: string;
}

export const SDDStatusBar: React.FC<SDDStatusBarProps> = ({
  config,
  isConnected,
  onOpenConfig,
  onResetSession,
  wsPhase,
}) => {
  return (
    <div className="h-10 bg-muted/40 border-t border-border/40 px-4 flex items-center justify-between text-[11px] font-medium text-muted-foreground flex-shrink-0">
      
      {/* Model & Config Spec */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors" onClick={onOpenConfig}>
          <Cpu className="size-3.5 text-brand" />
          <span className="capitalize">{config.provider}:</span>
          <span className="font-semibold text-foreground/80 font-mono">{config.model}</span>
        </div>

        {/* Connection status light */}
        <div className="flex items-center gap-1.5 border-l border-border/30 pl-4">
          <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' : 'bg-red-500 animate-pulse'}`}></span>
          <span>{isConnected ? 'Conectado a la API' : 'Desconectado'}</span>
        </div>
      </div>

      {/* Control Actions */}
      <div className="flex items-center gap-3">
        {wsPhase !== 'idle' && (
          <span className="flex items-center gap-1 text-brand animate-pulse">
            <RefreshCw className="size-3 animate-spin" />
            Backend activo...
          </span>
        )}

        {/* Configuration settings button */}
        <button
          onClick={onOpenConfig}
          className="flex items-center gap-1 py-1 px-2.5 rounded hover:bg-muted hover:text-foreground transition-all duration-150 active:scale-95"
        >
          <Settings className="size-3" />
          Ajustes
        </button>

        {/* Clear session state button */}
        <button
          onClick={onResetSession}
          className="flex items-center gap-1 py-1 px-2.5 rounded hover:bg-red-500/10 hover:text-red-500 transition-all duration-150 active:scale-95 border border-transparent hover:border-red-500/10"
        >
          <Trash2 className="size-3" />
          Nueva Sesión
        </button>
      </div>

    </div>
  );
};
export default SDDStatusBar;
