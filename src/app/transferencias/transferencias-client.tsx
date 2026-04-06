"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Replace, ArrowRight, PackageOpen, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { registrarTransferencia } from "@/app/actions/transferencias";

export function TransferenciasClient({ productos, depositos, historial }: { productos: any[], depositos: any[], historial: any[] }) {
    const [isPending, startTransition] = useTransition();

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProducto, setSelectedProducto] = useState<any | null>(null);

    const [origenId, setOrigenId] = useState<string>("");
    const [destinoId, setDestinoId] = useState<string>("");
    const [cantidad, setCantidad] = useState<string>("");

    const filteredProductos = searchTerm.trim().length > 0 
        ? productos.filter(p => p.nombre_producto.toLowerCase().includes(searchTerm.toLowerCase()) || p.codigo_articulo.toLowerCase().includes(searchTerm.toLowerCase()))
        : productos;

    const handleTransfer = () => {
        if (!selectedProducto) return toast.error("Debe seleccionar un producto.");
        if (!origenId || !destinoId) return toast.error("Debe seleccionar origen y destino.");
        if (origenId === destinoId) return toast.error("El origen y destino no pueden ser el mismo.");
        const cant = Number(cantidad);
        if (isNaN(cant) || cant <= 0) return toast.error("Cantidad inválida.");

        const stockDisponible = selectedProducto.stocks.find((s: any) => String(s.depositoId) === origenId)?.cantidad || 0;
        if (cant > stockDisponible) return toast.error("No hay suficiente stock en el depósito de origen.");

        startTransition(async () => {
            const res = await registrarTransferencia(selectedProducto.id, Number(origenId), Number(destinoId), cant, 1); // Mock 1 user
            if (res.success) {
                toast.success("Transferencia completada con éxito.");
                setSearchTerm("");
                setSelectedProducto(null);
                setOrigenId("");
                setDestinoId("");
                setCantidad("");
            } else {
                toast.error(res.error);
            }
        });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* IZQUIERDA: FORMULARIO DE TRANSFERENCIA */}
            <div className="space-y-6">
                <Card className="shadow-sm border-slate-200 dark:border-zinc-800">
                    <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Replace className="h-5 w-5 text-indigo-500" /> Nueva Transferencia
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-6">
                        {/* 1. Seleccionar Producto */}
                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase text-slate-500">Paso 1: Producto a transferir</Label>
                            {!selectedProducto ? (
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <Input 
                                            placeholder="Buscar producto por nombre o código..." 
                                            value={searchTerm} 
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="pl-9 bg-slate-50"
                                            autoFocus
                                        />
                                    </div>
                                    {filteredProductos.length > 0 && (
                                        <div className="border border-slate-200 rounded-lg bg-white shadow-sm divide-y max-h-[200px] overflow-y-auto">
                                            {filteredProductos.map(p => (
                                                <div 
                                                    key={p.id} 
                                                    className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition"
                                                    onClick={() => setSelectedProducto(p)}
                                                >
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-900">{p.nombre_producto}</div>
                                                        <div className="text-xs text-slate-500">{p.codigo_articulo}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-3 border border-indigo-200 bg-indigo-50 rounded-lg">
                                    <div>
                                        <div className="text-sm font-bold text-indigo-900">{selectedProducto.nombre_producto}</div>
                                        <div className="text-xs text-indigo-700/70">{selectedProducto.codigo_articulo}</div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedProducto(null)} className="h-7 text-xs text-indigo-600">Cambiar</Button>
                                </div>
                            )}
                        </div>

                        {selectedProducto && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                {/* 2. Depósito Origen */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold uppercase text-slate-500">Paso 2: Depósito Origen</Label>
                                    <Select value={origenId} onValueChange={(val) => setOrigenId(val as string)}>
                                        <SelectTrigger className="bg-slate-50 h-12">
                                            <SelectValue placeholder="Seleccione desde dónde envía..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {depositos.map(d => {
                                                const stock = selectedProducto.stocks.find((s: any) => s.depositoId === d.id)?.cantidad || 0;
                                                return (
                                                    <SelectItem key={d.id} value={String(d.id)} disabled={stock <= 0}>
                                                        {d.nombre} <span className="text-slate-400 font-mono ml-2">({stock} disponibles)</span>
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* 3. Depósito Destino */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold uppercase text-slate-500">Paso 3: Depósito Destino</Label>
                                    <Select value={destinoId} onValueChange={(val) => setDestinoId(val as string)}>
                                        <SelectTrigger className="bg-slate-50 h-12">
                                            <SelectValue placeholder="Seleccione hacia dónde envía..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {depositos.map(d => (
                                                <SelectItem key={d.id} value={String(d.id)} disabled={String(d.id) === origenId}>
                                                    {d.nombre}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* 4. Cantidad */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold uppercase text-slate-500">Paso 4: Cantidad a mover</Label>
                                    <div className="relative">
                                        <PackageOpen className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                                        <Input 
                                            type="number"
                                            value={cantidad} 
                                            onChange={e => setCantidad(e.target.value)}
                                            className="pl-10 h-12 text-lg font-bold bg-slate-50"
                                            placeholder="Ej: 5"
                                        />
                                    </div>
                                    {origenId && (
                                        <div className="text-xs font-bold text-slate-500 text-right">
                                            Máximo: {selectedProducto.stocks.find((s: any) => String(s.depositoId) === origenId)?.cantidad || 0}
                                        </div>
                                    )}
                                </div>

                                <Button 
                                    onClick={handleTransfer} 
                                    disabled={isPending || !origenId || !destinoId || !cantidad}
                                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-md"
                                >
                                    {isPending ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Replace className="h-5 w-5 mr-2" />}
                                    Confirmar Transferencia
                                </Button>
                            </div>
                        )}

                    </CardContent>
                </Card>
            </div>

            {/* DERECHA: HISTORIAL */}
            <div>
                <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-full">
                    <CardHeader className="p-5 border-b border-slate-100">
                        <CardTitle className="text-base font-bold text-slate-800">Últimos Movimientos</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {historial.length === 0 ? (
                            <div className="p-10 text-center text-slate-500 text-sm">
                                No se registran transferencias recientes.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {historial.map(mov => (
                                    <div key={mov.id} className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="text-sm font-bold text-slate-900">{mov.producto.nombre_producto}</div>
                                                <div className="text-xs text-slate-500 font-mono">{mov.producto.codigo_articulo}</div>
                                            </div>
                                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                                {mov.cantidad} unid.
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                                            <span className="truncate max-w-[120px]" title={mov.depositoOrigen?.nombre}>{mov.depositoOrigen?.nombre}</span>
                                            <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                                            <span className="truncate max-w-[120px]" title={mov.depositoDestino?.nombre}>{mov.depositoDestino?.nombre}</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-2 text-right">
                                            {new Date(mov.fecha).toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}
