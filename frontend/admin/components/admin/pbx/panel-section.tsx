"use client"

import { ReactNode, useState } from "react"
import { ChevronDown } from "lucide-react"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface PanelSectionProps {
  title: string
  icon?: ReactNode
  badge?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

/** Sección plegable por título dentro de un panel lateral del chat. */
export function PanelSection({ title, icon, badge, defaultOpen = false, children }: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b last:border-b-0">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-1 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
        {icon}
        <span className="flex-1 truncate">{title}</span>
        {badge}
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-3">{children}</CollapsibleContent>
    </Collapsible>
  )
}

/** Estado vacío para las secciones que dependen del servicio de telefonía. */
export function ServicePendingState({ description }: { description: string }) {
  return (
    <div className="rounded-md border border-dashed px-3 py-4 text-center">
      <p className="text-xs font-medium text-foreground">Requiere el servicio de telefonía</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>
    </div>
  )
}
