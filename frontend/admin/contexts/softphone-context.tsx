"use client"

import React, { createContext, useContext, ReactNode } from "react"
import { useSoftphone as useSoftphoneHook } from "@/hooks/use-softphone"
import type { Softphone } from "@/components/admin/pbx/softphone-panel"

const SoftphoneContext = createContext<Softphone | null>(null)

export function SoftphoneProvider({ children }: { children: ReactNode }) {
  const softphone = useSoftphoneHook()

  return (
    <SoftphoneContext.Provider value={softphone}>
      {children}
      <audio ref={softphone.remoteAudioRef} autoPlay />
    </SoftphoneContext.Provider>
  )
}

export function useGlobalSoftphone() {
  const context = useContext(SoftphoneContext)
  if (!context) {
    throw new Error("useGlobalSoftphone must be used within a SoftphoneProvider")
  }
  return context
}
