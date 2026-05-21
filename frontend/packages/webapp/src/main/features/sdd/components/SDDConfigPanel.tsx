import React, { useState, useEffect } from 'react';
import { Settings, Save, X, Eye, EyeOff, Shield } from 'lucide-react';
import type { SDDConfig } from '../types/sdd-types';
import { sddApiClient } from '../services/sddApiClient';

interface SDDConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: SDDConfig;
  onSave: (config: SDDConfig) => void;
}

export const SDDConfigPanel: React.FC<SDDConfigPanelProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  const [provider, setProvider] = useState<'openai' | 'gemini'>(config.provider);
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [outputDir, setOutputDir] = useState(config.outputDir || '');

  // Dynamic models state
  const [modelsList, setModelsList] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [debouncedApiKey, setDebouncedApiKey] = useState(config.apiKey);

  // Debounce API key changes to avoid excessive requests
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedApiKey(apiKey);
    }, 600);
    return () => clearTimeout(handler);
  }, [apiKey]);

  // Sync state with incoming config on open
  useEffect(() => {
    if (isOpen) {
      setProvider(config.provider);
      setModel(config.model);
      setApiKey(config.apiKey);
      setDebouncedApiKey(config.apiKey);
      setOutputDir(config.outputDir || '');
    }
  }, [isOpen, config]);

  // Fetch available models dynamically from provider and api key
  useEffect(() => {
    let active = true;
    const fetchModels = async () => {
      setIsLoadingModels(true);
      try {
        const response = await sddApiClient.getAvailableModels(provider, debouncedApiKey);
        if (active) {
          setModelsList(response);
          // Auto-select model if the active one isn't in the newly fetched list
          if (response.length > 0 && !response.includes(model)) {
            const isInitialConfig = config.provider === provider && config.model === model && config.apiKey === debouncedApiKey;
            if (!isInitialConfig || !response.includes(config.model)) {
              setModel(response[0]);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching available models:', err);
        if (active) {
          // Curated fallbacks
          if (provider === 'openai') {
            setModelsList(['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'o1-mini']);
          } else {
            setModelsList(['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-flash']);
          }
        }
      } finally {
        if (active) {
          setIsLoadingModels(false);
        }
      }
    };

    if (isOpen) {
      void fetchModels();
    }

    return () => {
      active = false;
    };
  }, [isOpen, provider, debouncedApiKey]);

  if (!isOpen) return null;

  const handleProviderChange = (newProvider: 'openai' | 'gemini') => {
    setProvider(newProvider);
    // Set smart defaults to show instantly while dynamic models list is fetching
    if (newProvider === 'openai') {
      setModel('gpt-4o-mini');
    } else {
      setModel('gemini-1.5-flash');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      provider,
      model,
      apiKey,
      outputDir,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Settings className="size-4.5 text-brand" />
            <h3 className="text-sm font-bold text-foreground">Configuración del Asistente SDD</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          
          {/* Provider Choice */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Proveedor LLM</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleProviderChange('openai')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                  provider === 'openai'
                    ? 'border-brand bg-brand/[0.04] text-brand'
                    : 'border-border/80 bg-card hover:bg-accent/40 text-muted-foreground'
                }`}
              >
                OpenAI GPT
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange('gemini')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                  provider === 'gemini'
                    ? 'border-brand bg-brand/[0.04] text-brand'
                    : 'border-border/80 bg-card hover:bg-accent/40 text-muted-foreground'
                }`}
              >
                Google Gemini
              </button>
            </div>
          </div>

          {/* Model Selector */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Modelo</label>
              {isLoadingModels && (
                <span className="text-[9px] text-brand animate-pulse font-medium">Cargando modelos disponibles...</span>
              )}
            </div>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-border/80 bg-card focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all disabled:opacity-75"
              disabled={isLoadingModels || modelsList.length === 0}
            >
              {modelsList.map((m) => (
                <option key={m} value={m}>
                  {m === 'gpt-4o-mini' && 'gpt-4o-mini (Recomendado - Rápido)'}
                  {m === 'gemini-1.5-flash' && 'gemini-1.5-flash (Recomendado - Ultra-rápido)'}
                  {m !== 'gpt-4o-mini' && m !== 'gemini-1.5-flash' && m}
                </option>
              ))}
            </select>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Clave API (Opcional)</label>
              <span className="text-[9px] text-muted-foreground/60 italic flex items-center gap-1">
                <Shield className="size-2.5 text-emerald-500" />
                Guardado Local
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  provider === 'openai'
                    ? 'sk-proj-... (Dejar vacío para usar clave de servidor)'
                    : 'AIzaSy... (Dejar vacío para usar clave de servidor)'
                }
                className="w-full pl-3 pr-10 py-2 text-xs rounded-lg border border-border/80 bg-card focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 text-muted-foreground/80 hover:text-foreground transition-colors p-1 rounded"
              >
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground leading-relaxed mt-1">
              Si se deja vacío, el servidor utilizará las claves de entorno configuradas por defecto en el sistema local.
            </p>
          </div>

          {/* Output Directory Path */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Carpeta de Salida de Archivos</label>
            <input
              type="text"
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder="Ej. F:\EPN_INVESTIGACIÓN\Besser_agentic\sdd_outputs"
              className="w-full px-3 py-2 text-xs rounded-lg border border-border/80 bg-card focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
            />
            <p className="text-[9px] text-muted-foreground leading-relaxed mt-1">
              Ruta absoluta en el equipo donde se guardarán automáticamente los archivos generados (.md, .json).
            </p>
          </div>

          {/* Save button */}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 mt-6 text-xs font-bold rounded-xl bg-brand text-brand-foreground hover:bg-brand/95 shadow-md shadow-brand/10 transition-all active:scale-[0.98]"
          >
            <Save className="size-3.5" />
            Guardar Configuración
          </button>

        </form>
      </div>
    </div>
  );
};
export default SDDConfigPanel;
