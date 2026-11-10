"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUsers } from "@/lib/admin-users";
import apiClient from "@/lib/api-client";
import { useActiveCompany } from "@/contexts/company-context";
import type { User } from "@/lib/types";
import { useAdmin } from "@/contexts/admin-context";
import { AdminLayout } from "@/components/admin/admin-layout";
import { EquipoAccesos } from "@/components/restaurante/EquipoAccesos";
import { useVertical } from "@/lib/vertical";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Search,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  UserCheck,
  UserX,
  Key,
  Copy,
  Loader2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "react-toastify";


const PAGE_SIZE = 20;

const initials = (nombre?: string | null) =>
  (nombre || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

export default function PaginaUsuarios() {
  const restaurante = useVertical() === "restaurante"
  if (restaurante)
    return (
      <AdminLayout title="Usuarios">
        <EquipoAccesos />
      </AdminLayout>
    )
  return <AdminUsersPage />
}

function AdminUsersPage() {
  const { user, isLoading } = useAdmin();
  const activeCompany = useActiveCompany();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Estados para modales
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPasswordData, setNewPasswordData] = useState<{
    userName: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/admin/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    const loadUsers = async () => {
      if (!user) return;

      // Verificar si el usuario tiene permiso para ver usuarios
      const canViewUsers = user.role === 'super_admin' || user.role === 'admin' ||
        (user.permissions?.users?.view === true);

      if (!canViewUsers) {
        setError("No tienes permisos para ver usuarios.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        let data = [];

        if (activeCompany?.id) {
          // La empresa activa manda también para super_admin.
          data = await apiClient.getUsersByCompany(activeCompany.id);
        } else if (user.role === 'super_admin') {
          // Sin empresa seleccionada, super_admin conserva la vista global.
          data = await getUsers(currentPage, PAGE_SIZE);
        } else {
          setError("Debe seleccionar una empresa para ver usuarios");
          return;
        }

        // Si el usuario actual NO es super_admin, eliminar usuarios super_admin del array
        if (user.role !== 'super_admin') {
          data = Array.isArray(data) ? data.filter(u => u.role !== 'super_admin') : data;
        }

        const allData = data || [];
        setUsers(allData);

        // Para super_admin con paginación server-side, estimamos el total
        if (user.role === 'super_admin' && !activeCompany?.id) {
          if (allData.length === PAGE_SIZE) {
            setTotalUsers((currentPage - 1) * PAGE_SIZE + allData.length + 1);
          } else {
            setTotalUsers((currentPage - 1) * PAGE_SIZE + allData.length);
          }
        } else {
          setTotalUsers(allData.length);
        }
      } catch (error: any) {
        console.error("❌ Error al cargar usuarios:", error);
        // Mostrar el mensaje del error (puede ser "No tienes permisos..." del backend)
        setError(error?.message || "No se pudieron cargar los usuarios");
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [user, activeCompany?.id, currentPage]);

  // Al cambiar el término de búsqueda, resetear a la página 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (Array.isArray(users)) {
      let filtered = users;
      // Si el usuario actual NO es super_admin, ocultar usuarios super_admin
      if (user?.role !== "super_admin") {
        filtered = filtered.filter(u => u.role !== "super_admin");
      }
      filtered = filtered.filter(
        (u) =>
          (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
          (u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers([]);
    }
  }, [searchTerm, users]);

  // Solo en memoria: antes la lista (datos personales) se guardaba en localStorage.
  const saveUsersToLocal = (updatedUsers: User[]) => {
    setUsers(updatedUsers);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (
      !confirm(
        `¿Dar de baja a "${userName}"?\n\nSe le quitará el acceso a tu empresa y se cerrarán sus sesiones. ` +
        `Sus conversaciones y órdenes se conservan.`
      )
    ) {
      return;
    }

    try {
      setActionLoading(userId);
      const res: any = await apiClient.deleteUser(userId);

      // Actualizar localmente
      const updatedUsers = users.filter((u) => u.id !== userId);
      saveUsersToLocal(updatedUsers);

      toast.success(res?.message || "Usuario dado de baja");
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error?.message || "No se pudo dar de baja al usuario");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (currentStatus && !confirm("¿Desactivar este usuario? No podrá iniciar sesión y se cerrarán sus sesiones abiertas.")) {
      return;
    }
    try {
      setActionLoading(userId);
      const newStatus = !currentStatus;

      // Actualizar en el backend
      await apiClient.updateUser(userId, { is_active: newStatus });

      // Actualizar estado local
      const updatedUsers = users.map((u) =>
        u.id === userId ? { ...u, is_active: newStatus } : u
      );
      saveUsersToLocal(updatedUsers);

      toast.success(`Usuario ${newStatus ? "activado" : "desactivado"} exitosamente`);
    } catch (error: any) {
      console.error("Error updating user status:", error);
      toast.error(error?.message || "Error al actualizar el estado del usuario.");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Fecha inválida";
    }
  };

  const ROLE_LABELS: Record<string, string> = {
    super_admin: "Super Admin", admin: "Administrador", manager: "Gerente", supervisor: "Supervisor",
    editor: "Editor", agent: "Agente", almacen: "Almacén", user: "Usuario", viewer: "Solo lectura", customer: "Cliente",
    gerente: "Gerente", anfitriona: "Anfitriona", mesero: "Mesero", cocina: "Cocina",
  };
  const getUserRole = (user: User) => ROLE_LABELS[String(user.role || "user")] || String(user.role || "Usuario");

  const getUserDisplayName = (user: User) => {
    return user.name || user.email;
  };

  const handleResetPassword = async (userItem: User) => {
    if (!confirm(`¿Resetear la contraseña de ${getUserDisplayName(userItem)}? Se generará una nueva contraseña temporal.`)) {
      return;
    }

    try {
      setActionLoading(userItem.id);

      // Llamar al endpoint para resetear contraseña
      const response = await apiClient.resetUserPassword(userItem.id);

      if (response.temporary_password) {
        // Mostrar modal con la nueva contraseña
        setNewPasswordData({
          userName: getUserDisplayName(userItem),
          password: response.temporary_password
        });
        setShowPasswordModal(true);

        toast.success("Contraseña reseteada exitosamente");
      }
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast.error("Error al resetear contraseña");
    } finally {
      setActionLoading(null);
    }
  };

  const copyPasswordToClipboard = () => {
    if (newPasswordData?.password) {
      navigator.clipboard.writeText(newPasswordData.password);
      toast.success("Contraseña copiada al portapapeles");
    }
  };

  if (isLoading || loading) {
    return (
      <AdminLayout title="Usuarios">
        <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Cargando usuarios…
        </div>
      </AdminLayout>
    );
  }

  if (!user) {
    return null;
  }

  const inactiveCount = users.filter((u) => !u.is_active).length;
  const shownCount = searchTerm ? filteredUsers.length : totalUsers;

  return (
    <AdminLayout title="Usuarios">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {activeCompany
              ? `Equipo de ${activeCompany.name}: acceso al panel, roles y estado de cada usuario.`
              : user.role === "super_admin"
                ? "Sin empresa seleccionada ves los usuarios de todas las empresas."
                : "Selecciona una empresa en la parte superior para ver sus usuarios."}
          </p>
          <Button className="w-fit shrink-0" onClick={() => router.push("/admin/users/new")}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Nuevo usuario
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Buscar por nombre o email"
              aria-label="Buscar usuarios"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 bg-card pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {connectionError && <Badge variant="secondary">Modo offline</Badge>}
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              {shownCount} usuario{shownCount !== 1 ? "s" : ""}
              {inactiveCount > 0 && ` · ${inactiveCount} inactivo${inactiveCount !== 1 ? "s" : ""}`}
            </span>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {searchTerm
                  ? "No se encontraron usuarios que coincidan con tu búsqueda"
                  : "No hay usuarios disponibles"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="hidden md:table-cell">Registro</TableHead>
                  <TableHead className="w-12"><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((userItem) => {
                  const name = getUserDisplayName(userItem);
                  const busy = actionLoading === userItem.id;
                  // Nadie se desactiva ni se da de baja a sí mismo (el backend también lo impide).
                  const isSelf = String(userItem.id) === String(user?.id);
                  return (
                    <TableRow key={userItem.id} className="hover:bg-secondary/50">
                      <TableCell className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/users/${userItem.id}/edit`)}
                          className="flex min-w-0 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground",
                              !userItem.is_active && "opacity-50"
                            )}
                            aria-hidden
                          >
                            {initials(name)}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-medium text-foreground">{name}</span>
                              {!userItem.is_active && (
                                <span className="rounded-control bg-destructive-soft px-2 py-0.5 text-xs font-medium text-destructive">Inactivo</span>
                              )}
                            </span>
                            {userItem.name && userItem.email && (
                              <span className="block truncate text-xs text-muted-foreground">{userItem.email}</span>
                            )}
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge className="border-transparent bg-secondary font-normal text-muted-foreground hover:bg-secondary">
                          {getUserRole(userItem)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground md:table-cell">
                        {userItem.created_at ? formatDate(userItem.created_at) : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Acciones de ${name}`} disabled={busy}>
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MoreHorizontal className="h-4 w-4" aria-hidden />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => router.push(`/admin/users/${userItem.id}/edit`)}>
                              <Edit aria-hidden /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isSelf}
                              onClick={() => handleToggleUserStatus(userItem.id, !!userItem.is_active)}
                            >
                              {userItem.is_active ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
                              {userItem.is_active ? "Desactivar" : "Activar"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetPassword(userItem)}>
                              <Key aria-hidden /> Resetear contraseña
                            </DropdownMenuItem>
                            {/* Sin «Exportar credenciales»: cambiaba la contraseña sin avisar
                                y descargaba un CSV sin ella. «Resetear contraseña» la muestra. */}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={isSelf}
                              onClick={() => handleDeleteUser(userItem.id, name)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 aria-hidden /> Dar de baja
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {!searchTerm && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Página {currentPage} &mdash; {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''} en esta página
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden /> Anterior
              </Button>
              <span className="text-sm font-medium">Página {currentPage}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={filteredUsers.length < PAGE_SIZE || loading}
              >
                Siguiente <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva contraseña temporal</DialogTitle>
            <DialogDescription>
              Se ha generado una nueva contraseña temporal para {newPasswordData?.userName}.
              El usuario debe cambiar esta contraseña en su próximo inicio de sesión.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <div className="grid flex-1 gap-2">
              <label htmlFor="password" className="sr-only">
                Contraseña
              </label>
              <Input
                id="password"
                type="text"
                value={newPasswordData?.password || ''}
                readOnly
                className="bg-secondary font-mono"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="px-3"
              onClick={copyPasswordToClipboard}
            >
              <span className="sr-only">Copiar</span>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <p className="rounded-md bg-warning-soft p-3 text-sm text-warning">
            Guarde esta contraseña de forma segura. Solo se mostrará una vez.
          </p>

          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowPasswordModal(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
}
