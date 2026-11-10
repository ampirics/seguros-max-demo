"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAdmin } from "@/contexts/admin-context"
import { AdminLayout } from "@/components/admin/admin-layout"
import { UserFormEnhanced } from "@/components/admin/user-form-enhanced"
import { createUser } from "@/lib/auth"
import type { UserCreate } from "@/lib/types"
import { Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "react-toastify"

export default function NewUserPage() {
  const { user, isLoading } = useAdmin()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<UserCreate>({
    email: "",
    password: "",
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const isNewUser = true

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/admin/login")
    }
  }, [user, isLoading, router])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.email || !formData.email.trim()) {
      errors.email = "El correo electrónico es obligatorio"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "El formato del correo electrónico no es válido"
    }

    if (isNewUser && (!formData.password || formData.password.length < 8)) {
      errors.password = "La contraseña debe tener al menos 8 caracteres"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (userData: any) => {
    // Validación extra si lo deseas aquí
    setSaving(true)
    try {
      if (isNewUser) {
        const result: any = await createUser(userData)
        toast.success("Usuario creado con éxito")
        // Con contraseña temporal, el formulario muestra el diálogo para
        // copiarla/descargarla; antes se redirigía y se perdía para siempre.
        if (result?.temporary_password) return result
      } else {
        toast.success("Usuario actualizado con éxito")
      }
      router.push("/admin/users")
    } catch (error: any) {
      toast.error(error.message || "Error al guardar el usuario")
      console.error("Error saving user:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    router.push("/admin/users")
  }

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>
  }

  if (!user) {
    return null
  }

  // hasPermission era async y siempre true: la comprobación nunca bloqueaba.
  // Crear usuarios exige admin en el backend.
  if (!["admin", "super_admin"].includes(String((user as any)?.role))) {
    return (
      <AdminLayout title="Acceso Denegado">
        <div className="text-center py-12">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Acceso Denegado</h2>
          <p className="text-gray-600 mb-4">No tienes permisos para crear usuarios</p>
          <Button onClick={() => router.push("/admin/users")} className="bg-primary hover:bg-primary/90 text-white">
            Volver a Usuarios
          </Button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Crear Nuevo Usuario">
      <div className="max-w-4xl mx-auto">
        <UserFormEnhanced 
          currentUser={user} 
          onSubmitAction={handleSubmit} 
          onCancelAction={handleCancel} 
          isLoading={saving} 
        />
      </div>
    </AdminLayout>
  )
}
