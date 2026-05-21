import { useReducer, useEffect } from 'react';
import type { SDDPanelState, SDDConfig, QualityReport, ImpactAnalysis } from '../types/sdd-types';
import { localStorageSDDConfigKey } from '../constants/sdd-constants';

const DEFAULT_CONFIG: SDDConfig = {
  apiKey: '',
  model: 'gpt-4o-mini',
  provider: 'openai',
  outputDir: '',
};

const INITIAL_STATE: SDDPanelState = {
  sessionId: null,
  config: DEFAULT_CONFIG,
  productCreated: false,
  requirementsCreated: false,
  designCreated: false,
  productMarkdown: null,
  productData: null,
  requirementsMarkdown: null,
  requirementsData: null,
  designData: null,
  designLayout: null,
  wsPhase: 'idle',
  qualityReport: null,
  impactAnalysis: null,
  diffChanges: null,
  diffSummary: null,
  statusMessage: null,
  activePhase: 'product',
  error: null,
  history: [],
};

type Action =
  | { type: 'LOAD_PERSISTED_CONFIG'; config: SDDConfig }
  | { type: 'SET_SESSION'; sessionId: string; config: SDDConfig }
  | { type: 'RESTORE_STATE'; payload: Partial<SDDPanelState> }
  | { type: 'SET_CONFIG'; config: SDDConfig }
  | { type: 'SET_WS_PHASE'; phase: SDDPanelState['wsPhase'] }
  | { type: 'SET_STATUS_MESSAGE'; message: string | null }
  | { type: 'SPEC_CREATED'; phase: string; data: any; markdown: string; layout?: any; flags: any }
  | { type: 'SPEC_UPDATED'; phase: string; data: any; markdown: string; layout?: any; propagated_specs: string[]; flags: any }
  | { type: 'DIFF_RESULT'; changes: string[]; diff_summary: string }
  | { type: 'QUALITY_REPORT'; report: QualityReport }
  | { type: 'IMPACT_ANALYSIS'; analysis: ImpactAnalysis }
  | { type: 'SET_ACTIVE_PHASE'; phase: SDDPanelState['activePhase'] }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'RESET' }
  | { type: 'ADD_HISTORY'; item: string };

