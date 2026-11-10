"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { decodeJWT, clearAuthToken, setAuthToken } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import type { User, Company } from "@/lib/types";

export function CompanySwitcher() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>("");
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      if (pathname !== "/admin/login") {
        clearAuthToken();
        localStorage.removeItem("active_company_id");
        router.push("/admin/login");
      }
      setChecking(false);
      return;
    }

    const decoded = decodeJWT(token);
    if (!decoded) {
      if (pathname !== "/admin/login") {
        clearAuthToken();
        localStorage.removeItem("active_company_id");
        router.push("/admin/login");
      }
      setChecking(false);
      return;
    }

    setCompanies(decoded.user_companies || []);
    const storedCompanyId = localStorage.getItem("active_company_id");
    if (storedCompanyId) {
      setActiveCompanyId(storedCompanyId);
    } else if (decoded.active_company_id) {
      setActiveCompanyId(decoded.active_company_id);
      localStorage.setItem("active_company_id", decoded.active_company_id);
    } else {
      setActiveCompanyId("");
    }
    setChecking(false);
  }, [router, pathname]);

  const handleCompanyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const previousId = activeCompanyId;
    setActiveCompanyId(selectedId);
    try {
      const response = await apiClient.selectCompany({ company_id: selectedId });
      localStorage.setItem("active_company_id", selectedId);
      setAuthToken(response.access_token);
      window.location.reload();
    } catch (error) {
      console.error("No se pudo cambiar la empresa activa:", error);
      setActiveCompanyId(previousId);
    }
  };

  if (checking) return null;
  if (!companies || companies.length === 0) return null;

  return (
    <label className="flex items-center gap-2" title="Empresa activa">
      <span className="sr-only">Empresa activa</span>
      <Building2 className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
      <select
        value={activeCompanyId || ""}
        onChange={handleCompanyChange}
        className="h-9 max-w-[6.5rem] truncate rounded-md border border-input bg-card pl-2.5 pr-7 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-[14rem]"
      >
        <option value="" disabled>
          Seleccione la empresa
        </option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </label>
  );
}
