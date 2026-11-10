"use client"

import { useEffect, useState } from "react"

export default function CartelEntrada() {
  const [url, setUrl] = useState("")
  useEffect(() => {
    fetch("/srv/restaurante/publico")
      .then((r) => r.json())
      .then((j: { url: string }) => setUrl(`${j.url}/llegue`))
      .catch(() => undefined)
  }, [])
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#E9DFCF] p-6 print:bg-white print:p-0">
      <article className="flex w-full max-w-[560px] flex-col items-center gap-6 rounded-[28px] bg-[#0B2A2E] px-10 py-12 text-center text-[#F4ECDF] shadow-2xl print:max-w-none print:rounded-none print:shadow-none">
        <div className="flex items-center gap-3">
          <img src="/marca/logo-boca-marina.png" alt="" className="h-12 w-12 rounded-md" />
          <div className="text-left">
            <div className="font-display text-3xl leading-none">Boca Marina</div>
            <div className="text-[10px] tracking-[0.35em] text-[#7FCFCB]">RESTAURANT &amp; LOUNGE</div>
          </div>
        </div>
        <h1 className="font-display text-5xl leading-tight">¿Llegaste?</h1>
        <p className="max-w-sm text-lg leading-relaxed text-[#F4ECDF]/85">Escanea con tu teléfono y avisamos a la anfitriona. Con reserva o sin ella.</p>
        <div className="rounded-3xl bg-white p-5">
          <img src="/srv/restaurante/qr?ruta=/llegue&ancho=900" alt="Código QR para avisar que llegaste" className="h-72 w-72" />
        </div>
        <p className="text-sm tracking-wide text-[#7FCFCB]">Abre la cámara y apunta al código</p>
        {url && <p className="break-all font-mono text-xs text-[#F4ECDF]/50">{url}</p>}
      </article>
    </div>
  )
}
