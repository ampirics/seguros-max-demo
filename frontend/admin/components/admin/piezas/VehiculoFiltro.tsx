'use client'

import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiClient } from '@/lib/api-client'
import type { VehiculoCatalogo } from '@/lib/api-types'

export interface FiltroVehiculo {
  marca: string | null
  modelo: string | null
  anio: number | null
}

const TODOS = 'todos'

// ?marca=&modelo=&anio= en la URL (enlaces desde la ficha del vehículo).
export function filtroDeUrl(): FiltroVehiculo | null {
  const p = new URLSearchParams(window.location.search)
  const marca = p.get('marca')
  return marca ? { marca, modelo: p.get('modelo'), anio: p.get('anio') ? Number(p.get('anio')) : null } : null
}

export function VehiculoFiltro({ value, onChange }: { value: FiltroVehiculo; onChange: (v: FiltroVehiculo) => void }) {
  const [vehiculos, setVehiculos] = useState<VehiculoCatalogo[]>([])
  useEffect(() => {
    apiClient.get<VehiculoCatalogo[]>('/piezas/vehiculos').then(setVehiculos).catch(() => setVehiculos([]))
  }, [])

  const marcas = [...new Set(vehiculos.map((v) => v.marca))]
  const modelos = vehiculos.filter((v) => v.marca === value.marca)
  const rango = modelos.find((v) => v.modelo === value.modelo)
  const anios = rango ? Array.from({ length: rango.hasta - rango.desde + 1 }, (_, i) => rango.hasta - i) : []

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Select value={value.marca ?? TODOS} onValueChange={(v) => onChange({ marca: v === TODOS ? null : v, modelo: null, anio: null })}>
        <SelectTrigger aria-label="Marca del vehículo" className="bg-card"><SelectValue placeholder="Marca" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todas las marcas</SelectItem>
          {marcas.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={value.modelo ?? TODOS} disabled={!value.marca} onValueChange={(v) => onChange({ ...value, modelo: v === TODOS ? null : v, anio: null })}>
        <SelectTrigger aria-label="Modelo" className="bg-card"><SelectValue placeholder="Modelo" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los modelos</SelectItem>
          {modelos.map((m) => <SelectItem key={m.modelo} value={m.modelo}>{m.modelo}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={value.anio ? String(value.anio) : TODOS} disabled={!value.modelo} onValueChange={(v) => onChange({ ...value, anio: v === TODOS ? null : Number(v) })}>
        <SelectTrigger aria-label="Año" className="bg-card"><SelectValue placeholder="Año" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los años</SelectItem>
          {anios.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
