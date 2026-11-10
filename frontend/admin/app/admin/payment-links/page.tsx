'use client';

import { SeccionTabs } from "@/components/admin/SeccionTabs"
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PaymentLinksDashboard from '@/components/admin/payment-links-dashboard';
import PaymentLinksReport from '@/components/admin/payment-links-report';
import { AdminLayout } from '@/components/admin/admin-layout';
import { PaymentLinksSettingsDialog } from '@/components/admin/payment-links-settings-dialog';
import { EstadoProveedores } from '@/components/payment/EstadoProveedores';

export default function PaymentLinksPage() {
  const [tab, setTab] = useState('enlaces');
  const [createOpen, setCreateOpen] = useState(false);

  // El diálogo de crear vive en la pestaña de enlaces: desde Reportes hay que volver a ella.
  const abrirCrear = () => {
    setTab('enlaces');
    setCreateOpen(true);
  };

  return (
    <AdminLayout title="Ventas">
      <div className="space-y-5">
        <SeccionTabs seccion="ventas" />
        <EstadoProveedores />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Enlaces de pago para enviar a los clientes y conciliación de lo cobrado.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {/* Solo visible para admin/super_admin — el backend es quien lo hace cumplir de verdad. */}
            <PaymentLinksSettingsDialog />
            <Button onClick={abrirCrear} className="w-fit">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Crear link de pago
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="enlaces">Enlaces</TabsTrigger>
            <TabsTrigger value="reportes">Reportes y conciliación</TabsTrigger>
          </TabsList>

          <TabsContent value="enlaces">
            <PaymentLinksDashboard createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
          </TabsContent>

          <TabsContent value="reportes">
            <PaymentLinksReport />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
