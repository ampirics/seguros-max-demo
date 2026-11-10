"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { ThemeProvider } from "next-themes"
import { apiClient } from "@/lib/api-client"
import { CLAVE_MARCA, MARCA_BASE, aplicarMarca, temaPorDefecto, type Marca } from "@/lib/marca"

interface MarcaContextValue {
  marca: Marca
  guardar: (m: Marca) => Promise<void>
}

const MarcaContext = createContext<MarcaContextValue>({ marca: MARCA_BASE, guardar: async () => {} })

const leerCache = (): Marca | null => {
  try {
    const m = JSON.parse(localStorage.getItem(CLAVE_MARCA) || "null")
    return m ? { ...MARCA_BASE, ...m } : null
  } catch {
    return null
  }
}

export function MarcaProvider({ children }: { children: ReactNode }) {
  const [marca, setMarca] = useState<Marca>(MARCA_BASE)

  const usar = useCallback((m: Marca) => {
    setMarca(m)
    aplicarMarca(m)
    localStorage.setItem(CLAVE_MARCA, JSON.stringify(m))
  }, [])

  useEffect(() => {
    const cache = leerCache()
    if (cache) setMarca(cache)
    apiClient
      .get<Partial<Marca>>("/marca")
      .then((m) => usar({ ...MARCA_BASE, ...m }))
      .catch(() => {})
  }, [usar])

  useEffect(() => {
    document.title = document.title.replace(/^[^·]*·/, `${marca.nombre} ·`)
  }, [marca.nombre])

  const guardar = useCallback(
    async (m: Marca) => {
      usar({ ...MARCA_BASE, ...(await apiClient.put<Partial<Marca>>("/marca", m)) })
    },
    [usar]
  )

  return (
    <MarcaContext.Provider value={{ marca, guardar }}>
      <ThemeProvider attribute="class" defaultTheme={temaPorDefecto(marca)} enableSystem={false} disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </MarcaContext.Provider>
  )
}

export const useMarca = () => useContext(MarcaContext)
