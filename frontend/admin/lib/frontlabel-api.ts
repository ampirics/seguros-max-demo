import { FrontLabel, FrontLabelCreate, FrontLabelUpdate, PaginatedFrontLabel } from './frontlabel-types';
import { config, buildApiUrl } from './config';
import type { ApiResponse } from './api-types';

export class FrontLabelApi {
  private baseUrl: string;
  private token: string | null = null;
  private storeApiKey: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || config.api.baseUrl;
    this.storeApiKey = config.apiKeys.store;
    this.loadToken();
  }

  private loadToken() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(config.auth.tokenKey);
    }
  }

  private buildQuery(params?: Record<string, unknown>): string {
    if (!params) return '';
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      sp.append(k, String(v));
    }
    const qs = sp.toString();
    return qs ? `?${qs}` : '';
  }

  private getHeaders(): Record<string, string> {
    this.loadToken();
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    headers['Content-Type'] = 'application/json';
    return headers;
  }

  async list(skip = 0, limit = 20): Promise<PaginatedFrontLabel> {
    try {
      const query = this.buildQuery({ skip, limit });
      const url = buildApiUrl(`/frontlabel${query}`);
      
      
      const res = await fetch(url, { headers: this.getHeaders() });
      
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('FrontLabel API - Error response:', errorText);
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      
      const items = await res.json();
      
      // Si backend no devuelve paginado, adaptamos:
      if (Array.isArray(items)) {
        return { items, total: items.length, skip, limit };
      }
      return items;
    } catch (error) {
      console.error('FrontLabel API - List error:', error);
      throw error;
    }
  }

  async get(id: number): Promise<FrontLabel> {
    const url = buildApiUrl(`/frontlabel/${id}`);
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async create(data: FrontLabelCreate): Promise<FrontLabel> {
    const url = buildApiUrl(`/frontlabel`);
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async update(id: number, data: FrontLabelUpdate): Promise<FrontLabel> {
    const url = buildApiUrl(`/frontlabel/${id}`);
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async delete(id: number): Promise<void> {
    const url = buildApiUrl(`/frontlabel/${id}`);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
  }
}

export const frontLabelApi = new FrontLabelApi();
