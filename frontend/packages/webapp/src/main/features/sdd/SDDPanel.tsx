import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Sparkles, AlertCircle, RefreshCw, Cpu, Settings } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { updateDiagramModelThunk, switchDiagramTypeThunk, bumpEditorRevision } from '../../app/store/workspaceSlice';
import { ClassDiagramConverter } from '../assistant/services/converters/ClassDiagramConverter';
import { toast } from 'react-toastify';

// SDD Hooks
import { useSDDState } from './hooks/useSDDState';
import { useSDDSession } from './hooks/useSDDSession';
import { useSDDWebSocket } from './hooks/useSDDWebSocket';

// SDD Components
import { SDDStepper } from './components/SDDStepper';
import { SDDProductView } from './components/SDDProductView';
import { SDDRequirementsView } from './components/SDDRequirementsView';
import { SDDDesignView } from './components/SDDDesignView';
import { SDDChat } from './components/SDDChat';
import { SDDDecisionModal } from './components/SDDDecisionModal';
import { SDDConfigPanel } from './components/SDDConfigPanel';
import { SDDLoadingOverlay } from './components/SDDLoadingOverlay';
import { SDDStatusBar } from './components/SDDStatusBar';

interface SDDPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SDDPanel: React.FC<SDDPanelProps> = ({ isOpen, onClose }) => {
  const reduxDispatch = useAppDispatch();
  const activeDiagramType = useAppSelector((state) => state.workspace.activeDiagramType);

  const { state, dispatch, updateConfig } = useSDDState();
  const {
    sessionId,
    isInitializing,
    startNewSession,
    updateSessionConfig,
    destroySession,
  } = useSDDSession(state.config, dispatch);

  const { isConnected, sendMessage } = useSDDWebSocket(sessionId, dispatch);

  // Dialog & panel visibilities
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Guard: only allow auto-progression after the initial session bootstrap
  // (restore or create) is complete, preventing spurious generation on reload.
  const autoProgressionReady = useRef(false);
  useEffect(() => {
    if (!isInitializing && sessionId) {
      // Small delay so the restored state settles before we evaluate auto-progression
      const timer = setTimeout(() => { autoProgressionReady.current = true; }, 500);
      return () => clearTimeout(timer);
    }
  }, [isInitializing, sessionId]);

  // ─── Handlers (declared before useEffect hooks and early return) ───

  // Handle active phase transitions
  const handlePhaseChange = useCallback((phase: 'product' | 'requirements' | 'design') => {
    dispatch({ type: 'SET_ACTIVE_PHASE', phase });
  }, [dispatch]);

  // Triggers action via WebSocket
  const handleGenerate = useCallback(() => {
    const active = state.activePhase;
    
    const run = async () => {
      let sId = sessionId;
      if (!sId) {
        sId = await startNewSession();
        if (!sId) return;
      }
      
      sendMessage({
        action: 'create',
        phase: active,
        prompt: active === 'product' ? 'Generar especificación de producto estándar.' : undefined,
      });
    };

    void run();
  }, [state.activePhase, sessionId, startNewSession, sendMessage]);

  // Triggers product creation with the user's specific prompt
  const handleGenerateProduct = useCallback((prompt: string) => {
    const run = async () => {
      let sId = sessionId;
      if (!sId) {
        sId = await startNewSession();
        if (!sId) return;
      }
      sendMessage({
        action: 'create',
        phase: 'product',
        prompt,
      });
    };
    void run();
  }, [sessionId, startNewSession, sendMessage]);

  // Modify active spec with a prompt
  const handleModifySpec = useCallback((prompt: string) => {
    const active = state.activePhase;
    const run = async () => {
      let sId = sessionId;
      if (!sId) {
        sId = await startNewSession();
        if (!sId) return;
      }
      sendMessage({
        action: 'modify',
        phase: active,
        prompt,
      });
    };
    void run();
  }, [state.activePhase, sessionId, startNewSession, sendMessage]);

