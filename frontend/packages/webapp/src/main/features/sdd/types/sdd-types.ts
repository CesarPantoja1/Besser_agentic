export interface SDDConfig {
  apiKey: string;
  model: string;
  provider: 'openai' | 'gemini';
  outputDir?: string;
}

export interface QualityIssue {
  field: string;
  description: string;
  suggestion: string;
  severity: 'error' | 'advertencia';
}

export interface QualityReport {
  is_valid: boolean;
  issues: QualityIssue[];
}

export interface ImpactAnalysis {
  summary: string;
  warnings: string[];
  product_impact: string | null;
  requirements_impact: string | null;
  design_impact: string | null;
}

export interface SDDPanelState {
  sessionId: string | null;
  config: SDDConfig;
  productCreated: boolean;
  requirementsCreated: boolean;
  designCreated: boolean;
  productMarkdown: string | null;
  productData: any | null;
  requirementsMarkdown: string | null;
  requirementsData: any | null;
  designData: any | null;
  designLayout: any | null;
  wsPhase: 'idle' | 'processing' | 'awaiting_quality' | 'awaiting_impact';
  qualityReport: QualityReport | null;
  impactAnalysis: ImpactAnalysis | null;
  diffChanges: string[] | null;
  diffSummary: string | null;
  statusMessage: string | null;
  activePhase: 'product' | 'requirements' | 'design';
  error: string | null;
  history: string[]; // Activity history
}

// Client messages to server
export type SDDClientMessage =
  | { action: 'create'; phase: string; prompt?: string }
  | { action: 'modify'; phase: string; prompt: string }
  | { action: 'manual_edit'; phase: string; content: string | object }
  | { action: 'decide'; gate: 'quality' | 'impact'; decision: 'A' | 'B' | 'C' };

// Server messages to client
export type SDDServerMessage =
  | { type: 'status'; message: string }
  | { type: 'spec_created'; phase: string; data: any; markdown: string; layout?: any; flags: any }
  | { type: 'spec_updated'; phase: string; data: any; markdown: string; layout?: any; propagated_specs: string[]; flags: any }
  | { type: 'diff_result'; changes: string[]; diff_summary: string }
  | { type: 'quality_report'; report: QualityReport; awaiting_decision: boolean; options: Record<string, string> }
  | { type: 'impact_analysis'; analysis: ImpactAnalysis; awaiting_decision: boolean; options: Record<string, string> }
  | { type: 'error'; message: string };
