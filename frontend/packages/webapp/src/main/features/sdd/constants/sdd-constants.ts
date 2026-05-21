export const SDD_BACKEND_URL = import.meta.env.DEV
  ? 'http://localhost:8000'
  : (import.meta.env.VITE_SDD_BACKEND_URL ?? 'http://localhost:8000');

export const SDD_WS_URL = import.meta.env.DEV
  ? 'ws://localhost:8000'
  : (import.meta.env.VITE_SDD_WS_URL ?? 'ws://localhost:8000');

export const SDD_PHASES = ['product', 'requirements', 'design'] as const;

export const SDD_PHASE_LABELS: Record<string, string> = {
  product: 'Product Brief',
  requirements: 'Requirements',
  design: 'Design',
};

export const localStorageSDDConfigKey = 'besser_sdd_config';
