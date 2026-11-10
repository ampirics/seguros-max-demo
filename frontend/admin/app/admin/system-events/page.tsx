"use client";

import { AdminLayout } from "@/components/admin/admin-layout";
import { SystemEventsPanel } from "@/components/admin/system-events-panel";

export default function SystemEventsPage() {
  return (
    <AdminLayout title="Eventos del sistema">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Eventos de integración</h1>
          <p className="text-gray-500">
            Trabajos pendientes con bancos, SAP y WhatsApp: qué se reintenta, qué se agotó y qué hacer con ello.
          </p>
        </div>
        <SystemEventsPanel />
      </div>
    </AdminLayout>
  );
}
