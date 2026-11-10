"use client"

import { useGlobalSoftphone } from "@/contexts/softphone-context"
import { IncomingCallCard } from "@/components/admin/pbx/incoming-call-card"
import { useRouter, usePathname } from "next/navigation"

export function GlobalIncomingCall() {
  const softphone = useGlobalSoftphone()
  const router = useRouter()
  const pathname = usePathname()

  // Si ya estamos en el chat, el chat maneja su propia tarjeta/panel
  if (pathname === "/admin/chat") return null

  return (
    <IncomingCallCard
      softphone={softphone}
      onOpenPhone={() => router.push("/admin/chat")}
    />
  )
}
