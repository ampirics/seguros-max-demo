import { useCallback, useEffect, useRef, useState } from "react";
import type { StoreConfig } from "@/lib/store-config-types";
import type { ApiResponse } from "@/lib/api-types";
import apiClient from "@/lib/api-client";
import { useCompany } from "@/contexts/company-context";

interface UseStoreConfigResult {
  config: StoreConfig | null;
  /** Solo la carga inicial (guardar ya no desmonta el formulario). */
  loading: boolean;
  saving: boolean;
  /** Error al cargar (la pantalla no puede mostrarse). */
  error: string | null;
  /** Error al guardar: los cambios siguen en pantalla. */
  saveError: string | null;
  saveConfig: (newConfig: StoreConfig) => Promise<boolean>;
  resetConfig: () => void;
  reload: () => void;
  isDirty: boolean;
  /** Empresa de la que se cargó la config: solo se guarda en esa. */
  loadedCompanyId: string | null;
  setError: (err: string | null) => void;
}

/**
 * Config de la tienda de la empresa activa.
 *
 * Incidente A↔B: al cambiar de empresa la pantalla conservaba la config de la
 * anterior (o una respuesta vieja llegaba tarde) mientras el guardado ya
 * apuntaba a la nueva. Ahora: se vacía al cambiar, se ignoran respuestas
 * viejas, se guarda solo en la empresa de la que se cargó, y se manda la
 * versión (_version) para que el backend rechace pisar cambios ajenos.
 */
export function useStoreConfig(): UseStoreConfigResult {
  let activeCompany = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const companyCtx = useCompany();
    activeCompany = companyCtx?.activeCompany;
  } catch {
    // Fuera de CompanyProvider no hay empresa activa fiable.
  }
  const companyId: string | undefined = activeCompany?.id || undefined;

  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [original, setOriginal] = useState<StoreConfig | null>(null);
  const [loadedCompanyId, setLoadedCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestSeq = useRef(0);

  useEffect(() => {
    const seq = ++requestSeq.current;
    setConfig(null);
    setOriginal(null);
    setLoadedCompanyId(null);
    setError(null);
    setSaveError(null);
    if (!companyId) {
      setLoading(false);
      setError("Selecciona una empresa para editar su tienda.");
      return;
    }
    setLoading(true);
    apiClient.getStoreConfig(companyId, true, true)
      .then((data: ApiResponse<StoreConfig>) => {
        if (seq !== requestSeq.current) return;
        if (data.success && data.data) {
          setConfig(data.data);
          setOriginal(data.data);
          setLoadedCompanyId(companyId);
        } else {
          setError(data.error || "Error al cargar configuración");
        }
      })
      .catch((e: any) => {
        if (seq !== requestSeq.current) return;
        setError(e?.message || "Error de red al cargar configuración");
      })
      .finally(() => { if (seq === requestSeq.current) setLoading(false); });
  }, [companyId, reloadKey]);

  const isDirty = JSON.stringify(config) !== JSON.stringify(original);

  const saveConfig = useCallback(async (newConfig: StoreConfig) => {
    setSaveError(null);
    if (!loadedCompanyId || loadedCompanyId !== companyId) {
      setSaveError("La empresa activa cambió desde que cargaste esta configuración. Recarga antes de guardar.");
      return false;
    }
    setSaving(true);
    try {
      await apiClient.updateStoreConfig(newConfig, loadedCompanyId);
      // Se relee para tener la versión nueva (_version) y lo guardado de verdad.
      const fresh = await apiClient.getStoreConfig(loadedCompanyId, true, true);
      if (fresh.success && fresh.data) {
        setConfig(fresh.data);
        setOriginal(fresh.data);
      }
      return true;
    } catch (e: any) {
      setSaveError(e?.message || "Error al guardar configuración");
      return false;
    } finally {
      setSaving(false);
    }
  }, [companyId, loadedCompanyId]);

  const resetConfig = useCallback(() => {
    setConfig(original);
  }, [original]);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  return { config, loading, saving, error, saveError, saveConfig, resetConfig, reload, isDirty, loadedCompanyId, setError };
}
