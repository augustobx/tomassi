"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { ClipboardList, Plus, Loader2, ArrowUpRight, Percent, Pencil, Trash2, X } from "lucide-react";

import { getListasPrecioGlobales, crearListaPrecioGlobal, actualizarListaPrecioGlobal, eliminarListaPrecioGlobal } from "@/app/actions/productos";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ListasPrecioPage() {
    const [isPending, startTransition] = useTransition();
    const [listas, setListas] = useState<any[]>([]);
    const [nombre, setNombre] = useState("");
    const [margen, setMargen] = useState("");
    const [loading, setLoading] = useState(true);

    // Estados para Edición
    const [listaEditando, setListaEditando] = useState<any | null>(null);
    const [nombreEdicion, setNombreEdicion] = useState("");
    const [margenEdicion, setMargenEdicion] = useState("");

    const cargarListas = () => {
        setLoading(true);
        startTransition(async () => {
            const res = await getListasPrecioGlobales();
            setListas(res);
            setLoading(false);
        });
    };

    useEffect(() => {
        cargarListas();
    }, []);

    const handleCrear = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre.trim()) return toast.error("El nombre es obligatorio");
        if (!margen || Number(margen) < 0) return toast.error("Ingrese un margen válido (mayor o igual a 0)");

        startTransition(async () => {
            const res = await crearListaPrecioGlobal({
                nombre,
                margen_defecto: Number(margen)
            });

            if (res.success) {
                toast.success("¡Lista de precios creada!");
                setNombre("");
                setMargen("");
                cargarListas();
            } else {
                toast.error(res.error);
            }
        });
    };

    const handleGuardarEdicion = () => {
        if (!nombreEdicion.trim()) return toast.error("El nombre no puede estar vacío");
        if (!margenEdicion || Number(margenEdicion) < 0) return toast.error("Margen inválido");

        startTransition(async () => {
            const res = await actualizarListaPrecioGlobal(listaEditando.id, {
                nombre: nombreEdicion,
                margen_defecto: Number(margenEdicion)
            });

            if (res.success) {
                toast.success("Tarifario actualizado", { description: "Los productos adoptarán este nuevo margen si no tienen uno propio." });
                setListaEditando(null);
                cargarListas();
            } else {
                toast.error(res.error);
            }
        });
    };

    const handleEliminar = (id: number, nombreLista: string) => {
        if (!confirm(`¿Estás seguro de eliminar el tarifario "${nombreLista}"? Esto afectará a los clientes que la tengan asignada.`)) return;

        startTransition(async () => {
            const res = await eliminarListaPrecioGlobal(id);
            if (res.success) {
                toast.success("Tarifario eliminado");
                cargarListas();
            } else {
                toast.error(res.error);
            }
        });
    };

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto min-h-[calc(100vh-6rem)]">

            {/* HEADER */}
            <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl shrink-0">
                    <ClipboardList className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Tarifarios y Márgenes</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Creá múltiples listas de precios y definí su rentabilidad base.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

                {/* FORMULARIO DE ALTA */}
                <div className="md:col-span-5">
                    <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-4">
                        <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-5">
                            <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <Plus className="h-4 w-4 text-indigo-500" /> Nueva Lista de Precios
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5">
                            <form onSubmit={handleCrear} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="font-semibold text-sm text-slate-700 dark:text-slate-300">Nombre de la Lista</Label>
                                    <Input
                                        autoFocus
                                        placeholder="Ej: Minorista, Mayorista, VIP..."
                                        value={nombre}
                                        onChange={(e) => setNombre(e.target.value)}
                                        className="h-11 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700"
                                    />
                                </div>

                                <div className="space-y-1.5 pt-2">
                                    <Label className="font-semibold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                        Margen de Ganancia Base <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            step="0.1"
                                            placeholder="Ej: 30"
                                            value={margen}
                                            onChange={(e) => setMargen(e.target.value)}
                                            className="h-11 pl-9 font-bold bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700"
                                        />
                                        <Percent className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-tight pt-1">
                                        Este % se aplicará automáticamente sobre el costo de los productos.
                                    </p>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isPending || !nombre.trim() || !margen}
                                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm mt-2"
                                >
                                    {isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Guardar Lista"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* LISTADO DE TARIFARIOS */}
                <div className="md:col-span-7">
                    <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col overflow-hidden">
                        <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-5">
                            <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <ClipboardList className="h-4 w-4 text-slate-400" /> Tarifarios Activos
                            </CardTitle>
                        </CardHeader>
                        <div className="p-0">
                            {loading ? (
                                <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-slate-300" /></div>
                            ) : listas.length === 0 ? (
                                <div className="text-center py-16 text-slate-400">
                                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm font-medium">Aún no hay listas de precios.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[10px] uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 text-slate-500 border-b border-slate-200 dark:border-zinc-800">
                                        <tr>
                                            <th className="px-6 py-3 font-semibold">Nombre de la Lista</th>
                                            <th className="px-6 py-3 font-semibold text-right">Margen Base</th>
                                            <th className="px-4 py-3 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {listas.map((lista) => (
                                            <tr key={lista.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <p className="font-semibold text-sm text-slate-900 dark:text-white">{lista.nombre}</p>
                                                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">ID: {lista.id}</p>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Badge variant="secondary" className="font-bold text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 rounded-md">
                                                        + {lista.margen_defecto}%
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                                                            onClick={() => { setListaEditando(lista); setNombreEdicion(lista.nombre); setMargenEdicion(String(lista.margen_defecto)); }}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                                                            onClick={() => handleEliminar(lista.id, lista.nombre)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </Card>
                </div>

            </div>

            {/* MODAL DE EDICIÓN DE LISTA DE PRECIOS */}
            {listaEditando && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                    <Card className="w-full max-w-sm shadow-xl border border-slate-200 dark:border-zinc-800">
                        <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-4 flex flex-row justify-between items-center">
                            <CardTitle className="text-base flex items-center gap-2"><Pencil className="h-4 w-4 text-indigo-500" /> Editar Tarifario</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setListaEditando(null)} className="h-6 w-6 rounded-full text-slate-400 hover:bg-slate-200">
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <Label className="font-semibold text-sm">Nombre de la Lista</Label>
                                <Input
                                    autoFocus
                                    value={nombreEdicion}
                                    onChange={e => setNombreEdicion(e.target.value)}
                                    className="h-11 border-slate-200"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="font-semibold text-sm">Margen Base (%)</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={margenEdicion}
                                    onChange={e => setMargenEdicion(e.target.value)}
                                    className="h-11 font-bold border-slate-200"
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button variant="ghost" onClick={() => setListaEditando(null)} className="w-1/3">Cancelar</Button>
                                <Button onClick={handleGuardarEdicion} disabled={isPending || !nombreEdicion.trim() || !margenEdicion} className="w-2/3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Actualizar"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

        </div>
    );
}