function sddReducer(state: SDDPanelState, action: Action): SDDPanelState {
  switch (action.type) {
    case 'LOAD_PERSISTED_CONFIG':
      return { ...state, config: action.config };
      
    case 'SET_SESSION':
      return {
        ...state,
        sessionId: action.sessionId,
        config: action.config,
        history: [...state.history, `🚀 Sesión SDD iniciada: ${action.sessionId}`],
      };
      
    case 'RESTORE_STATE':
      return {
        ...state,
        ...action.payload,
        history: [...state.history, '🔄 Estado de sesión restaurado.'],
      };
      
    case 'SET_CONFIG':
      return {
        ...state,
        config: action.config,
        history: [...state.history, `⚙️ Configuración actualizada: ${action.config.provider} - ${action.config.model}`],
      };
      
    case 'SET_WS_PHASE':
      return { ...state, wsPhase: action.phase };
      
    case 'SET_STATUS_MESSAGE':
      return { ...state, statusMessage: action.message };
      
    case 'SPEC_CREATED': {
      const phase = action.phase;
      const historyMsg = `✅ ${phase === 'product' ? 'Product Brief' : phase === 'requirements' ? 'Requirements' : 'Design'} creado exitosamente.`;
      
      return {
        ...state,
        wsPhase: 'idle',
        statusMessage: null,
        error: null,
        productCreated: action.flags.productCreated,
        requirementsCreated: action.flags.requirementsCreated,
        designCreated: action.flags.designCreated,
        productMarkdown: phase === 'product' ? action.markdown : state.productMarkdown,
        productData: phase === 'product' ? action.data : state.productData,
        requirementsMarkdown: phase === 'requirements' ? action.markdown : state.requirementsMarkdown,
        requirementsData: phase === 'requirements' ? action.data : state.requirementsData,
        designData: phase === 'design' ? action.data : state.designData,
        designLayout: phase === 'design' ? action.layout : state.designLayout,
        // Move to the next phase automatically on creation
        activePhase: phase === 'product' ? 'requirements' : phase === 'requirements' ? 'design' : 'design',
        history: [...state.history, historyMsg],
      };
    }
    
    case 'SPEC_UPDATED': {
      const phase = action.phase;
      const props = action.propagated_specs;
      let historyMsg = `✏️ ${phase === 'product' ? 'Product Brief' : phase === 'requirements' ? 'Requirements' : 'Design'} actualizado.`;
      if (props && props.length > 0) {
        historyMsg += ` Cambios propagados a: ${props.join(', ')}.`;
      }

      // Check if flags were updated
      const pCreated = action.flags?.productCreated ?? state.productCreated;
      const rCreated = action.flags?.requirementsCreated ?? state.requirementsCreated;
      const dCreated = action.flags?.designCreated ?? state.designCreated;

      return {
        ...state,
        wsPhase: 'idle',
        statusMessage: null,
        error: null,
        qualityReport: null,
        impactAnalysis: null,
        diffChanges: null,
        diffSummary: null,
        productCreated: pCreated,
        requirementsCreated: rCreated,
        designCreated: dCreated,
        // If product was updated, its content and potentially requirements/design was updated via propagation
        productMarkdown: phase === 'product' ? action.markdown : (props.includes('product') ? action.data.product_brief_markdown : state.productMarkdown),
        productData: phase === 'product' ? action.data : (props.includes('product') ? action.data.product_brief : state.productData),
        requirementsMarkdown: phase === 'requirements' ? action.markdown : (props.includes('requirements') ? action.data.requirements_markdown : state.requirementsMarkdown),
        requirementsData: phase === 'requirements' ? action.data : (props.includes('requirements') ? action.data.requirements : state.requirementsData),
        designData: phase === 'design' ? action.data : (props.includes('class_diagram') ? action.data.class_diagram : state.designData),
        designLayout: phase === 'design' ? action.layout : (props.includes('class_diagram') ? action.layout : state.designLayout),
        history: [...state.history, historyMsg],
      };
    }
    
    case 'DIFF_RESULT':
      return {
        ...state,
        diffChanges: action.changes,
        diffSummary: action.diff_summary,
      };
      
    case 'QUALITY_REPORT':
      return {
        ...state,
        wsPhase: 'awaiting_quality',
        qualityReport: action.report,
        statusMessage: '🔍 Se requiere revisión de calidad',
        history: [...state.history, '⚠️ Alerta de calidad en los cambios.'],
      };
      
    case 'IMPACT_ANALYSIS':
      return {
        ...state,
        wsPhase: 'awaiting_impact',
        impactAnalysis: action.analysis,
        statusMessage: '📊 Se requiere aprobación de análisis de impacto',
        history: [...state.history, '⚠️ Análisis de impacto generado, esperando decisión.'],
      };
      
    case 'SET_ACTIVE_PHASE':
      return { ...state, activePhase: action.phase };
      
    case 'SET_ERROR':
      return {
        ...state,
        wsPhase: 'idle',
        statusMessage: null,
        error: action.error,
        history: action.error ? [...state.history, `❌ Error: ${action.error}`] : state.history,
      };
      
    case 'RESET':
      return {
        ...INITIAL_STATE,
        config: state.config, // Keep current configuration
      };
      
    case 'ADD_HISTORY':
      return { ...state, history: [...state.history, action.item] };
      
    default:
      return state;
  }
}

export function useSDDState() {
  const [state, dispatch] = useReducer(sddReducer, INITIAL_STATE);

  // Load configuration from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(localStorageSDDConfigKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'LOAD_PERSISTED_CONFIG', config: parsed });
      } catch (e) {
        console.error('Failed to load SDD config from localStorage', e);
      }
    }
  }, []);

  // Save configuration changes to localStorage
  const updateConfig = (newConfig: SDDConfig) => {
    localStorage.setItem(localStorageSDDConfigKey, JSON.stringify(newConfig));
    dispatch({ type: 'SET_CONFIG', config: newConfig });
  };

  return {
    state,
    dispatch,
    updateConfig,
  };
}
export default useSDDState;
