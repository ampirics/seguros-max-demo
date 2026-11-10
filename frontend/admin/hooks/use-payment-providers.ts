'use client';

import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/company-context';
import { apiClient } from '@/lib/api-client';

interface PaymentProvider {
  id: string;
  provider_key: string;
  display_name: string;
  description: string;
  category: 'card' | 'bank_transfer' | 'digital_wallet';
  environment: 'sandbox' | 'production';
  is_active: boolean;
  config?: Record<string, any>;
}

interface CheckoutData {
  checkout_url: string;
  payload: Record<string, string>;
  provider: string;
  order_id: number;
}

export const usePaymentProviders = () => {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeCompany } = useCompany();

  const fetchProviders = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.getConfiguredPaymentProviders();
      setProviders(data.providers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const initiateCheckout = async (orderId: number, providerKey: string): Promise<CheckoutData> => {
    try {
      // Agregar método al apiClient más tarde
      return await apiClient.request<CheckoutData>(`/payments/checkout/${orderId}`, {
        method: 'POST',
        body: JSON.stringify({ provider_key: providerKey }),
      });
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Error iniciando el checkout');
    }
  };

  useEffect(() => {
    fetchProviders();
  }, [activeCompany]);

  return {
    providers,
    loading,
    error,
    refetch: fetchProviders,
    initiateCheckout,
  };
};

export const useAvailableProviders = () => {
  const [availableProviders, setAvailableProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeCompany } = useCompany();

  const fetchAvailableProviders = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.getPaymentProviders();
      setAvailableProviders(data.providers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setAvailableProviders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableProviders();
  }, [activeCompany]);

  return {
    availableProviders,
    loading,
    error,
    refetch: fetchAvailableProviders,
  };
};