  // Apply manual edits to active spec
  const handleManualEdit = useCallback((content: string | object) => {
    const active = state.activePhase;
    const run = async () => {
      let sId = sessionId;
      if (!sId) {
        sId = await startNewSession();
        if (!sId) return;
      }
      sendMessage({
        action: 'manual_edit',
        phase: active,
        content,
      });
    };
    void run();
  }, [state.activePhase, sessionId, startNewSession, sendMessage]);

  // Handle Quality / Impact Gate decisions (Option A/B/C)
  const handleGateDecision = useCallback((decision: 'A' | 'B' | 'C') => {
    const gateType = state.wsPhase === 'awaiting_quality' ? 'quality' : 'impact';
    sendMessage({
      action: 'decide',
      gate: gateType,
      decision,
    });
  }, [state.wsPhase, sendMessage]);

  // Apply generated class diagram to live Apollon editor
  const handleApplyToCanvas = useCallback(async (designData: any) => {
    if (!designData) return;

    try {
      dispatch({ type: 'SET_WS_PHASE', phase: 'processing' });
      dispatch({ type: 'SET_STATUS_MESSAGE', message: '🔌 Exportando diseño al editor canvas...' });

      // 1. Switch active diagram type to ClassDiagram if needed
      if (activeDiagramType !== 'ClassDiagram') {
        dispatch({ type: 'ADD_HISTORY', item: '🔄 Cambiando canvas activo a Diagrama de Clases...' });
        await reduxDispatch(switchDiagramTypeThunk({ diagramType: 'ClassDiagram' })).unwrap();
      }

      // 2. Convert raw design specification to Apollon system format
      const converter = new ClassDiagramConverter();
      const apollonModel = converter.convertCompleteSystem(designData);

      // 3. Inject model directly into editor Redux state
      await reduxDispatch(updateDiagramModelThunk({ model: apollonModel as any })).unwrap();

      // 4. Force diagram editor revision bump to trigger clean component re-rendering
      reduxDispatch(bumpEditorRevision());

      dispatch({ type: 'SET_WS_PHASE', phase: 'idle' });
      dispatch({ type: 'SET_STATUS_MESSAGE', message: null });
      dispatch({ type: 'ADD_HISTORY', item: '🎉 ¡Diseño UML exportado al canvas con éxito!' });
      
      toast.success('¡Estructura de clases exportada al canvas!');
    } catch (err: any) {
      console.error('Error applying to canvas:', err);
      dispatch({ type: 'SET_ERROR', error: `Error de exportación: ${err.message}` });
      toast.error('Fallo al exportar modelo: ' + err.message);
    }
  }, [activeDiagramType, dispatch, reduxDispatch]);

  const handleSaveConfig = useCallback((newConfig: any) => {
    updateConfig(newConfig);
    if (sessionId) {
      void updateSessionConfig(newConfig);
    }
  }, [updateConfig, sessionId, updateSessionConfig]);

  // ─── Auto-progression effects ───
  // Only fire AFTER the initial session bootstrap is complete (autoProgressionReady ref).

  useEffect(() => {
    if (!autoProgressionReady.current) return;
    if (
      state.activePhase === 'requirements' &&
      state.productCreated &&
      !state.requirementsCreated &&
      state.wsPhase === 'idle' &&
      isConnected
    ) {
      handleGenerate();
    }
  }, [state.activePhase, state.productCreated, state.requirementsCreated, state.wsPhase, isConnected, handleGenerate]);

