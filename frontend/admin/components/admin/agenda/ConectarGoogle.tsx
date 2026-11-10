"use client"

import { useEffect, useState } from "react"
import { CalendarCheck, Loader2 } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"

type Estado = { conectado: boolean; con_google?: boolean; modo: "fake" | "google"; calendar_id: string | null }

export function ConectarGoogle() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    apiClient.get<Estado>("/agenda/google/estado").then(setEstado).catch(() => {})
    const r = new URLSearchParams(window.location.search).get("google")
    if (r === "conectado") toast.success("Google Calendar conectado")
    else if (r === "cancelado") toast.error("No se conectó Google Calendar")
    else if (r === "error") toast.error("Google no aceptó la conexión. Vuelve a intentarlo.")
  }, [])

  if (!estado || estado.modo !== "google") return null
  const listo = !!estado.con_google

  const conectar = async () => {
    setOcupado(true)
    try {
      const r = await apiClient.post<{ url: string | null }>("/agenda/google/conectar", {})
      if (r.url) window.location.href = r.url
      else setEstado(await apiClient.get<Estado>("/agenda/google/estado"))
    } catch (e: any) {
      toast.error(e?.message || "No se pudo conectar Google Calendar")
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Button variant={listo ? "outline" : "default"} className="h-9 gap-2" onClick={conectar} disabled={ocupado}
      title={listo ? `Las citas se crean en ${estado.calendar_id ?? "tu calendario"} y Google invita al cliente` : "Conecta tu cuenta de Google para que las citas lleguen a tu calendario y al del cliente"}>
      {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CalendarCheck className="h-4 w-4" aria-hidden />}
      {listo ? "Google conectado" : "Conectar Google Calendar"}
    </Button>
  )
}
