"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAdmin } from "@/contexts/admin-context"
import { AdminLayout } from "@/components/admin/admin-layout"
import { UserFormEnhanced } from "@/components/admin/user-form-enhanced"
import { apiClient } from "@/lib/api-client"
import { Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "react-toastify"
import type { User } from "@/lib/types"

interface Company {
  id: string
  name: string
}

export default function EditUserPage() {
  const { user: currentUser, isLoading } = useAdmin()
  const router = useRouter()
  const params = useParams()
  const userId = (params?.id ?? '') as string
  
  const [user, setUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<Company[]>([])
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.push("/admin/login")
    }
  }, [currentUser, isLoading, router])

  useEffect(() => {
    if (userId && typeof userId === 'string' && userId !== 'undefined') {
      loadUser()
      loadCompanies()
    }
  }, [userId])

  const loadUser = async () => {
    try {
      setLoading(true)
      const userData = await apiClient.getUser(userId)
      setUser(userData)
    } catch (error: any) {
      console.error('Error loading user:', error)
      toast.error("Usuario no encontrado")
      router.push("/admin/users")
    } finally {
      setLoading(false)
    }
  }

  const loadCompanies = async () => {
    try {
      const data = await apiClient.getCompanies()
      setCompanies(data)
    } catch (error) {
      console.error('Error loading companies:', error)
    }
  }

  const validateForm = (formData: Omit<User, "id" | "createdAt" | "permissions">): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.name || !formData.name.trim()) {
      errors.name = "El nombre es obligatorio"
    }

    if (!formData.email || !formData.email.trim()) {
      errors.email = "El correo electrónico es obligatorio"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "El formato del correo electrónico no es válido"
    }

    // TODO: Validación de company_ids cuando se implemente la relación multi-empresa
    // if (formData.role === 'admin' && (!formData.company_ids || formData.company_ids.length === 0)) {
    //   errors.company_ids = "Debe seleccionar al menos una empresa para el administrador"
    // }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (formData: Omit<User, "id" | "createdAt" | "permissions">) => {
    if (!validateForm(formData)) {
      return
    }

    setSaving(true)

    try {
      await apiClient.updateUser(userId, formData)
      toast.success("Usuario actualizado con éxito")
      router.push("/admin/users")
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar el usuario")
      console.error("Error updating user:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    router.push("/admin/users")
  }

  if (isLoading || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>
  }

  if (!currentUser) {
    return null
  }

  // Admin edita a otros; cualquiera puede editar su propio perfil.
  if (!["admin", "super_admin"].includes(String((currentUser as any)?.role)) && String((currentUser as any)?.id) !== String(params?.id)) {
    return (
      <AdminLayout title="Acceso Denegado">
        <div className="text-center py-12">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Acceso Denegado</h2>
          <p className="text-gray-600 mb-4">No tienes permisos para editar usuarios</p>
          <Button onClick={() => router.push("/admin/users")} className="bg-primary hover:bg-primary/90 text-white">
            Volver a Usuarios
          </Button>
        </div>
      </AdminLayout>
    )
  }

  if (!user) {
    return (
      <AdminLayout title="Usuario No Encontrado">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Usuario No Encontrado</h2>
          <p className="text-gray-600 mb-4">El usuario solicitado no existe o ha sido eliminado</p>
          <Button onClick={() => router.push("/admin/users")} className="bg-primary hover:bg-primary/90 text-white">
            Volver a Usuarios
          </Button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title={`Editar Usuario: ${user.name}`}>
      <div className="max-w-4xl mx-auto">
        <UserFormEnhanced 
          user={user}
          currentUser={currentUser}
          onSubmitAction={handleSubmit} 
          onCancelAction={handleCancel} 
          isLoading={saving}
        />
      </div>
    </AdminLayout>
  )
}
