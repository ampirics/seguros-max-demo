/**
 * Hook usePaymentFees
 * Obtiene los métodos de pago con sus configuraciones de fees desde el backend
 * y proporciona utilidades para calcular montos con fees
 */

'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export interface PaymentFee {
  id: string;
  payment_method: string;
  fee_type: 'charge' | 'discount';
  fee_percentage: number;
  min_amount: number | null;
  max_amount: number | null;
  is_active: boolean;
  show_fee_calculation: boolean;
  description: string | null;
  apply_to?: 'subtotal' | 'total';
}

export interface FeeCalculation {
  feeAmount: number;
  total: number;
  feePercentage: number;
  feeType: 'charge' | 'discount';
  shouldShow: boolean;
  feeDescription: string | null;
  paymentMethod: string;
}

export interface UsePaymentFeesResult {
  fees: PaymentFee[];
  loading: boolean;
  error: string | null;
  feesEnabled: boolean;
  calculateFeeForMethod: (paymentMethod: string, baseTotal: number, subtotal?: number) => FeeCalculation | null;
  getFeeForMethod: (paymentMethod: string) => PaymentFee | null;
  refetch: () => Promise<void>;
}

export function usePaymentFees(): UsePaymentFeesResult {
  const [fees, setFees] = useState<PaymentFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feesEnabled, setFeesEnabled] = useState(false);

  // Obtener métodos de pago con fees
  const fetchFees = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.getPaymentMethodFees();

      if (response?.data) {
        const feesData = Array.isArray(response.data) ? response.data : [response.data];
        setFees(feesData);
        // Si hay fees, habilitar la visualización de fees
        setFeesEnabled(feesData.length > 0);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error obteniendo payment fees:', errorMessage);
      setFeesEnabled(false);
    } finally {
      setLoading(false);
    }
  };

  // Cargar fees al montar el componente
  useEffect(() => {
    fetchFees();
  }, []);

  /**
   * Calcula el fee para un método de pago específico
   * @param paymentMethod - Nombre del método de pago
   * @param baseTotal - Total con ITBIS incluido (usado por defecto)
   * @param subtotal - Subtotal sin ITBIS (opcional, usado si apply_to=subtotal)
   */
  const calculateFeeForMethod = (
    paymentMethod: string,
    baseTotal: number,
    subtotal?: number
  ): FeeCalculation | null => {
    const fee = fees.find(f => f.payment_method === paymentMethod);

    if (!fee || !fee.is_active) {
      return null;
    }

    // IMPORTANTE: El cálculo es diferente según apply_to
    const applyTo = fee.apply_to || 'total';
    
    let feeAmount = 0;
    let finalTotal = baseTotal;
    
    if (applyTo === 'subtotal' && subtotal) {
      // Fee sobre SUBTOTAL
      // Flujo:
      // 1. Calcular fee sobre subtotal (CHARGE suma, DISCOUNT resta)
      feeAmount = subtotal * (fee.fee_percentage / 100);
      
      // 2. Aplicar fee al subtotal
      const subtotalAfterFee = fee.fee_type === 'charge' 
        ? subtotal + feeAmount 
        : subtotal - feeAmount;
      
      // 3. Calcular impuesto sobre el subtotal con fee ya aplicado (18%)
      // baseTotal ya incluye impuesto original (18% de subtotal), así que:
      // - Restar impuesto original: baseTotal - (subtotal * 0.18)
      // - Calcular impuesto nuevo: subtotalAfterFee * 0.18
      // - Total final: subtotalAfterFee + impuesto nuevo
      const originalTax = subtotal * 0.18;
      const newTax = subtotalAfterFee * 0.18;
      finalTotal = subtotalAfterFee + newTax;
      
    } else {
      // Fee sobre TOTAL (incluyendo impuestos)
      // baseTotal ya incluye subtotal + impuestos
      // Calcular fee sobre ese total
      feeAmount = baseTotal * (fee.fee_percentage / 100);
      finalTotal = fee.fee_type === 'charge' 
        ? baseTotal + feeAmount 
        : baseTotal - feeAmount;
    }

    // Verificar restricciones de monto
    if (fee.min_amount !== null && (subtotal || baseTotal) < fee.min_amount) {
      return null; // No aplica el fee
    }

    if (fee.max_amount !== null && (subtotal || baseTotal) > fee.max_amount) {
      return null; // No aplica el fee
    }

    return {
      feeAmount: Math.round(feeAmount * 100) / 100,
      total: Math.round(finalTotal * 100) / 100,
      feePercentage: fee.fee_percentage,
      feeType: fee.fee_type,
      shouldShow: fee.show_fee_calculation,
      feeDescription: fee.description,
      paymentMethod: paymentMethod,
    };
  };

  /**
   * Obtiene la configuración de fee para un método de pago
   */
  const getFeeForMethod = (paymentMethod: string): PaymentFee | null => {
    return fees.find(f => f.payment_method === paymentMethod && f.is_active) || null;
  };

  return {
    fees,
    loading,
    error,
    feesEnabled,
    calculateFeeForMethod,
    getFeeForMethod,
    refetch: fetchFees,
  };
}
