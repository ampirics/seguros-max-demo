import type { Metadata } from "next"
import "../globals.css"
import { AdminProvider } from "@/contexts/admin-context"
import { CompanyProvider } from "@/contexts/company-context"
import { CartProvider } from "@/contexts/cart-context"
import { AgentNotificationsProvider } from "@/contexts/agent-notifications-context"
import { SoftphoneProvider } from "@/contexts/softphone-context"
import { AuthGuard } from "@/components/auth-guard"
import { GlobalIncomingCall } from "@/components/admin/pbx/global-incoming-call"
import { Avisos } from "@/components/admin/notificaciones/Avisos"
import { MARCA_BASE } from "@/lib/marca"

export const metadata: Metadata = {
  title: `${MARCA_BASE.nombre} · Panel`,
  description: "Panel de administración",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminProvider>
      <CompanyProvider>
        <AgentNotificationsProvider>
          <CartProvider>
            <SoftphoneProvider>
              <AuthGuard
                requireAuth={true}
                redirectTo="/admin/login"
                excludePaths={['/admin/login', '/admin/auth']}
              >
                {children}
                <GlobalIncomingCall />
              </AuthGuard>
              <Avisos />
            </SoftphoneProvider>
          </CartProvider>
        </AgentNotificationsProvider>
      </CompanyProvider>
    </AdminProvider>
  )
}
