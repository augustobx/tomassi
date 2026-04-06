"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Tags, Plus, Loader2, FolderOpen, Pencil, Trash2, X, Percent, Tag, Building2 } from "lucide-react";

import { getCategorias, crearCategoria, actualizarCategoria, eliminarCategoria, getMarcas } from "@/app/actions/productos";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CategoriasPage() {
    const [isPending, startTransition] = useTransition();
    const [categorias, setCategorias] = useState<any[]>([]);
    const [nombre, setNombre] = useState("");
    const [loading, setLoading] = useState(true);
    const [marcas, setMarcas] = useState<any[]>([]);
    
    // Form Creation State
    const [marcaId, setMarcaId] = useState<string>("");
    const [aumentoPorcentaje, setAumentoPorcentaje] = useState<string>("");

    // Form Edit State
    const [catEditando, setCatEditando] = useState<any | null>(null);
    const [nombreEdicion, setNombreEdicion] = useState("");
    const [marcaIdEdicion, setMarcaIdEdicion] = useState<string>("");
    const [aumentoPorcentajeEdicion, setAumentoPorcentajeEdicion] = useState<string>("");

    const cargarDatos = () => {
        setLoading(true);
        startTransition(async () => {
            const [resCat, resMarcas] = await Promise.all([
                getCategorias(),
                getMarcas()
            ]);
            setCategorias(resCat);
            setMarcas(resMarcas);
            setLoading(false);
        });
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const handleCrear = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre.trim()) return toast.error("El nombre es obligatorio");
        if (!marcaId) return toast.error("Debe seleccionar una marca");

        startTransition(async () => {
            const res = await crearCategoria(nombre, Number(marcaId), Number(aumentoPorcentaje || 0));
            if (res.success) {
                toast.success("¡Categoría creada exitosamente!");
                setNombre("");
                setMarcaId("");
                setAumentoPorcentaje("");
                cargarDatos();
            } else {
                toast.error(res.error);
            }
        });
    };

    const handleGuardarEdicion = () => {
        if (!nombreEdicion.trim()) return toast.error("El nombre no puede estar vacío");
        if (!marcaIdEdicion) return toast.error("La marca es obligatoria");

        startTransition(async () => {
            const res = await actualizarCategoria(catEditando.id, nombreEdicion, Number(marcaIdEdicion), Number(aumentoPorcentajeEdicion || 0));
            if (res.success) {
                toast.success("Categoría actualizada");
                setCatEditando(null);
                cargarDatos();
            } else {
                toast.error(res.error);
            }
        });
    };

    const handleEliminar = (id: number, nombreCat: string) => {
        if (!confirm(`¿Estás seguro de eliminar la categoría "${nombreCat}"?`)) return;

        startTransition(async () => {
            const res = await eliminarCategoria(id);
            if (res.success) {
                toast.success("Categoría eliminada");
                cargarDatos();
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
                    <Tags className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Gestión de Categorías</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Organizá tu inventario en rubros para facilitar la búsqueda.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

                {/* FORMULARIO DE ALTA */}
                <div className="md:col-span-5">
                    <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-4">
                        <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-5">
                            <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <Plus className="h-4 w-4 text-indigo-500" /> Nueva Categoría
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5">
                            <form onSubmit={handleCrear} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="font-semibold text-sm text-slate-700 dark:text-slate-300">Nombre de la Categoría</Label>
                                    <Input
                                        autoFocus
                                        placeholder="Ej: Almacén, Lácteos, Ferretería..."
                                        value={nombre}
                                        onChange={(e) => setNombre(e.target.value)}
                                        className="h-11 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="font-semibold text-sm text-slate-700 dark:text-slate-300">Seleccionar Marca Padre <span className="text-red-500">*</span></Label>
                                    <Select value={marcaId} onValueChange={(v) => setMarcaId(v || "")}>
                                        <SelectTrigger className="h-11 bg-slate-50 border-slate-200">
                                            <SelectValue placeholder="Elegir marca..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {marcas.map(m => (
                                                <SelectItem key={m.id} value={String(m.id)}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{m.nombre}</span>
                                                        <span className="text-xs text-slate-400">({m.proveedor?.nombre})</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5 p-3 bg-purple-50 border border-purple-100 rounded-lg">
                                    <Label className="text-xs font-semibold text-purple-700 flex items-center gap-1"><Percent className="h-3 w-3" /> Aumento Propio (%)</Label>
                                    <Input 
                                        type="number" step="0.1" 
                                        value={aumentoPorcentaje}
                                        onChange={(e) => setAumentoPorcentaje(e.target.value)}
                                        className="h-10 bg-white border-purple-200" 
                                        placeholder="Ej: 10"
                                    />
                                    <p className="text-[10px] text-purple-600">Este porcentaje de cascada es exclusivo para esta categoría.</p>
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isPending || !nombre.trim() || !marcaId}
                                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm"
                                >
                                    {isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Guardar Categoría"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* LISTADO DE CATEGORÍAS */}
                <div className="md:col-span-7">
                    <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col overflow-hidden">
                        <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-5">
                            <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <FolderOpen className="h-4 w-4 text-slate-400" /> Directorio Actual
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Tenés {categorias.length} categorías registradas en tu sistema.
                            </CardDescription>
                        </CardHeader>
                        <div className="p-0">
                            {loading ? (
                                <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-slate-300" /></div>
                            ) : categorias.length === 0 ? (
                                <div className="text-center py-16 text-slate-400">
                                    <Tags className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm font-medium">No hay categorías creadas aún.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {categorias.map((cat) => (
                                        <div key={cat.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-slate-100 dark:bg-zinc-800 p-2.5 rounded-md shrink-0">
                                                    <FolderOpen className="h-5 w-5 text-slate-500" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white text-base">{cat.nombre}</p>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                                            <Tag className="h-3 w-3" /> {cat.marca?.nombre} 
                                                            <span className="text-slate-400 text-[10px]">({cat.marca?.proveedor?.nombre})</span>
                                                        </p>
                                                        {cat.aumento_porcentaje > 0 && (
                                                            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                                                                +{cat.aumento_porcentaje}% Casc.
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* BOTONES DE ACCIÓN */}
                                            <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                                                    onClick={() => { 
                                                        setCatEditando(cat); 
                                                        setNombreEdicion(cat.nombre); 
                                                        setMarcaIdEdicion(cat.marcaId ? String(cat.marcaId) : "");
                                                        setAumentoPorcentajeEdicion(String(cat.aumento_porcentaje || 0));
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                                                    onClick={() => handleEliminar(cat.id, cat.nombre)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

            </div>

            {/* MODAL DE EDICIÓN DE CATEGORÍA */}
            {catEditando && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                    <Card className="w-full max-w-sm shadow-xl border border-slate-200 dark:border-zinc-800">
                        <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-4 flex flex-row justify-between items-center">
                            <CardTitle className="text-base flex items-center gap-2"><Pencil className="h-4 w-4 text-indigo-500" /> Editar Categoría</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setCatEditando(null)} className="h-6 w-6 rounded-full text-slate-400 hover:bg-slate-200">
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <Label className="font-semibold text-sm">Nombre</Label>
                                <Input
                                    autoFocus
                                    value={nombreEdicion}
                                    onChange={e => setNombreEdicion(e.target.value)}
                                    className="h-11 border-slate-200"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="font-semibold text-sm">Marca Perteneciente</Label>
                                <Select value={marcaIdEdicion} onValueChange={(v) => setMarcaIdEdicion(v || "")}>
                                    <SelectTrigger className="h-11 border-slate-200">
                                        <SelectValue placeholder="Elegir marca..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {marcas.map(m => (
                                            <SelectItem key={m.id} value={String(m.id)}>
                                                {m.nombre} ({m.proveedor?.nombre})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 p-3 bg-purple-50 border border-purple-100 rounded-lg">
                                <Label className="text-xs font-semibold text-purple-700 flex items-center gap-1"><Percent className="h-3 w-3" /> Aumento Propio (%)</Label>
                                <Input 
                                    type="number" step="0.1" 
                                    value={aumentoPorcentajeEdicion}
                                    onChange={(e) => setAumentoPorcentajeEdicion(e.target.value)}
                                    className="h-10 bg-white border-purple-200" 
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button variant="ghost" onClick={() => setCatEditando(null)} className="w-1/3">Cancelar</Button>
                                <Button onClick={handleGuardarEdicion} disabled={isPending || !nombreEdicion.trim()} className="w-2/3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
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