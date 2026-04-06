"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
    Users, ShieldCheck, UserPlus, KeyRound, Loader2, X, CheckSquare, Square, Trash2, Edit
} from "lucide-react";
import { getUsuarios, guardarUsuario, eliminarUsuario } from "@/app/actions/usuarios";
import { getSucursales } from "@/app/actions/configuracion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Lista de todos los módulos que se pueden bloquear
const MODULOS_SISTEMA = [
    { id: "VENTAS", nombre: "Terminal de Ventas", desc: "Facturar y cobrar en el mostrador." },
    { id: "CAJA", nombre: "Caja Diaria", desc: "Abrir/cerrar turnos y registrar egresos." },
    { id: "CLIENTES", nombre: "Clientes y Deudas", desc: "Ver cuentas corrientes y cobrar abonos." },
    { id: "INVENTARIO", nombre: "Inventario y Precios", desc: "Cargar stock, cambiar precios y costos." },
    { id: "HISTORIAL", nombre: "Historial de Ventas", desc: "Ver facturas pasadas y hacer devoluciones." },
    { id: "PRESUPUESTOS", nombre: "Presupuestos", desc: "Crear, editar y convertir cotizaciones." },
    { id: "REPORTES", nombre: "Reportes (Dashboard)", desc: "Ver ganancias, métricas y estadísticas." },
    { id: "CONFIGURACION", nombre: "Configuración", desc: "Cambiar datos de la empresa e impresiones." }
];

