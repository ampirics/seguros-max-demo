import type { Metadata } from "next"
import type React from "react"
import { Inter } from "next/font/google"
import "../globals.css"
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { MARCA_BASE } from "@/lib/marca"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: `Pago seguro · ${MARCA_BASE.nombre}`,
  description: `Página de pago seguro de ${MARCA_BASE.nombre}`,
}

export default function PayLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          {children}
        </div>
        <ToastContainer position="top-right" autoClose={3000} />
      </body>
    </html>
  )
}