  useEffect(() => {
    if (!autoProgressionReady.current) return;
    if (
      state.activePhase === 'design' &&
      state.requirementsCreated &&
      !state.designCreated &&
      state.wsPhase === 'idle' &&
      isConnected
    ) {
      handleGenerate();
    }
  }, [state.activePhase, state.requirementsCreated, state.designCreated, state.wsPhase, isConnected, handleGenerate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-background/95 backdrop-blur-md overflow-hidden animate-fade-in select-none">
      
      {/* Sidebar / Left Column (Main generation workspace) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-border/45">
        
        {/* Navigation & Header */}
        <div className="h-16 px-6 border-b border-border/40 flex items-center justify-between flex-shrink-0 bg-muted/10">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-border/80 hover:bg-accent/40 hover:text-foreground transition-all duration-200 active:scale-95"
            >
              <X className="size-4" />
            </button>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-tight text-foreground flex items-center gap-1.5">
                <Sparkles className="size-4 text-brand animate-pulse" />
                Espacio de Trabajo SDD
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground">Framework de Documento de Diseño de Software</span>
            </div>
          </div>

          {/* Quick Setup tools */}
          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-semibold rounded-lg border border-brand/20 bg-brand/[0.03] text-brand hover:bg-brand/[0.08] transition-colors"
          >
            <Cpu className="size-3.5" />
            Configurar LLM
          </button>
        </div>

        {/* Nav stepper map - Placed under the header as its own layout-optimized bar */}
        <SDDStepper
          activePhase={state.activePhase}
          productCreated={state.productCreated}
          requirementsCreated={state.requirementsCreated}
          designCreated={state.designCreated}
          onChangePhase={handlePhaseChange}
        />

        {/* Dynamic spec rendering views */}
        <div className="flex-1 overflow-hidden min-h-0 bg-muted/[0.02]">
          {state.activePhase === 'product' && (
            <SDDProductView
              productCreated={state.productCreated}
              productMarkdown={state.productMarkdown}
              onGenerate={handleGenerateProduct}
              onModify={handleModifySpec}
              onManualEdit={handleManualEdit}
              wsPhase={state.wsPhase}
            />
          )}
          {state.activePhase === 'requirements' && (
            <SDDRequirementsView
              requirementsCreated={state.requirementsCreated}
              requirementsMarkdown={state.requirementsMarkdown}
              onGenerate={handleGenerate}
              onManualEdit={handleManualEdit}
              wsPhase={state.wsPhase}
            />
          )}
          {state.activePhase === 'design' && (
            <SDDDesignView
              designCreated={state.designCreated}
              designData={state.designData}
              onApplyToCanvas={handleApplyToCanvas}
              wsPhase={state.wsPhase}
              onGenerate={handleGenerate}
            />
          )}
        </div>

        {/* Status indicator bar */}
        <SDDStatusBar
          config={state.config}
          isConnected={isConnected}
          onOpenConfig={() => setIsConfigOpen(true)}
          onResetSession={destroySession}
          wsPhase={state.wsPhase}
        />
      </div>

      {/* Right Column (Live chatbot iteration sidebar) */}
      <div className="w-[340px] flex-shrink-0 h-full p-4 bg-muted/[0.04]">
        <SDDChat
          activePhase={state.activePhase}
          wsPhase={state.wsPhase}
          statusMessage={state.statusMessage}
          history={state.history}
          onSendMessage={handleModifySpec}
        />
      </div>

      {/* Decision-making gate dialog (Quality Check / Impact Analysis warnings) */}
      <SDDDecisionModal
        isOpen={state.wsPhase === 'awaiting_quality' || state.wsPhase === 'awaiting_impact'}
        gateType={state.wsPhase === 'awaiting_quality' ? 'quality' : state.wsPhase === 'awaiting_impact' ? 'impact' : null}
        qualityReport={state.qualityReport}
        impactAnalysis={state.impactAnalysis}
        diffSummary={state.diffSummary}
        onDecision={handleGateDecision}
      />

      {/* Dynamic API settings config overlay */}
      <SDDConfigPanel
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={state.config}
        onSave={handleSaveConfig}
      />

      {/* Loading barrier during active AI generation / modifications */}
      <SDDLoadingOverlay
        isVisible={state.wsPhase === 'processing'}
        message={state.statusMessage}
      />

    </div>
  );
};
export default SDDPanel;
