"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Store, Navigation, MapPin, Loader2, Edit, X, Phone, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { crearSucursal, editarSucursal, crearDeposito, editarDeposito } from "@/app/actions/configuracion-sucursales";

export function ABMSucursalesClient({ sucursales }: { sucursales: any[] }) {
    const [isPending, startTransition] = useTransition();
    
    // Modal ABM Sucursal
    const [modalSuc, setModalSuc] = useState(false);
    const [sucEditando, setSucEditando] = useState<any | null>(null);
    const [formSuc, setFormSuc] = useState({ nombre: "", direccion: "", telefono: "", estado: true });

    // Modal ABM Depósito
    const [modalDepo, setModalDepo] = useState(false);
    const [depoEditando, setDepoEditando] = useState<any | null>(null);
    const [formDepo, setFormDepo] = useState({ nombre: "", estado: true, sucursalId: 0 });

    const abrirNuevaSucursal = () => {
        setSucEditando(null);
        setFormSuc({ nombre: "", direccion: "", telefono: "", estado: true });
        setModalSuc(true);
    };

    const abrirEditarSucursal = (s: any) => {
        setSucEditando(s);
        setFormSuc({ nombre: s.nombre, direccion: s.direccion || "", telefono: s.telefono || "", estado: s.estado });
        setModalSuc(true);
    };

    const guardarSucursal = () => {
        if (!formSuc.nombre) return toast.error("El nombre es obligatorio");
        startTransition(async () => {
            let res;
            if (sucEditando) {
                res = await editarSucursal(sucEditando.id, formSuc.nombre, formSuc.direccion, formSuc.telefono, formSuc.estado);
            } else {
                res = await crearSucursal(formSuc.nombre, formSuc.direccion, formSuc.telefono);
            }
            if (res.success) {
                toast.success(sucEditando ? "Sucursal actualizada" : "Sucursal creada con un depósito default");
                setModalSuc(false);
            } else {
                toast.error(res.error);
            }
        });
    };

    const abrirNuevoDeposito = (sucursalId: number) => {
        setDepoEditando(null);
        setFormDepo({ nombre: "", estado: true, sucursalId });
        setModalDepo(true);
    };

    const abrirEditarDeposito = (d: any, sucursalId: number) => {
        setDepoEditando(d);
        setFormDepo({ nombre: d.nombre, estado: d.estado, sucursalId });
        setModalDepo(true);
    };

    const guardarDeposito = () => {
        if (!formDepo.nombre) return toast.error("El nombre es obligatorio");
        startTransition(async () => {
            let res;
            if (depoEditando) {
                res = await editarDeposito(depoEditando.id, formDepo.nombre, formDepo.estado);
            } else {
                res = await crearDeposito(formDepo.nombre, formDepo.sucursalId);
            }
            if (res.success) {
                toast.success(depoEditando ? "Depósito actualizado" : "Depósito creado");
                setModalDepo(false);
            } else {
                toast.error(res.error);
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button onClick={abrirNuevaSucursal} className="bg-slate-900 text-white hover:bg-slate-800 h-10 shadow-sm">
                    <Plus className="mr-2 h-4 w-4" /> Agregar Sucursal
                </Button>
            </div>

            <div className="space-y-6">
                {sucursales.map(sucursal => (
                    <Card key={sucursal.id} className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden bg-white dark:bg-zinc-900">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800 gap-4">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${sucursal.estado ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <Store className="h-6 w-6" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className={`text-lg font-bold ${sucursal.estado ? 'text-slate-900 dark:text-white' : 'text-slate-500 line-through'}`}>{sucursal.nombre}</h3>
                                        <Badge variant="outline" className={`text-[10px] font-bold tracking-widest uppercase ${sucursal.estado ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                            {sucursal.estado ? 'Activa' : 'Inactiva'}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                        {sucursal.direccion && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {sucursal.direccion}</span>}
                                        {sucursal.telefono && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {sucursal.telefono}</span>}
                                    </div>
                                </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => abrirEditarSucursal(sucursal)} className="bg-white border-slate-200 hover:bg-slate-50">
                                <Edit className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Editar
                            </Button>
                        </div>

                        <CardContent className="p-0">
                            <div className="px-5 py-3 bg-white dark:bg-zinc-900 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800">
                                <h4 className="text-xs uppercase font-bold text-slate-500 flex items-center gap-2 tracking-widest">
                                    <Warehouse className="h-4 w-4" /> Depósitos Asociados
                                </h4>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-indigo-600 font-bold hover:bg-indigo-50" onClick={() => abrirNuevoDeposito(sucursal.id)}>
                                    + Agregar
                                </Button>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {sucursal.depositos.map((depo: any) => (
                                    <div key={depo.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Navigation className="h-4 w-4 text-slate-300 transform rotate-90" />
                                            <span className={`text-sm font-semibold ${depo.estado ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 line-through'}`}>
                                                {depo.nombre}
                                            </span>
                                            {!depo.estado && <Badge variant="secondary" className="text-[9px]">INACTIVO</Badge>}
                                        </div>
                                        <Button size="sm" variant="ghost" onClick={() => abrirEditarDeposito(depo, sucursal.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                                            <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                                {sucursal.depositos.length === 0 && (
                                    <div className="px-5 py-4 text-sm text-center text-slate-400 italic">No hay depósitos para esta sucursal.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                
                {sucursales.length === 0 && (
                    <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                        <Store className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-700">No hay sucursales cargadas</h3>
                        <p className="text-slate-500 text-sm mt-1">Crea tu primera sucursal física para comenzar a facturar.</p>
                        <Button onClick={abrirNuevaSucursal} className="mt-4 bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm">
                            <Plus className="mr-2 h-4 w-4" /> Crear Sede Principal
                        </Button>
                    </div>
                )}
            </div>

            {/* MODAL SUCURSAL */}
            {modalSuc && (
                <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                    <Card className="w-full max-w-md shadow-2xl border-none">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between p-5">
                            <CardTitle className="text-lg">{sucEditando ? "Editar Sucursal" : "Nueva Sucursal"}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setModalSuc(false)} className="h-8 w-8 rounded-full"><X className="h-4 w-4" /></Button>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase font-bold text-slate-500">Nombre de Sucursal <span className="text-red-500">*</span></Label>
                                <Input value={formSuc.nombre} onChange={e => setFormSuc({ ...formSuc, nombre: e.target.value })} placeholder="Ej: Sucursal Centro" autoFocus />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase font-bold text-slate-500">Dirección</Label>
                                <Input value={formSuc.direccion} onChange={e => setFormSuc({ ...formSuc, direccion: e.target.value })} placeholder="Ej: Av. San Martín 1234" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase font-bold text-slate-500">Teléfono</Label>
                                <Input value={formSuc.telefono} onChange={e => setFormSuc({ ...formSuc, telefono: e.target.value })} placeholder="Ej: 341 555-4444" />
                            </div>
                            {sucEditando && (
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2">
                                    <Label className="text-sm font-bold text-slate-700 cursor-pointer" htmlFor="estado-suc">Sucursal Operativa (Activa)</Label>
                                    <input type="checkbox" id="estado-suc" checked={formSuc.estado} onChange={e => setFormSuc({ ...formSuc, estado: e.target.checked })} className="h-4 w-4 accent-indigo-600" />
                                </div>
                            )}
                            <div className="flex gap-2 pt-2">
                                <Button variant="ghost" onClick={() => setModalSuc(false)} className="w-1/3">Cancelar</Button>
                                <Button onClick={guardarSucursal} disabled={isPending} className="w-2/3 bg-slate-900 text-white">
                                    {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Guardar Sucursal"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* MODAL DEPÓSITO */}
            {modalDepo && (
                <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                    <Card className="w-full max-w-sm shadow-2xl border-none">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between p-5">
                            <CardTitle className="text-lg">{depoEditando ? "Editar Depósito" : "Nuevo Depósito"}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setModalDepo(false)} className="h-8 w-8 rounded-full"><X className="h-4 w-4" /></Button>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase font-bold text-slate-500">Nombre del Depósito <span className="text-red-500">*</span></Label>
                                <Input value={formDepo.nombre} onChange={e => setFormDepo({ ...formDepo, nombre: e.target.value })} placeholder="Ej: Depósito Trasero" autoFocus />
                            </div>
                            {depoEditando && (
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2">
                                    <Label className="text-sm font-bold text-slate-700 cursor-pointer" htmlFor="estado-depo">Depósito Activo</Label>
                                    <input type="checkbox" id="estado-depo" checked={formDepo.estado} onChange={e => setFormDepo({ ...formDepo, estado: e.target.checked })} className="h-4 w-4 accent-indigo-600" />
                                </div>
                            )}
                            <div className="flex gap-2 pt-2">
                                <Button variant="ghost" onClick={() => setModalDepo(false)} className="w-1/3">Cancelar</Button>
                                <Button onClick={guardarDeposito} disabled={isPending} className="w-2/3 bg-slate-900 text-white">
                                    {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Guardar Depósito"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
