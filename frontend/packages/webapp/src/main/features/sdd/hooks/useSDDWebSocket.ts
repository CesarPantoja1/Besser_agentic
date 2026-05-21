import { useEffect, useState, useCallback } from 'react';
import { sddWebSocket } from '../services/sddWebSocket';
import type { SDDClientMessage, SDDServerMessage } from '../types/sdd-types';

export function useSDDWebSocket(
  sessionId: string | null,
  dispatch: React.Dispatch<any>
) {
  const [isConnected, setIsConnected] = useState(false);

  // Handle connection status changes
  useEffect(() => {
    let prevConnected: boolean | null = null;
    const unsub = sddWebSocket.onStatusChange((connected) => {
      setIsConnected(connected);
      if (prevConnected !== null && prevConnected !== connected) {
        dispatch({ 
          type: 'ADD_HISTORY', 
          item: connected ? '🔌 Conexión WebSocket establecida.' : '🔌 Conexión WebSocket perdida.' 
        });
      }
      prevConnected = connected;
    });
    return unsub;
  }, [dispatch]);

  // Handle incoming messages and dispatch them to the state reducer
  useEffect(() => {
    if (!sessionId) return;

    const unsub = sddWebSocket.onMessage((msg: SDDServerMessage) => {
      switch (msg.type) {
        case 'status':
          dispatch({ type: 'SET_STATUS_MESSAGE', message: msg.message });
          dispatch({ type: 'SET_WS_PHASE', phase: 'processing' });
          dispatch({ type: 'ADD_HISTORY', item: `ℹ️ ${msg.message}` });
          break;

        case 'spec_created':
          dispatch({
            type: 'SPEC_CREATED',
            phase: msg.phase,
            data: msg.data,
            markdown: msg.markdown,
            layout: msg.layout,
            flags: msg.flags,
          });
          break;

        case 'spec_updated':
          dispatch({
            type: 'SPEC_UPDATED',
            phase: msg.phase,
            data: msg.data,
            markdown: msg.markdown,
            layout: msg.layout,
            propagated_specs: msg.propagated_specs,
            flags: msg.flags,
          });
          break;

        case 'diff_result':
          dispatch({
            type: 'DIFF_RESULT',
            changes: msg.changes,
            diff_summary: msg.diff_summary,
          });
          break;

        case 'quality_report':
          dispatch({ type: 'QUALITY_REPORT', report: msg.report });
          break;

        case 'impact_analysis':
          dispatch({ type: 'IMPACT_ANALYSIS', analysis: msg.analysis });
          break;

        case 'error':
          dispatch({ type: 'SET_ERROR', error: msg.message });
          break;
      }
    });

    return unsub;
  }, [sessionId, dispatch]);

  // Connect / disconnect WebSocket when sessionId changes
  useEffect(() => {
    if (sessionId) {
      sddWebSocket.connect(sessionId);
    } else {
      sddWebSocket.disconnect();
    }

    return () => {
      sddWebSocket.disconnect();
    };
  }, [sessionId]);

  const sendMessage = useCallback((msg: SDDClientMessage) => {
    if (sddWebSocket.isConnected()) {
      sddWebSocket.send(msg);
    } else {
      dispatch({ type: 'SET_ERROR', error: 'No se puede enviar el mensaje. El WebSocket está desconectado.' });
    }
  }, [dispatch]);

  return {
    isConnected,
    sendMessage,
  };
}
export default useSDDWebSocket;
