"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
    History, Search, Receipt, Printer, FileText,
    Loader2, X, CalendarDays, User, ArrowRight, ArrowLeftRight, CheckCircle2,
    CheckSquare, Square
} from "lucide-react";

import { getHistorialVentas } from "@/app/actions/historial";
import { procesarDevolucion } from "@/app/actions/ventas";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


export default function HistorialVentasPage() {
    const [isPending, startTransition] = useTransition();
    const [ventas, setVentas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [termino, setTermino] = useState("");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");
    const [tipoComprobante, setTipoComprobante] = useState("TODOS");

    // Estado del Modal de Detalle
    const [ventaSeleccionada, setVentaSeleccionada] = useState<any | null>(null);

    // Estados para el Panel de Devolución
    const [modoDevolucion, setModoDevolucion] = useState(false);
    const [cantidadesDevolver, setCantidadesDevolver] = useState<Record<number, number>>({});
    const [metodoReembolso, setMetodoReembolso] = useState<"CAJA" | "CUENTA_CORRIENTE">("CAJA");
    const [imprimirConDescuentos, setImprimirConDescuentos] = useState(true);

    const cargarHistorial = () => {
        setLoading(true);
        startTransition(async () => {
            const res = await getHistorialVentas({ termino, fecha_desde: fechaDesde, fecha_hasta: fechaHasta, tipo_comprobante: tipoComprobante });
            if (res.success && res.data) setVentas(res.data);
            else toast.error(res.error);
            setLoading(false);
        });
    };

    useEffect(() => {
        const timer = setTimeout(() => { cargarHistorial(); }, 400);
        return () => clearTimeout(timer);
    }, [termino, fechaDesde, fechaHasta, tipoComprobante]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const buscar = params.get("buscar");
            if (buscar) setTermino(buscar);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const abrir = params.get("abrir");
            const buscar = params.get("buscar");

            if (abrir === 'true' && ventas.length > 0 && !ventaSeleccionada) {
                const ventaEncontrada = ventas.find(v => String(v.numero_comprobante) === buscar);
                if (ventaEncontrada) {
                    setVentaSeleccionada(ventaEncontrada);
                    window.history.replaceState({}, '', '/historial');
                }
            }
        }
    }, [ventas]);

    // Manejo de Cantidades en la Devolución
    const handleCambiarCantidadDevolucion = (detalleId: number, cantidadDevuelta: number, cantidadMax: number) => {
        if (cantidadDevuelta < 0) cantidadDevuelta = 0;
        if (cantidadDevuelta > cantidadMax) cantidadDevuelta = cantidadMax;
        setCantidadesDevolver(prev => ({ ...prev, [detalleId]: cantidadDevuelta }));
    };

    // Calcular la plata a devolver basado en lo que seleccionó
    let montoTotalReembolso = 0;
    if (modoDevolucion && ventaSeleccionada) {
        ventaSeleccionada.detalles.forEach((det: any) => {
            const cant = cantidadesDevolver[det.id] || 0;
            montoTotalReembolso += (cant * det.precio_final);
        });
        // Aplicar descuento global proporcional si lo hubo
        if (ventaSeleccionada.descuento_global > 0) {
            const proporcionDescuento = ventaSeleccionada.descuento_global / ventaSeleccionada.subtotal;
            montoTotalReembolso = montoTotalReembolso * (1 - proporcionDescuento);
        }
    }

    const handleConfirmarDevolucion = () => {
        if (montoTotalReembolso <= 0) return toast.error("Debe seleccionar al menos 1 producto para devolver.");

        const items = ventaSeleccionada.detalles
            .filter((det: any) => (cantidadesDevolver[det.id] || 0) > 0)
            .map((det: any) => ({
                productoId: det.producto.id,
                cantidad: cantidadesDevolver[det.id],
                nombre: det.producto.nombre_producto
            }));

        startTransition(async () => {
            const res = await procesarDevolucion({
                ventaId: ventaSeleccionada.id,
                clienteId: ventaSeleccionada.cliente.id,
                itemsDevueltos: items,
                montoReembolso: montoTotalReembolso,
                metodoReembolso: metodoReembolso
            });

            if (res.success) {
                toast.success("¡Devolución Procesada!", { description: "Stock restaurado y saldo actualizado." });
                setVentaSeleccionada(null);
                setModoDevolucion(false);
                cargarHistorial();
            } else {
                toast.error(res.error);
            }
        });
    };

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto min-h-[calc(100vh-6rem)]">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl gap-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl">
                        <History className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Historial de Ventas</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Consultá comprobantes, reimprimí tickets y procesá devoluciones.</p>
                    </div>
                </div>
            </div>

            {/* FILTROS */}
            <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <CardContent className="p-4 flex flex-col lg:flex-row gap-4 items-end">
                    <div className="flex-1 w-full space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Buscar Comprobante</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input placeholder="Nº Factura, Nombre de cliente o DNI..." value={termino} onChange={(e) => setTermino(e.target.value)} className="pl-9 h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" />
                        </div>
                    </div>
                    <div className="w-full lg:w-[160px] space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Fecha Desde</Label>
                        <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" />
                    </div>
                    <div className="w-full lg:w-[160px] space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Fecha Hasta</Label>
                        <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" />
                    </div>
                    <div className="w-full lg:w-[180px] space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Comprobante</Label>
                        <Select
                            value={tipoComprobante}
                            onValueChange={(val) => setTipoComprobante(val ?? "")}>
                            <SelectTrigger className="h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700">
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="TODOS">Todos</SelectItem>
                                <SelectItem value="FACTURA_A">Factura A</SelectItem>
                                <SelectItem value="FACTURA_B">Factura B</SelectItem>
                                <SelectItem value="FACTURA_C">Factura C</SelectItem>
                                <SelectItem value="COMPROBANTE_X">Ticket No Fiscal (X)</SelectItem>
                                <SelectItem value="PRESUPUESTO">Presupuesto</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" onClick={() => { setTermino(""); setFechaDesde(""); setFechaHasta(""); setTipoComprobante("TODOS"); }} className="w-full lg:w-auto h-10 border-slate-200 text-slate-600 hover:bg-slate-50">Limpiar</Button>
                </CardContent>
            </Card>

            {/* TABLA DE VENTAS */}
            <Card className="flex-1 shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 sticky top-0 z-10 text-slate-500 border-b border-slate-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Comprobante y Fecha</th>
                                <th className="px-6 py-4 font-semibold">Cliente</th>
                                <th className="px-6 py-4 font-semibold text-center">Vendedor</th>
                                <th className="px-6 py-4 font-semibold text-center">Estado y Medio</th>
                                <th className="px-6 py-4 font-semibold text-right">Total</th>
                                <th className="px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {loading ? (
                                <tr><td colSpan={5} className="text-center py-16"><Loader2 className="animate-spin h-8 w-8 text-indigo-500 mx-auto" /></td></tr>
                            ) : ventas.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-16 text-slate-400">
                                        <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                        <p className="text-base font-medium">No se encontraron comprobantes.</p>
                                    </td>
                                </tr>
                            ) : (
                                ventas.map((v) => {
                                    const estaPagado = v.estado_pago === 'PAGADO';
                                    const esPendiente = v.estado_pago === 'PENDIENTE';

                                    return (
                                        <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-slate-100 dark:bg-zinc-800 p-2 rounded-lg text-slate-500 hidden sm:block"><Receipt className="h-4 w-4" /></div>
                                                    <div>
                                                        <p className="font-bold text-sm text-slate-900 dark:text-white">
                                                            {v.tipo_comprobante.replace('_', ' ')} <span className="text-slate-400 font-normal ml-1">000{v.punto_venta}-{String(v.numero_comprobante).padStart(8, '0')}</span>
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-1">
                                                            <CalendarDays className="h-3 w-3" /> {new Date(v.fecha_emision).toLocaleDateString('es-AR')} a las {new Date(v.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1">{v.cliente.nombre_razon_social}</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">DNI/CUIT: {v.cliente.dni_cuit || "Consumidor Final"}</p>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <p className="text-[10px] uppercase font-mono text-slate-500 font-bold bg-slate-100 dark:bg-zinc-800 rounded px-2 py-1 inline-block">
                                                    {v.usuario?.nombre || 'SISTEMA'}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider ${estaPagado ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : esPendiente ? 'text-red-600 bg-red-50 border-red-200' : 'text-orange-600 bg-orange-50 border-orange-200'}`}>
                                                        {v.estado_pago}
                                                    </Badge>
                                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{v.metodo_pago.replace('_', ' ')}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <p className="font-black text-lg text-slate-900 dark:text-white">${v.total.toFixed(2)}</p>
                                                {!estaPagado && <p className="text-[10px] text-red-500 font-bold mt-0.5">Debe: ${v.saldo_pendiente?.toFixed(2)}</p>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Button
                                                    onClick={() => { setVentaSeleccionada(v); setModoDevolucion(false); setCantidadesDevolver({}); }}
                                                    variant="ghost" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold text-xs"
                                                >
                                                    Ver Detalles <ArrowRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>


            {/* =========================================================================
          MODAL DE DETALLE Y DEVOLUCIÓN
          ========================================================================= */}
            {ventaSeleccionada && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden">

                        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-900 shrink-0">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                    <FileText className="h-5 w-5 text-indigo-500" /> Detalle de Comprobante
                                </h3>
                                <div className="text-xs text-slate-500 mt-2 space-y-1">
                                    <p><span className="font-semibold text-slate-700 dark:text-slate-300">Comprobante:</span> {ventaSeleccionada.tipo_comprobante.replace('_', ' ')} Nº 000{ventaSeleccionada.punto_venta}-{String(ventaSeleccionada.numero_comprobante).padStart(8, '0')}</p>
                                    <p><span className="font-semibold text-slate-700 dark:text-slate-300">Emitido el:</span> {new Date(ventaSeleccionada.fecha_emision).toLocaleString('es-AR')}</p>
                                    <p><span className="font-semibold text-slate-700 dark:text-slate-300">Cajero / Vendedor:</span> <span className="font-mono uppercase">{ventaSeleccionada.usuario?.nombre || 'SISTEMA'}</span></p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setVentaSeleccionada(null)} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-200">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-0 flex flex-col md:flex-row">

                            {/* Columna Izquierda: Artículos */}
                            <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-slate-100 dark:border-zinc-800">
                                <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-1">
                                    Artículos Facturados {modoDevolucion && <span className="text-orange-500 ml-2">(Seleccione a devolver)</span>}
                                </h4>

                                <div className="space-y-3">
                                    {ventaSeleccionada.detalles.map((det: any) => (
                                        <div key={det.id} className={`flex justify-between items-center p-3 rounded-xl border transition-colors ${modoDevolucion && cantidadesDevolver[det.id] > 0 ? 'bg-orange-50/50 border-orange-200' : 'bg-slate-50 dark:bg-zinc-800/30 border-slate-100 dark:border-zinc-800'}`}>
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{det.producto.nombre_producto}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Pagado: {det.cantidad} x ${det.precio_final.toFixed(2)}
                                                </p>
                                            </div>

                                            {modoDevolucion ? (
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-[10px] font-bold uppercase text-slate-400">Devuelve:</Label>
                                                    <Input
                                                        type="number" min="0" max={det.cantidad}
                                                        value={cantidadesDevolver[det.id] || 0}
                                                        onChange={(e) => handleCambiarCantidadDevolucion(det.id, Number(e.target.value), det.cantidad)}
                                                        className="h-9 w-20 text-center font-bold border-orange-200 focus-visible:ring-orange-500 text-orange-700 bg-white"
                                                    />
                                                </div>
                                            ) : (
                                                <p className="font-black text-base text-slate-900 dark:text-white">${det.subtotal.toFixed(2)}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Notas históricas (ej: marca de devolución previa) */}
                                {ventaSeleccionada.notas_venta && (
                                    <div className="mt-6 p-4 bg-yellow-50/50 border border-yellow-100 rounded-xl">
                                        <p className="text-[10px] uppercase font-bold text-yellow-600 mb-1">Notas del Sistema</p>
                                        <p className="text-xs text-slate-700 whitespace-pre-wrap">{ventaSeleccionada.notas_venta}</p>
                                    </div>
                                )}
                            </div>

                            {/* Columna Derecha: Acciones / Reembolso */}
                            <div className="w-full md:w-[340px] bg-slate-50/50 dark:bg-zinc-900/50 p-5 flex flex-col justify-between">

                                {!modoDevolucion ? (
                                    // VISTA NORMAL: RESUMEN Y BOTONES
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1"><User className="h-3.5 w-3.5" /> Cliente</h4>
                                            <div className="bg-white dark:bg-zinc-800 p-3 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm">
                                                <p className="font-bold text-sm">{ventaSeleccionada.cliente.nombre_razon_social}</p>
                                                <p className="text-xs text-slate-500 mt-1">DNI/CUIT: {ventaSeleccionada.cliente.dni_cuit || "N/A"}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>${ventaSeleccionada.subtotal.toFixed(2)}</span></div>
                                            {ventaSeleccionada.descuento_global > 0 && <div className="flex justify-between text-sm text-emerald-600 font-medium"><span>Desc. Global</span><span>-${ventaSeleccionada.descuento_global.toFixed(2)}</span></div>}
                                            <Separator className="bg-slate-200" />
                                            <div className="flex justify-between items-center"><span className="font-bold text-slate-900">TOTAL</span><span className="text-2xl font-black text-indigo-600">${ventaSeleccionada.total.toFixed(2)}</span></div>
                                        </div>

                                        <div className="pt-4 space-y-2 border-t border-slate-200">

                                            {/* TOGGLE PARA DESCUENTOS */}
                                            <div
                                                onClick={() => setImprimirConDescuentos(!imprimirConDescuentos)}
                                                className="flex items-center gap-2 p-2.5 mb-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                                            >
                                                {imprimirConDescuentos ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4 text-slate-400" />}
                                                <span className="text-xs font-medium text-slate-700 select-none">Detallar descuentos en el ticket</span>
                                            </div>

                                            <div className="flex gap-2 mb-2">
                                                <a href={`/imprimir/ticket/${ventaSeleccionada.id}?descuentos=${imprimirConDescuentos}`} className="flex-1">
                                                    <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium px-2">
                                                        <Printer className="h-4 w-4 mr-2" /> 80mm
                                                    </Button>
                                                </a>
                                                <a href={`/imprimir/a4/${ventaSeleccionada.id}?descuentos=${imprimirConDescuentos}`} className="flex-1">
                                                    <Button variant="outline" className="w-full bg-white border-slate-200 text-slate-700 font-medium hover:bg-slate-50 px-2">
                                                        <FileText className="h-4 w-4 mr-2" /> A4
                                                    </Button>
                                                </a>
                                            </div>
                                            <Button variant="ghost" onClick={() => setModoDevolucion(true)} className="w-full mt-4 text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-semibold border border-dashed border-orange-200">
                                                <ArrowLeftRight className="h-4 w-4 mr-2" /> Iniciar Devolución
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    // VISTA DEVOLUCIÓN: PANEL DE REEMBOLSO
                                    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-200">
                                        <div>
                                            <h4 className="font-bold text-xs uppercase text-orange-500 tracking-wider mb-2 flex items-center gap-1"><ArrowLeftRight className="h-4 w-4" /> Reembolso</h4>
                                            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border-2 border-orange-200 shadow-sm text-center">
                                                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Monto a devolver al cliente</p>
                                                <p className="text-3xl font-black text-slate-900 dark:text-white">${montoTotalReembolso.toFixed(2)}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-xs font-bold text-slate-700">¿Cómo se reintegra el valor?</Label>
                                            <div className="grid grid-cols-1 gap-2">
                                                <div
                                                    onClick={() => setMetodoReembolso("CAJA")}
                                                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${metodoReembolso === "CAJA" ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'}`}
                                                >
                                                    <p className="font-bold text-sm text-slate-900">Efectivo (Caja)</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">Se retirará plata de la caja diaria operativa.</p>
                                                </div>
                                                <div
                                                    onClick={() => setMetodoReembolso("CUENTA_CORRIENTE")}
                                                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${metodoReembolso === "CUENTA_CORRIENTE" ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'}`}
                                                >
                                                    <p className="font-bold text-sm text-slate-900">Nota de Crédito (Cuenta)</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">Se descontará de la deuda del cliente.</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4 space-y-2 border-t border-slate-200 flex gap-2">
                                            <Button variant="outline" onClick={() => setModoDevolucion(false)} className="w-1/3 bg-white">Volver</Button>
                                            <Button onClick={handleConfirmarDevolucion} disabled={isPending || montoTotalReembolso <= 0} className="w-2/3 bg-orange-600 hover:bg-orange-700 text-white font-bold">
                                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Confirmar
                                            </Button>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}