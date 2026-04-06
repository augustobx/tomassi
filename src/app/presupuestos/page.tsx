"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
    ClipboardList, Search, Plus, Loader2, X, Eye, Ban, Trash2, Printer,
    ArrowRightLeft, Calendar, User, DollarSign, FileText, Clock, CheckCircle2
} from "lucide-react";
import Link from "next/link";

import { getPresupuestos, cancelarPresupuesto, eliminarPresupuesto } from "@/app/actions/presupuestos";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const ESTADO_BADGES: Record<string, { label: string; color: string }> = {
    PENDIENTE: { label: "Pendiente", color: "bg-amber-100 text-amber-700 border-amber-200" },
    CONVERTIDO: { label: "Convertido", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    CANCELADO: { label: "Cancelado", color: "bg-red-100 text-red-700 border-red-200" },
    VENCIDO: { label: "Vencido", color: "bg-slate-100 text-slate-500 border-slate-200" },
};

export default function PresupuestosPage() {
    const [isPending, startTransition] = useTransition();
    const [presupuestos, setPresupuestos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [searchTerm, setSearchTerm] = useState("");
    const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");

    const cargar = () => {
        startTransition(async () => {
            const res = await getPresupuestos({
                termino: searchTerm,
                estado: estadoFiltro,
                fecha_desde: fechaDesde || undefined,
                fecha_hasta: fechaHasta || undefined,
            });
            if (res.success) setPresupuestos(res.data || []);
            else toast.error(res.error);
            setLoading(false);
        });
    };

    useEffect(() => { cargar(); }, []);

    const handleBuscar = () => { setLoading(true); cargar(); };

    const handleCancelar = (id: number) => {
        if (!confirm("¿Cancelar este presupuesto?")) return;
        startTransition(async () => {
            const res = await cancelarPresupuesto(id);
            if (res.success) { toast.success("Presupuesto cancelado."); cargar(); }
            else toast.error(res.error);
        });
    };

    const handleEliminar = (id: number) => {
        if (!confirm("¿Eliminar este presupuesto definitivamente?")) return;
        startTransition(async () => {
            const res = await eliminarPresupuesto(id);
            if (res.success) { toast.success("Presupuesto eliminado."); cargar(); }
            else toast.error(res.error);
        });
    };

    if (loading) return <div className="flex justify-center mt-32"><Loader2 className="animate-spin h-8 w-8 text-emerald-600" /></div>;

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto min-h-[calc(100vh-6rem)] pb-12">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl gap-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-xl">
                        <ClipboardList className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Presupuestos</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Cotizaciones y presupuestos previos para clientes.</p>
                    </div>
                </div>
                <Link href="/presupuestos/nuevo">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm">
                        <Plus className="h-4 w-4 mr-2" /> Nuevo Presupuesto
                    </Button>
                </Link>
            </div>

            {/* FILTROS */}
            <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Buscar cliente</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input placeholder="Nombre o DNI..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 bg-slate-50" />
                        </div>
                    </div>
                    <div className="w-40 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Estado</Label>
                        <Select value={estadoFiltro} onValueChange={(v) => setEstadoFiltro(v || "")}>
                            <SelectTrigger className="h-9 bg-slate-50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="TODOS">Todos</SelectItem>
                                <SelectItem value="PENDIENTE">Pendientes</SelectItem>
                                <SelectItem value="CONVERTIDO">Convertidos</SelectItem>
                                <SelectItem value="CANCELADO">Cancelados</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-36 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Desde</Label>
                        <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="h-9 bg-slate-50" />
                    </div>
                    <div className="w-36 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Hasta</Label>
                        <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="h-9 bg-slate-50" />
                    </div>
                    <Button onClick={handleBuscar} disabled={isPending} className="bg-slate-900 text-white h-9 px-6">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />} Filtrar
                    </Button>
                </CardContent>
            </Card>

            {/* LISTA */}
            <div className="space-y-3">
                {presupuestos.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 bg-white border border-dashed rounded-xl">
                        <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-base font-medium">No se encontraron presupuestos</p>
                        <p className="text-sm mt-1">Cree uno nuevo o ajuste los filtros.</p>
                    </div>
                ) : (
                    presupuestos.map((p: any) => {
                        const estado = ESTADO_BADGES[p.estado] || ESTADO_BADGES.PENDIENTE;
                        const fecha = new Date(p.fecha).toLocaleDateString('es-AR');
                        const vigenciaFin = new Date(p.fecha);
                        vigenciaFin.setDate(vigenciaFin.getDate() + (p.vigencia_dias || 15));
                        const vigenciaStr = vigenciaFin.toLocaleDateString('es-AR');
                        const vencido = p.estado === 'PENDIENTE' && new Date() > vigenciaFin;

                        return (
                            <Card key={p.id} className={`shadow-sm border-slate-200 bg-white hover:border-emerald-200 transition-colors ${vencido ? 'opacity-60' : ''}`}>
                                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-emerald-50 p-2 rounded-lg"><FileText className="h-5 w-5 text-emerald-600" /></div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-sm text-slate-900">Presup. Nº {String(p.numero).padStart(6, '0')}</p>
                                                    <Badge variant="outline" className={`text-[10px] font-bold ${estado.color}`}>
                                                        {vencido ? "Vencido" : estado.label}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {p.cliente?.nombre_razon_social || 'N/A'}</span>
                                                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {fecha}</span>
                                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Vigencia: {vigenciaStr}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase font-bold text-slate-400">Total</p>
                                            <p className="text-lg font-black text-emerald-600">${p.total.toFixed(2)}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <Link href={`/presupuestos/${p.id}`}>
                                                <Button variant="outline" size="sm" className="h-8 text-xs border-slate-200">
                                                    <Eye className="h-3 w-3 mr-1" /> Ver
                                                </Button>
                                            </Link>
                                            {p.estado === 'PENDIENTE' && (
                                                <>
                                                    <Button variant="outline" size="sm" className="h-8 text-xs text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => handleCancelar(p.id)}>
                                                        <Ban className="h-3 w-3 mr-1" /> Cancelar
                                                    </Button>
                                                </>
                                            )}
                                            {p.estado !== 'CONVERTIDO' && (
                                                <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleEliminar(p.id)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
