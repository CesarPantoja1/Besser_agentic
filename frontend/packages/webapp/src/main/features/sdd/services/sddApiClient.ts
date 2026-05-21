import { SDD_BACKEND_URL } from '../constants/sdd-constants';
import type { SDDConfig } from '../types/sdd-types';

export class SddApiClient {
  private baseUrl: string;

  constructor(baseUrl = SDD_BACKEND_URL) {
    this.baseUrl = baseUrl;
  }

  async createSession(config?: SDDConfig): Promise<{ sessionId: string; config: SDDConfig }> {
    const response = await fetch(`${this.baseUrl}/api/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config ? { config } : {}),
    });

    if (!response.ok) {
      throw new Error('Failed to create SDD session');
    }

    return response.json();
  }

  async setSessionConfig(sessionId: string, config: SDDConfig): Promise<{ status: string; config: SDDConfig }> {
    const response = await fetch(`${this.baseUrl}/api/session/${sessionId}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error('Failed to update session configuration');
    }

    return response.json();
  }

  async getSessionState(sessionId: string): Promise<{
    sessionId: string;
    config: SDDConfig;
    flags: { productCreated: boolean; requirementsCreated: boolean; designCreated: boolean };
    productMarkdown: string | null;
    productData: any | null;
    requirementsMarkdown: string | null;
    requirementsData: any | null;
    designData: any | null;
    designLayout: any | null;
  }> {
    const response = await fetch(`${this.baseUrl}/api/session/${sessionId}/state`);

    if (!response.ok) {
      throw new Error('Failed to load session state');
    }

    return response.json();
  }

  async endSession(sessionId: string): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/api/session/${sessionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to terminate session');
    }

    return response.json();
  }

  async getAvailableModels(provider: string, apiKey: string): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch available models');
    }

    const data = await response.json();
    return data.models || [];
  }
}

export const sddApiClient = new SddApiClient();
export default sddApiClient;
