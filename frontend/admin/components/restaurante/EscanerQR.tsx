"use client"

import { useEffect, useRef, useState } from "react"
import jsQR from "jsqr"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/** Cámara del dispositivo que lee un código QR y devuelve su texto. Necesita https o localhost. */
export function EscanerQR({ abierto, onCerrar, onLeido }: { abierto: boolean; onCerrar: () => void; onLeido: (texto: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState("")
  const leido = useRef(onLeido)
  leido.current = onLeido

  useEffect(() => {
    if (!abierto) return
    let flujo: MediaStream | null = null
    let cuadro = 0
    let vivo = true
    setError("")
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        if (!vivo) return s.getTracks().forEach((t) => t.stop())
        flujo = s
        const v = video.current!
        v.srcObject = s
        void v.play()
        const leer = () => {
          if (!vivo) return
          const c = lienzo.current
          if (c && v.readyState >= 2 && v.videoWidth) {
            c.width = v.videoWidth
            c.height = v.videoHeight
            const ctx = c.getContext("2d", { willReadFrequently: true })!
            ctx.drawImage(v, 0, 0)
            const img = ctx.getImageData(0, 0, c.width, c.height)
            const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })
            if (qr?.data) {
              vivo = false
              leido.current(qr.data)
              return
            }
          }
          cuadro = requestAnimationFrame(leer)
        }
        cuadro = requestAnimationFrame(leer)
      })
      .catch(() => setError("No pudimos abrir la cámara. Revisa el permiso del navegador."))
    if (!navigator.mediaDevices) setError("Este navegador no deja usar la cámara aquí (hace falta https).")
    return () => {
      vivo = false
      cancelAnimationFrame(cuadro)
      flujo?.getTracks().forEach((t) => t.stop())
    }
  }, [abierto])

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Escanear la reserva</DialogTitle>
          <DialogDescription>Apunta al QR del PDF de la reserva o de la página del cliente.</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="rounded-xl bg-destructive-soft p-4 text-sm text-destructive">{error}</p>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video ref={video} playsInline muted className="aspect-square w-full object-cover" />
            <div className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
        <canvas ref={lienzo} className="hidden" />
      </DialogContent>
    </Dialog>
  )
}
