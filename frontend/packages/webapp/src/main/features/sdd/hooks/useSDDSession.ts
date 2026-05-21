import { useState, useEffect, useCallback } from 'react';
import { sddApiClient } from '../services/sddApiClient';
import type { SDDConfig } from '../types/sdd-types';

const localStorageSDDActiveSessionKey = 'besser_sdd_active_session_id';

export function useSDDSession(
  config: SDDConfig,
  dispatch: React.Dispatch<any>
) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const savedSessionId = localStorage.getItem(localStorageSDDActiveSessionKey);
      if (!savedSessionId) {
        // No active session — create one automatically so the WS connects immediately.
        // Read persisted config from localStorage so we use the user's saved API key/provider.
        let sessionConfig = config;
        try {
          const savedConfigStr = localStorage.getItem('besser_sdd_config');
          if (savedConfigStr) {
            sessionConfig = JSON.parse(savedConfigStr);
          }
        } catch { /* use default config */ }

        try {
          const result = await sddApiClient.createSession(sessionConfig);
          localStorage.setItem(localStorageSDDActiveSessionKey, result.sessionId);
          setSessionId(result.sessionId);
          dispatch({ type: 'SET_SESSION', sessionId: result.sessionId, config: result.config });
        } catch (err) {
          console.error('Failed to auto-start new SDD session', err);
          dispatch({ type: 'SET_ERROR', error: 'No se pudo iniciar la sesión en el servidor backend.' });
        } finally {
          setIsInitializing(false);
        }
        return;
      }

      try {
        // Fetch current session state from backend
        const sessionState = await sddApiClient.getSessionState(savedSessionId);
        
        setSessionId(savedSessionId);
        dispatch({ type: 'SET_SESSION', sessionId: savedSessionId, config: sessionState.config });
        
        // Restore all spec data and flags
        dispatch({
          type: 'RESTORE_STATE',
          payload: {
            productCreated: sessionState.flags.productCreated,
            requirementsCreated: sessionState.flags.requirementsCreated,
            designCreated: sessionState.flags.designCreated,
            productMarkdown: sessionState.productMarkdown,
            productData: sessionState.productData,
            requirementsMarkdown: sessionState.requirementsMarkdown,
            requirementsData: sessionState.requirementsData,
            designData: sessionState.designData,
            designLayout: sessionState.designLayout,
            // Restore active phase logically based on what is completed
            activePhase: sessionState.flags.designCreated 
              ? 'design' 
              : sessionState.flags.requirementsCreated 
                ? 'design' 
                : sessionState.flags.productCreated 
                  ? 'requirements' 
                  : 'product',
          }
        });
      } catch (err) {
        console.error('Failed to restore SDD session, it might have expired or backend was restarted. Purging...', err);
        localStorage.removeItem(localStorageSDDActiveSessionKey);
        // Session was stale — create a fresh one so the WS connects immediately
        try {
          let sessionConfig = config;
          try {
            const savedConfigStr = localStorage.getItem('besser_sdd_config');
            if (savedConfigStr) sessionConfig = JSON.parse(savedConfigStr);
          } catch { /* use default */ }
          const result = await sddApiClient.createSession(sessionConfig);
          localStorage.setItem(localStorageSDDActiveSessionKey, result.sessionId);
          setSessionId(result.sessionId);
          dispatch({ type: 'SET_SESSION', sessionId: result.sessionId, config: result.config });
        } catch (createErr) {
          console.error('Failed to create replacement session', createErr);
          dispatch({ type: 'SET_ERROR', error: 'No se pudo reconectar al servidor backend.' });
        }
      } finally {
        setIsInitializing(false);
      }
    };

    void restoreSession();
  }, [dispatch]);

  // Create a new session
  const startNewSession = useCallback(async (currentConfig = config) => {
    setIsInitializing(true);
    dispatch({ type: 'SET_WS_PHASE', phase: 'processing' });
    dispatch({ type: 'SET_STATUS_MESSAGE', message: '🚀 Iniciando sesión SDD...' });
    
    try {
      const result = await sddApiClient.createSession(currentConfig);
      
      localStorage.setItem(localStorageSDDActiveSessionKey, result.sessionId);
      setSessionId(result.sessionId);
      
      dispatch({ type: 'SET_SESSION', sessionId: result.sessionId, config: result.config });
      dispatch({ type: 'SET_WS_PHASE', phase: 'idle' });
      dispatch({ type: 'SET_STATUS_MESSAGE', message: null });
      return result.sessionId;
    } catch (err) {
      console.error('Failed to start new SDD session', err);
      dispatch({ type: 'SET_ERROR', error: 'No se pudo iniciar la sesión en el servidor backend.' });
      setIsInitializing(false);
      return null;
    }
  }, [config, dispatch]);

  // Synchronize config updates with the active session
  const updateSessionConfig = useCallback(async (newConfig: SDDConfig) => {
    if (!sessionId) return;
    try {
      await sddApiClient.setSessionConfig(sessionId, newConfig);
      dispatch({ type: 'SET_CONFIG', config: newConfig });
    } catch (err) {
      console.error('Failed to sync config with active session', err);
    }
  }, [sessionId, dispatch]);

  // Terminate active session
  const destroySession = useCallback(async () => {
    if (!sessionId) return;
    try {
      await sddApiClient.endSession(sessionId);
    } catch (err) {
      console.error('Failed to end session cleanly on server', err);
    } finally {
      localStorage.removeItem(localStorageSDDActiveSessionKey);
      setSessionId(null);
      dispatch({ type: 'RESET' });
    }
  }, [sessionId, dispatch]);

  return {
    sessionId,
    isInitializing,
    startNewSession,
    updateSessionConfig,
    destroySession,
  };
}
export default useSDDSession;
