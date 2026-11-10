"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ArrowLeft, X } from "lucide-react"
import { ContextoDetalle, type Detalle } from "./contexto"
import { DetalleCierre, DetalleMovimiento } from "./DetalleCaja"
import { DetalleCompra } from "./DetalleCompra"
import { DetalleGasto } from "./DetalleGasto"
import { DetalleInsumo } from "./DetalleInsumo"
import { DetalleProveedor } from "./DetalleProveedor"
import { DetalleVisita } from "./DetalleVisita"

const NOMBRE: Record<Detalle["tipo"], string> = {
  visita: "la visita",
  insumo: "el insumo",
  compra: "la orden",
  proveedor: "el proveedor",
  gasto: "el gasto",
  cierre: "el cierre",
  movimiento: "el movimiento",
}

function Contenido({ d }: { d: Detalle }) {
  switch (d.tipo) {
    case "visita":
      return <DetalleVisita id={d.id} />
    case "insumo":
      return <DetalleInsumo id={d.id} />
    case "compra":
      return <DetalleCompra id={d.id} />
    case "proveedor":
      return <DetalleProveedor id={d.id} />
    case "gasto":
      return <DetalleGasto id={d.id} gasto={d.gasto} buscar={d.buscar} />
    case "cierre":
      return <DetalleCierre caja={d.caja} />
    case "movimiento":
      return <DetalleMovimiento m={d.movimiento} />
  }
}

export function Detalles({ children }: { children: React.ReactNode }) {
  const [pila, setPila] = useState<Detalle[]>([])
  const llave = useRef(0)
  const [llaves, setLlaves] = useState<number[]>([])
  const cuerpo = useRef<HTMLDivElement>(null)

  const abrir = useCallback((d: Detalle) => {
    llave.current += 1
    const k = llave.current
    setPila((p) => [...p, d])
    setLlaves((l) => [...l, k])
    cuerpo.current?.scrollTo({ top: 0 })
  }, [])
  const cerrar = useCallback(() => {
    setPila([])
    setLlaves([])
  }, [])
  const atras = () => {
    setPila((p) => p.slice(0, -1))
    setLlaves((l) => l.slice(0, -1))
  }
  const valor = useMemo(() => ({ abrir, cerrar }), [abrir, cerrar])
  const actual = pila.at(-1)
  const anterior = pila.at(-2)

  return (
    <ContextoDetalle.Provider value={valor}>
      {children}
      <DialogPrimitive.Root open={!!actual} onOpenChange={(o) => !o && cerrar()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l bg-background shadow-xl data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right sm:max-w-xl"
          >
            <DialogPrimitive.Title className="sr-only">{actual ? `Detalle de ${NOMBRE[actual.tipo]}` : "Detalle"}</DialogPrimitive.Title>
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-2">
              {anterior ? (
                <button type="button" onClick={atras} className="inline-flex h-11 min-w-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium hover:bg-secondary">
                  <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">Volver a {NOMBRE[anterior.tipo]}</span>
                </button>
              ) : (
                <span />
              )}
              <DialogPrimitive.Close className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-secondary" aria-label="Cerrar">
                <X className="h-5 w-5" aria-hidden />
              </DialogPrimitive.Close>
            </div>
            <div ref={cuerpo} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-10 pt-4 sm:px-6">
              {actual && <Contenido key={llaves.at(-1)} d={actual} />}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ContextoDetalle.Provider>
  )
}
