'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Check } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { setAuthToken } from '@/lib/auth'
import { useRouter } from 'next/navigation'

interface Company {
  id: string
  name: string
  description?: string
  logo_url?: string
  is_active?: boolean
}

interface CompanySelectionModalProps {
  isOpen: boolean
  onClose: () => void
  companies: Company[]
  onCompanySelected: (company: Company) => void
}

export function CompanySelectionModal({
  isOpen,
  onClose,
  companies,
  onCompanySelected
}: CompanySelectionModalProps) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  

  const handleCompanySelect = async () => {
    if (!selectedCompany) return

    setIsLoading(true)
    try {
      const response = await apiClient.selectCompany({ company_id: selectedCompany.id })
      if (response.access_token) {
        // Fijar la empresa activa antes de notificar el cambio de token para que
        // CompanyContext seleccione la empresa correcta (el switcher ya lo hace).
        localStorage.setItem('active_company_id', selectedCompany.id)
        setAuthToken(response.access_token)
        onCompanySelected(selectedCompany)
        onClose()
        router.push('/admin')
      }
    } catch (error) {
      console.error('Error selecting company:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Seleccionar Empresa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tienes acceso a múltiples empresas. Selecciona cuál quieres administrar en esta sesión.
          </p>

          <div className="space-y-2">
            {companies.map((company) => (
              <Card
                key={company.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedCompany?.id === company.id
                    ? 'ring-2 ring-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedCompany(company)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {company.logo_url ? (
                        <img
                          src={company.logo_url}
                          alt={`Logo de ${company.name}`}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                      )}

                      <div>
                        <h3 className="font-medium">{company.name}</h3>
                        {company.description && (
                          <p className="text-sm text-muted-foreground">
                            {company.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={company.is_active ? 'default' : 'secondary'}>
                        {company.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                      {selectedCompany?.id === company.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleCompanySelect}
              disabled={!selectedCompany || isLoading}
              className="flex-1"
            >
              {isLoading ? 'Seleccionando...' : 'Continuar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
