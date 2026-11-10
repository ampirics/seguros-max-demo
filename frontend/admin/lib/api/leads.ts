import type { Lead } from '@/lib/api-types'
import { estadoCita } from './agenda'

type LeadApi = Omit<Lead, 'citas'> & { citas?: (Omit<NonNullable<Lead['citas']>[number], 'estado'> & { estado: string })[] }

export const aLead = (l: LeadApi): Lead => ({
  ...l,
  conversacion_id: l.conversacion_id ?? l.id,
  interes: l.interes ?? null,
  vehiculo: l.vehiculo ?? null,
  sla_vence: l.sla_vence ?? null,
  actualizado: l.actualizado ?? l.creado,
  citas: (l.citas ?? []).map((c) => ({ ...c, estado: estadoCita(c.estado) })),
})
