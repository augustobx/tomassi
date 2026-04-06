"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, Send, HardDrive, Loader2, Users } from "lucide-react";

import { getSucursales, getListasPrecio } from "@/app/actions/configuracion";
import { importarProductosExcel, importarClientesExcel } from "@/app/actions/importador";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ImportadorPage() {
    const [isPending, startTransition] = useTransition();

    // Estado general
    const [depositos, setDepositos] = useState<{ id: number; nombre: string; sucursal: string }[]>([]);
    const [listasPrecio, setListasPrecio] = useState<{ id: number; nombre: string }[]>([]);
    const [loadingDeps, setLoadingDeps] = useState(true);

    // Estado Tab Productos
    const [depositoSeleccionado, setDepositoSeleccionado] = useState("");
    const [listasSeleccionadas, setListasSeleccionadas] = useState<number[]>([]);
    const [fileProductos, setFileProductos] = useState<File | null>(null);

    // Estado Tab Clientes
    const [fileClientes, setFileClientes] = useState<File | null>(null);

    useEffect(() => {
        const init = async () => {
            const data = await getSucursales();
            const listas = await getListasPrecio();
            
            const deps: any[] = [];
            data.forEach((suc: any) => {
                suc.depositos.forEach((dep: any) => {
                    deps.push({ id: dep.id, nombre: dep.nombre, sucursal: suc.nombre });
                });
            });
            setDepositos(deps);
            setListasPrecio(listas);
            setLoadingDeps(false);
        };
        init();
    }, []);

    const handleSubirProductos = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fileProductos) return toast.error("Por favor selecciona un archivo Excel.");
        if (!depositoSeleccionado) return toast.error("Debes seleccionar un depósito de destino.");

        const formData = new FormData();
        formData.append("file", fileProductos);
        formData.append("depositoId", depositoSeleccionado);
        if (listasSeleccionadas.length > 0) {
            formData.append("listasIds", JSON.stringify(listasSeleccionadas));
        }

        const toastId = toast.loading("Procesando Excel de Productos...");
        startTransition(async () => {
            const res = await importarProductosExcel(formData);
            if (res.success) {
                toast.success("Migración Completa", { id: toastId, description: res.mensaje });
                setFileProductos(null);
                (document.getElementById("input-file-productos") as HTMLInputElement).value = ""; // Reset input visual
            } else {
                toast.error("Error en importación", { id: toastId, description: res.error });
            }
        });
    };

    const handleSubirClientes = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fileClientes) return toast.error("Por favor selecciona un archivo Excel.");

        const formData = new FormData();
        formData.append("file", fileClientes);

        const toastId = toast.loading("Procesando Excel de Clientes...");
        startTransition(async () => {
            const res = await importarClientesExcel(formData);
            if (res.success) {
                toast.success("Migración Completa", { id: toastId, description: res.mensaje });
                setFileClientes(null);
                (document.getElementById("input-file-clientes") as HTMLInputElement).value = "";
            } else {
                toast.error("Error en importación", { id: toastId, description: res.error });
            }
        });
    };

    return (
        <div className="max-w-4xl mx-auto pb-12 space-y-6">

            {/* Cabecera */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex items-center gap-5">
                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl">
                    <DatabaseIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Migración de Datos Excel</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Sube tus archivos de catálogo viejo para transicionar rápidamente al ERP.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="productos" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="productos" className="font-bold tracking-wide"><FileSpreadsheet className="w-4 h-4 mr-2" /> Productos e Inventario</TabsTrigger>
                    <TabsTrigger value="clientes" className="font-bold tracking-wide"><Users className="w-4 h-4 mr-2" /> Cartera de Clientes</TabsTrigger>
                </TabsList>

                {/* ========================================================
                    PANEL DE PRODUCTOS 
                ======================================================== */}
                <TabsContent value="productos">
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50 border-b">
                            <CardTitle className="text-lg text-slate-800 font-bold flex items-center gap-2">
                                <UploadCloud className="h-5 w-5 text-indigo-500" /> Importar Catálogo de Productos
                            </CardTitle>
                            <CardDescription>
                                Respeta estrictamente el formato exacto de columnas: <br/>
                                <strong className="text-slate-700">A: Código | B: Nombre | C: Costo | D: Stock | E: Marca | F: Categoría | H: Proveedor</strong>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSubirProductos} className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="font-bold text-slate-700">1. ¿En qué depósito se alojará este listado?</Label>
                                    <Select value={depositoSeleccionado} onValueChange={(val) => setDepositoSeleccionado(val as string)}>
                                        <SelectTrigger className="h-11" disabled={loadingDeps || isPending}>
                                            <SelectValue placeholder="Seleccioná un depósito de destino..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {depositos.map(dep => (
                                                <SelectItem key={dep.id} value={String(dep.id)}>
                                                    {dep.sucursal} — {dep.nombre}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-slate-500">
                                        Todos los productos nuevos o actualizados asignarán stock en este depósito particular.
                                    </p>
                                </div>

                                <div className="space-y-3 border-t pt-4">
                                    <Label className="font-bold text-slate-700">2. ¿A qué Listas de Precios pertenecen?</Label>
                                    <p className="text-xs text-slate-500 mb-2">Puedes seleccionar en qué listas se darán de alta para quedar disponibles en el POS.</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {listasPrecio.map(lista => (
                                            <label key={lista.id} className={`flex items-start gap-2 p-3 border rounded-xl cursor-pointer transition-colors ${listasSeleccionadas.includes(lista.id) ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50'}`}>
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 mt-0.5 accent-indigo-600 rounded border-slate-300" 
                                                    checked={listasSeleccionadas.includes(lista.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setListasSeleccionadas(prev => [...prev, lista.id]);
                                                        } else {
                                                            setListasSeleccionadas(prev => prev.filter(id => id !== lista.id));
                                                        }
                                                    }}
                                                />
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-semibold truncate ${listasSeleccionadas.includes(lista.id) ? 'text-indigo-900' : 'text-slate-700'}`}>{lista.nombre}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2 border-t pt-4">
                                    <Label className="font-bold text-slate-700">3. Archivo Excel (.csv, .xls, .xlsx)</Label>
                                    <Input 
                                        id="input-file-productos" 
                                        type="file" 
                                        accept=".xlsx, .xls, .csv"
                                        disabled={isPending}
                                        onChange={(e) => setFileProductos(e.target.files?.[0] || null)}
                                        className="h-12 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                                    />
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button type="submit" disabled={isPending || !fileProductos || !depositoSeleccionado} className="bg-indigo-600 hover:bg-indigo-700 h-11 px-8 text-md shadow-md">
                                        {isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
                                        Comenzar Importación
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ========================================================
                    PANEL DE CLIENTES 
                ======================================================== */}
                <TabsContent value="clientes">
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-emerald-50 border-b border-emerald-100">
                            <CardTitle className="text-lg text-emerald-800 font-bold flex items-center gap-2">
                                <UploadCloud className="h-5 w-5 text-emerald-600" /> Importar Listado de Clientes
                            </CardTitle>
                            <CardDescription className="text-emerald-700/80">
                                <strong className="text-emerald-900">A: Nombre | B: Cond IVA | C: CUIT | D: DNI | E: Domicilio | F, G: Vacías | H: Teléfono</strong>
                                <br />Si ingresás CUIT (Col C) el DNI (Col D) se ignorará automáticamente según reglas corporativas.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSubirClientes} className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="font-bold text-slate-700">Archivo Excel (.csv, .xls, .xlsx)</Label>
                                    <Input 
                                        id="input-file-clientes" 
                                        type="file" 
                                        accept=".xlsx, .xls, .csv"
                                        disabled={isPending}
                                        onChange={(e) => setFileClientes(e.target.files?.[0] || null)}
                                        className="h-12 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                                    />
                                </div>

                                <div className="flex justify-end pt-4 border-t">
                                    <Button type="submit" disabled={isPending || !fileClientes} className="bg-emerald-600 hover:bg-emerald-700 h-11 px-8 text-md shadow-md">
                                        {isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
                                        Subir Clientes
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

        </div>
    );
}

function DatabaseIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5V19A9 3 0 0 0 21 19V5" />
            <path d="M3 12A9 3 0 0 0 21 12" />
        </svg>
    );
}
