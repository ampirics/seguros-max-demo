import MockInstaller from "@/mocks/mock-installer"
import type React from "react"
import { CompanyProvider } from "@/contexts/company-context";
import { CartProvider } from "@/contexts/cart-context";
import type { Metadata } from "next"
import { Cormorant_Garamond, Geist, Geist_Mono, Jost, League_Spartan, Lexend, Roboto } from "next/font/google"
import { MarcaProvider } from "@/contexts/marca-context"
import { MARCA_BASE, SCRIPT_MARCA } from "@/lib/marca"
import "./globals.css"
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';
import Script from 'next/script'

// Expuestas como variables CSS; frontend/tema las asigna a --font-sans / --font-display / --font-mono
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" })
const lexend = Lexend({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-lexend", display: "swap" })
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap" })
const jost = Jost({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-jost", display: "swap" })
const spartan = League_Spartan({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-spartan", display: "swap" })
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto", display: "swap" })

export const metadata: Metadata = {
  title: MARCA_BASE.nombre,
  description: "CRM y asistente de IA para corredores de seguros",
  icons: { icon: MARCA_BASE.logo },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} ${lexend.variable} ${cormorant.variable} ${jost.variable} ${spartan.variable} ${roboto.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_MARCA }} />
      </head>
      <body>
        <MockInstaller />
        {/* Google Analytics 4 - gtag.js */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-DRQDBR5JSL"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);} 
          gtag('js', new Date());
          gtag('config', 'G-DRQDBR5JSL');`}
        </Script>
        <MarcaProvider>
          <CompanyProvider>
            <CartProvider>
              {children}
            </CartProvider>
          </CompanyProvider>
          <ToastContainer position="top-right" autoClose={3000} theme="colored" />
        </MarcaProvider>
      </body>
    </html>
  )
}