export default function GestionUsuariosPage() {
    const [isPending, startTransition] = useTransition();
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sucursales, setSucursales] = useState<any[]>([]);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [usuarioEditando, setUsuarioEditando] = useState<any | null>(null);
    const [permisosSeleccionados, setPermisosSeleccionados] = useState<string[]>([]);
    const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>("");
    const [rolSeleccionado, setRolSeleccionado] = useState<string>("CAJERO");

    const cargarUsuarios = () => {
        startTransition(async () => {
            const data = await getUsuarios();
            const sucs = await getSucursales();
            setUsuarios(data);
            setSucursales(sucs);
            setLoading(false);
        });
    };

    useEffect(() => {
        cargarUsuarios();
    }, []);

    const handleAbrirModal = (user: any = null) => {
        setUsuarioEditando(user);
        if (user) {
            setPermisosSeleccionados(JSON.parse(user.permisos || "[]"));
            setSucursalSeleccionada(user.sucursalId ? String(user.sucursalId) : "null");
            setRolSeleccionado(user.rol || "CAJERO");
        } else {
            // Permisos por defecto para un empleado nuevo
            setPermisosSeleccionados(["VENTAS", "CLIENTES"]);
            setSucursalSeleccionada("null");
            setRolSeleccionado("CAJERO");
        }
        setShowModal(true);
    };

    const togglePermiso = (moduloId: string) => {
        if (permisosSeleccionados.includes(moduloId)) {
            setPermisosSeleccionados(permisosSeleccionados.filter(p => p !== moduloId));
        } else {
            setPermisosSeleccionados([...permisosSeleccionados, moduloId]);
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        if (usuarioEditando) formData.append("id", String(usuarioEditando.id));
        if (sucursalSeleccionada !== "null") formData.append("sucursalId", sucursalSeleccionada);
        formData.append("rol", rolSeleccionado);

        // VENDEDOR no necesita permisos del ERP, solo accede a la PWA
        const permisosFinales = rolSeleccionado === "VENDEDOR" ? [] : permisosSeleccionados;

        startTransition(async () => {
            const res = await guardarUsuario(formData, JSON.stringify(permisosFinales));
            if (res.success) {
                toast.success("Usuario guardado correctamente.");
                setShowModal(false);
                cargarUsuarios();
            } else {
                toast.error(res.error);
            }
        });
    };

    const handleDelete = (id: number) => {
        if (!confirm("¿Seguro que deseás eliminar este usuario y denegarle el acceso?")) return;
        startTransition(async () => {
            const res = await eliminarUsuario(id);
            if (res.success) {
                toast.success("Usuario eliminado.");
                cargarUsuarios();
            } else {
                toast.error(res.error);
            }
        });
    };

    if (loading) return <div className="flex justify-center mt-32"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>;

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto min-h-[calc(100vh-6rem)] pb-12">

            {/* HEADER */}
            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl">
                        <ShieldCheck className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Control de Accesos</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Gestioná tu equipo y decidí qué módulos pueden usar.</p>
                    </div>
                </div>
                <Button onClick={() => handleAbrirModal(null)} className="bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm h-10 px-5">
                    <UserPlus className="h-4 w-4 mr-2" /> Nuevo Usuario
                </Button>
            </div>

            {usuarios.length === 0 && (
                <div className="bg-orange-50 border border-orange-200 p-6 rounded-xl text-center space-y-2">
                    <ShieldCheck className="h-10 w-10 text-orange-400 mx-auto" />
                    <h3 className="text-orange-800 font-bold text-lg">No hay usuarios en el sistema</h3>
                    <p className="text-orange-600 text-sm">El primer usuario que crees será automáticamente el DUEÑO (ADMIN) con acceso total e infinito.</p>
                </div>
            )}

            {/* GRILLA DE USUARIOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {usuarios.map(u => {
                    const permisosArray = JSON.parse(u.permisos || "[]");
                    const esAdmin = u.rol === "ADMIN";
                    const esVendedor = u.rol === "VENDEDOR";

                    return (
                        <Card key={u.id} className={`shadow-sm border-2 overflow-hidden ${esAdmin ? 'border-indigo-200 bg-indigo-50/10' : esVendedor ? 'border-amber-200 bg-amber-50/10' : 'border-slate-200 bg-white'}`}>
                            <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50/50">
                                <div>
                                    <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                                        <Users className="h-4 w-4 text-slate-400" /> {u.nombre}
                                    </CardTitle>
                                    <CardDescription className="font-mono text-xs mt-0.5">@{u.username}</CardDescription>
                                </div>
                                <Badge className={esAdmin ? 'bg-indigo-600' : esVendedor ? 'bg-amber-600' : 'bg-slate-500'}>{u.rol}</Badge>
                            </CardHeader>

                            <CardContent className="p-5">
                                <div className="space-y-3 mb-6">
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Módulos Habilitados</p>
                                    {esAdmin ? (
                                        <div className="text-sm font-medium text-emerald-600 bg-emerald-50 p-2 rounded-md border border-emerald-100 text-center">
                                            ⭐ Acceso Total (Dueño)
                                        </div>
                                    ) : esVendedor ? (
                                        <div className="text-sm font-medium text-amber-600 bg-amber-50 p-2 rounded-md border border-amber-100 text-center">
                                            📱 Solo PWA Vendedor
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {permisosArray.length === 0 ? <span className="text-xs text-red-500">Ninguno (Bloqueado)</span> : null}
                                            {permisosArray.map((p: string) => (
                                                <span key={p} className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                                    {p.replace('_', ' ')}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 pt-4 border-t border-slate-100">
                                    <Button variant="outline" size="sm" onClick={() => handleAbrirModal(u)} className="flex-1 text-slate-600 font-medium">
                                        <Edit className="h-3.5 w-3.5 mr-2" /> Editar
                                    </Button>
                                    {!esAdmin && (
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} className="text-red-500 hover:bg-red-50 shrink-0 h-9 w-9">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* =========================================================================
          MODAL DE CREACIÓN / EDICIÓN DE USUARIO
      ========================================================================= */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-2xl shadow-2xl border-0 rounded-2xl flex flex-col max-h-[90vh] overflow-hidden">

                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                                {usuarioEditando ? "Editar Usuario" : "Crear Nuevo Usuario"}
                            </h3>
                            <Button variant="ghost" size="icon" onClick={() => setShowModal(false)} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-200"><X className="h-4 w-4" /></Button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
                            <div className="p-6 flex flex-col md:flex-row gap-8">

                                {/* COLUMNA IZQUIERDA: DATOS DEL USUARIO */}
                                <div className="w-full md:w-1/2 space-y-4">
                                    <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-2">Datos de Acceso</h4>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Nombre del Empleado <span className="text-red-500">*</span></Label>
                                        <Input name="nombre" defaultValue={usuarioEditando?.nombre} required className="h-10 bg-slate-50" placeholder="Ej: Marcos García" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Usuario (Login) <span className="text-red-500">*</span></Label>
                                        <Input name="username" defaultValue={usuarioEditando?.username} required className="h-10 bg-slate-50" placeholder="Ej: marcos" />
                                    </div>
                                    <div className="space-y-1.5 pt-2">
                                        <Label className="text-xs font-semibold flex items-center gap-1">
                                            <KeyRound className="h-3.5 w-3.5 text-slate-400" /> Contraseña {usuarioEditando && <span className="text-[10px] text-slate-400 font-normal ml-1">(Dejar vacío para no cambiar)</span>}
                                        </Label>
                                        <Input name="password" type="password" required={!usuarioEditando} className="h-10 bg-slate-50" placeholder="••••••••" />
                                    </div>

                                    {/* SELECTOR DE ROL */}
                                    {usuarioEditando?.rol !== 'ADMIN' && usuarios.length > 0 && (
                                        <div className="space-y-1.5 pt-2">
                                            <Label className="text-xs font-semibold flex items-center gap-1">Rol del Usuario</Label>
                                            <Select value={rolSeleccionado} onValueChange={(val) => setRolSeleccionado(val || "CAJERO")}>
                                                <SelectTrigger className="h-10 bg-slate-50">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CAJERO">🏪 Cajero (Acceso al ERP)</SelectItem>
                                                    <SelectItem value="VENDEDOR">📱 Vendedor (Solo PWA)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[10px] text-slate-500 leading-tight">
                                                {rolSeleccionado === 'VENDEDOR' 
                                                    ? 'El vendedor solo accederá a la PWA de pedidos en calle. No verá el sistema ERP.' 
                                                    : 'El cajero accede al sistema ERP completo con los permisos que elijas.'}
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-1.5 pt-2">
                                        <Label className="text-xs font-semibold flex items-center gap-1">Sucursal Predeterminada (Punto de Venta)</Label>
                                        <Select value={sucursalSeleccionada} onValueChange={(val) => setSucursalSeleccionada(val as string)}>
                                            <SelectTrigger className="h-10 bg-slate-50">
                                                <SelectValue placeholder="Sin Sucursal Fija (Preguntar)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="null" className="font-semibold text-slate-400">Sin sucursal (Ninguna)</SelectItem>
                                                {sucursales.map(suc => (
                                                    <SelectItem key={suc.id} value={String(suc.id)}>{suc.nombre}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[10px] text-slate-500 leading-tight">Si seleccionás una, este usuario abrirá su caja y factura siempre directamente en ese lugar.</p>
                                    </div>

                                    {usuarios.length === 0 && (
                                        <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-800 font-medium">
                                            Este será el primer usuario del sistema. Se le asignará automáticamente el rol de ADMIN con acceso total a todo el ERP.
                                        </div>
                                    )}
                                </div>

                                {/* COLUMNA DERECHA: PERMISOS (Solo si no es ADMIN) */}
                                <div className="w-full md:w-1/2">
                                    <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-4">Permisos y Accesos</h4>

                                    {usuarioEditando?.rol === "ADMIN" || usuarios.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                                            <ShieldCheck className="h-12 w-12 text-slate-300 mb-2" />
                                            <p className="font-bold text-slate-700">Modo Dueño</p>
                                            <p className="text-xs text-slate-500 mt-1">Los administradores tienen acceso irrestricto a todos los módulos por defecto.</p>
                                        </div>
                                    ) : rolSeleccionado === 'VENDEDOR' ? (
                                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-amber-200 rounded-xl p-6 text-center bg-amber-50/30">
                                            <ShieldCheck className="h-12 w-12 text-amber-400 mb-2" />
                                            <p className="font-bold text-amber-700">Vendedor PWA</p>
                                            <p className="text-xs text-amber-600 mt-1">Este usuario solo accederá a la aplicación de toma de pedidos en calle. No necesita permisos del ERP.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {MODULOS_SISTEMA.map(mod => {
                                                const tienePermiso = permisosSeleccionados.includes(mod.id);
                                                return (
                                                    <div
                                                        key={mod.id}
                                                        onClick={() => togglePermiso(mod.id)}
                                                        className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${tienePermiso ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-200'}`}
                                                    >
                                                        <div className="mt-0.5">
                                                            {tienePermiso ? <CheckSquare className="h-5 w-5 text-indigo-600" /> : <Square className="h-5 w-5 text-slate-300" />}
                                                        </div>
                                                        <div>
                                                            <p className={`font-bold text-sm ${tienePermiso ? 'text-indigo-900' : 'text-slate-700'}`}>{mod.nombre}</p>
                                                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{mod.desc}</p>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                            </div>

                            <div className="p-5 border-t border-slate-100 bg-slate-50 mt-auto flex justify-end gap-3 shrink-0">
                                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="bg-white">Cancelar</Button>
                                <Button type="submit" disabled={isPending} className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-8">
                                    {isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Guardar Accesos"}
                                </Button>
                            </div>
                        </form>

                    </Card>
                </div>
            )}

        </div>
    );
}