"use client";

import { useState, useEffect, useTransition } from "react";
import {
    BarChart4, Calendar, Loader2, TrendingUp, TrendingDown,
    Package, Users, Wallet, DollarSign, ArrowUpRight, ArrowDownRight, Tag,
    LineChart, ArrowUpCircle
} from "lucide-react";

import { getReporteMaestro } from "@/app/actions/reportes";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function ReportesMaestrosPage() {
    const [isPending, startTransition] = useTransition();
    const [datos, setDatos] = useState<any>(null);

    // Filtros de fecha (Por defecto: Mes actual)
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

    const [fechaDesde, setFechaDesde] = useState(primerDiaMes);
    const [fechaHasta, setFechaHasta] = useState(ultimoDiaMes);

    // Navegación interna (Pestañas) - INCLUYE 'INFLACION' AHORA
    const [tabActiva, setTabActiva] = useState<"RESUMEN" | "PRODUCTOS" | "CLIENTES" | "FINANZAS" | "INFLACION">("RESUMEN");

    const cargarDatos = () => {
        startTransition(async () => {
            const res = await getReporteMaestro({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta });
            if (res.success) setDatos(res.data);
        });
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    if (!datos && isPending) {
        return <div className="flex justify-center items-center h-[70vh]"><Loader2 className="h-10 w-10 animate-spin text-indigo-600" /></div>;
    }

    if (!datos) return null;

    const kpis = datos.kpis;
    const ranks = datos.rankings;

    // Utilidad para calcular el máximo de una lista (para las barras de progreso)
    const maxCantProd = Math.max(...ranks.topProductosVendidos.map((p: any) => p.cantidad), 1);
    const maxRentProd = Math.max(...ranks.topProductosRentables.map((p: any) => p.rentabilidad), 1);
    const maxClienteComp = Math.max(...ranks.topClientes.map((c: any) => c.comprado), 1);

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto min-h-[calc(100vh-6rem)] pb-12">

            {/* 1. HEADER Y SUPER FILTRO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl gap-4 shadow-sm sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl hidden sm:block">
                        <BarChart4 className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">Inteligencia de Negocio</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Analíticas completas. Los números no mienten.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto bg-slate-50 dark:bg-zinc-800/50 p-2 rounded-xl border border-slate-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400 ml-2" />
                        <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="h-9 bg-white border-none shadow-sm text-xs font-bold" />
                        <span className="text-slate-400 font-medium text-xs">A</span>
                        <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="h-9 bg-white border-none shadow-sm text-xs font-bold" />
                    </div>
                    <Button onClick={cargarDatos} disabled={isPending} className="w-full sm:w-auto h-9 bg-slate-900 text-white font-bold text-xs shadow-sm px-6">
                        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Analizar"}
                    </Button>
                </div>
            </div>

            {/* 2. PESTAÑAS DE NAVEGACIÓN (CORREGIDAS) */}
            <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
                <Button variant={tabActiva === "RESUMEN" ? "default" : "outline"} onClick={() => setTabActiva("RESUMEN")} className={`h-11 rounded-xl px-6 font-bold ${tabActiva === "RESUMEN" ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>
                    <TrendingUp className="h-4 w-4 mr-2" /> Visión Global
                </Button>
                <Button variant={tabActiva === "PRODUCTOS" ? "default" : "outline"} onClick={() => setTabActiva("PRODUCTOS")} className={`h-11 rounded-xl px-6 font-bold ${tabActiva === "PRODUCTOS" ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>
                    <Package className="h-4 w-4 mr-2" /> Productos y Stock
                </Button>
                <Button variant={tabActiva === "CLIENTES" ? "default" : "outline"} onClick={() => setTabActiva("CLIENTES")} className={`h-11 rounded-xl px-6 font-bold ${tabActiva === "CLIENTES" ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>
                    <Users className="h-4 w-4 mr-2" /> Top Clientes
                </Button>
                <Button variant={tabActiva === "FINANZAS" ? "default" : "outline"} onClick={() => setTabActiva("FINANZAS")} className={`h-11 rounded-xl px-6 font-bold ${tabActiva === "FINANZAS" ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>
                    <Wallet className="h-4 w-4 mr-2" /> Finanzas y Caja
                </Button>
                <Button variant={tabActiva === "INFLACION" ? "default" : "outline"} onClick={() => setTabActiva("INFLACION")} className={`h-11 rounded-xl px-6 font-bold ${tabActiva === "INFLACION" ? 'bg-red-600 text-white' : 'bg-white text-slate-600 border-red-100 hover:bg-red-50 hover:text-red-700'}`}>
                    <LineChart className="h-4 w-4 mr-2" /> Auditoría de Inflación
                </Button>
            </div>

            {/* =========================================================
                VISTA 1: RESUMEN GLOBAL (KPIs de Alto Impacto)
                ========================================================= */}
            {tabActiva === "RESUMEN" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-indigo-100 bg-indigo-50/30">
                            <CardContent className="p-6">
                                <p className="text-xs font-bold uppercase text-indigo-600/80 tracking-wider">Facturación Total</p>
                                <h3 className="text-3xl font-black text-slate-900 mt-2">${kpis.ingresosTotales.toFixed(2)}</h3>
                                <p className="text-xs font-semibold text-slate-500 mt-2">{kpis.ventasTotales} ventas concretadas</p>
                            </CardContent>
                        </Card>

                        <Card className="border-emerald-100 bg-emerald-50/30">
                            <CardContent className="p-6">
                                <p className="text-xs font-bold uppercase text-emerald-600/80 tracking-wider flex items-center justify-between">Ganancia Bruta <ArrowUpRight className="h-4 w-4" /></p>
                                <h3 className="text-3xl font-black text-slate-900 mt-2">${kpis.gananciaBruta.toFixed(2)}</h3>
                                <p className="text-xs font-semibold text-slate-500 mt-2">Margen promedio del <span className="text-emerald-600 font-bold">{kpis.margenPromedio.toFixed(1)}%</span></p>
                            </CardContent>
                        </Card>

                        <Card className="border-orange-100 bg-orange-50/30">
                            <CardContent className="p-6">
                                <p className="text-xs font-bold uppercase text-orange-600/80 tracking-wider flex items-center justify-between">Ticket Promedio <Tag className="h-4 w-4" /></p>
                                <h3 className="text-3xl font-black text-slate-900 mt-2">${kpis.ticketPromedio.toFixed(2)}</h3>
                                <p className="text-xs font-semibold text-slate-500 mt-2">Gasto promedio por cliente</p>
                            </CardContent>
                        </Card>

                        <Card className="border-red-100 bg-red-50/30">
                            <CardContent className="p-6">
                                <p className="text-xs font-bold uppercase text-red-600/80 tracking-wider flex items-center justify-between">Fugas de Capital <ArrowDownRight className="h-4 w-4" /></p>
                                <div className="mt-2 space-y-1">
                                    <div className="flex justify-between text-sm"><span className="font-medium text-slate-600">Gastos de Caja:</span><span className="font-bold text-red-600">${kpis.totalGastosCaja.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-sm"><span className="font-medium text-slate-600">Descuentos:</span><span className="font-bold text-red-600">${kpis.totalDescuentosOtorgados.toFixed(2)}</span></div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="shadow-sm border-slate-200">
                            <CardHeader className="bg-slate-50 border-b border-slate-100 p-4"><CardTitle className="text-sm">🔥 Los 5 Más Vendidos (Volumen)</CardTitle></CardHeader>
                            <CardContent className="p-0 divide-y divide-slate-100">
                                {ranks.topProductosVendidos.slice(0, 5).map((p: any, i: number) => (
                                    <div key={i} className="p-4 flex items-center justify-between">
                                        <span className="font-bold text-slate-800 text-sm truncate max-w-[60%]">{i + 1}. {p.nombre}</span>
                                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 font-black">{p.cantidad} uds</Badge>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-slate-200">
                            <CardHeader className="bg-slate-50 border-b border-slate-100 p-4"><CardTitle className="text-sm">👑 Los 5 Mejores Clientes</CardTitle></CardHeader>
                            <CardContent className="p-0 divide-y divide-slate-100">
                                {ranks.topClientes.slice(0, 5).map((c: any, i: number) => (
                                    <div key={i} className="p-4 flex items-center justify-between">
                                        <span className="font-bold text-slate-800 text-sm truncate max-w-[60%]">{i + 1}. {c.nombre}</span>
                                        <span className="font-black text-emerald-600">${c.comprado.toFixed(2)}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* =========================================================
                VISTA 2: PRODUCTOS (La cruda realidad del stock)
                ========================================================= */}
            {tabActiva === "PRODUCTOS" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* TOP RENTABLES */}
                    <Card className="shadow-sm border-emerald-200">
                        <CardHeader className="bg-emerald-50 border-b border-emerald-100 p-5">
                            <CardTitle className="text-base text-emerald-800 flex items-center gap-2"><DollarSign className="h-5 w-5" /> Los que dejan más plata (Ganancia Neta)</CardTitle>
                            <CardDescription>Productos que mayor rentabilidad acumularon en el período.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-5 space-y-5">
                            {ranks.topProductosRentables.map((p: any, index: number) => (
                                <div key={index} className="space-y-1.5">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-bold text-slate-700 truncate max-w-[70%]">{index + 1}. {p.nombre}</span>
                                        <span className="font-black text-emerald-600">${p.rentabilidad.toFixed(2)}</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(p.rentabilidad / maxRentProd) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        {/* TOP VENDIDOS */}
                        <Card className="shadow-sm border-slate-200">
                            <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
                                <CardTitle className="text-base text-slate-800 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-indigo-500" /> Los que más rotan (Volumen)</CardTitle>
                            </CardHeader>
                            <CardContent className="p-5 space-y-4">
                                {ranks.topProductosVendidos.slice(0, 7).map((p: any, index: number) => (
                                    <div key={index} className="space-y-1.5">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-bold text-slate-700 truncate max-w-[70%]">{p.nombre}</span>
                                            <span className="font-bold text-slate-500">{p.cantidad} unidades</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(p.cantidad / maxCantProd) * 100}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* PEOR VENDIDOS / STOCK MUERTO */}
                        <Card className="shadow-sm border-red-200">
                            <CardHeader className="bg-red-50 border-b border-red-100 p-5">
                                <CardTitle className="text-base text-red-800 flex items-center gap-2"><TrendingDown className="h-5 w-5" /> Stock Muerto (Menos vendidos)</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 divide-y divide-red-100">
                                {ranks.productosMenosVendidos.map((p: any, index: number) => (
                                    <div key={index} className="p-3 px-5 flex justify-between items-center bg-white">
                                        <span className="font-semibold text-xs text-slate-700">{p.nombre}</span>
                                        <div className="text-right">
                                            <span className="block text-[10px] font-bold text-red-500 uppercase">Vendidos: {p.cantidad}</span>
                                            <span className="block text-[10px] font-medium text-slate-400">Stock actual: {p.stock_clavado}</span>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* =========================================================
                VISTA 3: CLIENTES
                ========================================================= */}
            {tabActiva === "CLIENTES" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* TOP CLIENTES */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
                            <CardTitle className="text-base text-slate-800 flex items-center gap-2"><Users className="h-5 w-5 text-indigo-500" /> Ranking de Compradores</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-5">
                            {ranks.topClientes.map((c: any, index: number) => (
                                <div key={index} className="space-y-1.5">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-bold text-slate-700 truncate max-w-[70%]">{index + 1}. {c.nombre}</span>
                                        <span className="font-black text-indigo-600">${c.comprado.toFixed(2)}</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(c.comprado / maxClienteComp) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* TOP DEUDORES */}
                    <Card className="shadow-sm border-orange-200">
                        <CardHeader className="bg-orange-50 border-b border-orange-100 p-5">
                            <CardTitle className="text-base text-orange-800 flex items-center gap-2"><Wallet className="h-5 w-5" /> Alerta de Deudores (Top Deuda Viva)</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 divide-y divide-orange-100">
                            {ranks.topDeudores.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 font-medium">No hay deudas registradas en este período.</div>
                            ) : (
                                ranks.topDeudores.map((c: any, index: number) => (
                                    <div key={index} className="p-4 px-5 flex justify-between items-center bg-white hover:bg-orange-50/30">
                                        <span className="font-bold text-sm text-slate-800">{index + 1}. {c.nombre}</span>
                                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-black text-sm">
                                            Debe: ${c.adeudado.toFixed(2)}
                                        </Badge>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* =========================================================
                VISTA 4: FINANZAS (Medios de pago y composición)
                ========================================================= */}
            {tabActiva === "FINANZAS" && (
                <div className="max-w-3xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
                            <CardTitle className="text-base text-slate-800 flex items-center gap-2"><Wallet className="h-5 w-5 text-indigo-500" /> Composición de los Ingresos</CardTitle>
                            <CardDescription>¿Cómo te pagaron los clientes en este período?</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            {Object.keys(datos.mediosDePago).length === 0 ? (
                                <p className="text-center text-slate-400">No hay pagos registrados.</p>
                            ) : (
                                Object.entries(datos.mediosDePago)
                                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                                    .map(([metodo, monto], index) => {
                                        const porcentaje = ((monto as number) / kpis.ingresosTotales) * 100;
                                        return (
                                            <div key={index} className="space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <p className="font-bold text-sm uppercase text-slate-700 tracking-wider">{metodo.replace('_', ' ')}</p>
                                                        <p className="text-xs font-semibold text-slate-400">{porcentaje.toFixed(1)}% del total</p>
                                                    </div>
                                                    <span className="font-black text-xl text-slate-900">${(monto as number).toFixed(2)}</span>
                                                </div>
                                                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-slate-800 rounded-full" style={{ width: `${porcentaje}%` }}></div>
                                                </div>
                                            </div>
                                        )
                                    })
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* =========================================================
                VISTA 5: AUDITORÍA DE INFLACIÓN (Histórico de Precios)
                ========================================================= */}
            {tabActiva === "INFLACION" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-red-200 bg-red-50/50">
                            <CardContent className="p-6">
                                <p className="text-xs font-bold uppercase text-red-600 tracking-wider flex items-center gap-1"><ArrowUpCircle className="h-4 w-4" /> Inflación Promedio</p>
                                <h3 className="text-3xl font-black text-slate-900 mt-2">{kpis.inflacionPromedio.toFixed(1)}%</h3>
                                <p className="text-xs font-semibold text-slate-500 mt-2">Aumento medio en este período.</p>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 bg-white md:col-span-2">
                            <CardContent className="p-6 flex flex-col justify-center h-full">
                                <p className="text-sm font-bold text-slate-800">Caja Negra de Costos</p>
                                <p className="text-xs text-slate-500 mt-1">Este módulo audita automáticamente todos los aumentos masivos o ediciones de facturas de proveedores. Te permite buscar fechas pasadas y entender por qué subieron tus precios de góndola.</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] uppercase tracking-wider bg-slate-50 text-slate-500 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Fecha y Hora</th>
                                        <th className="px-6 py-4 font-semibold">Producto afectado</th>
                                        <th className="px-6 py-4 font-semibold">Motivo del ajuste</th>
                                        <th className="px-6 py-4 font-semibold text-right">Costo Anterior</th>
                                        <th className="px-6 py-4 font-semibold text-right">Costo Nuevo</th>
                                        <th className="px-6 py-4 font-semibold text-center">Variación</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {datos.historialPrecios.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-10 text-slate-400">No hubo cambios de precio en el período seleccionado.</td></tr>
                                    ) : (
                                        datos.historialPrecios.map((hist: any) => {
                                            const esAumento = hist.porcentaje_cambio > 0;
                                            return (
                                                <tr key={hist.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                                        {new Date(hist.fecha).toLocaleDateString('es-AR')} <span className="text-[10px] ml-1">{new Date(hist.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-slate-800 line-clamp-1">{hist.producto.nombre_producto}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono">Cód: {hist.producto.codigo_articulo}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-semibold text-slate-600">{hist.motivo}</td>
                                                    <td className="px-6 py-4 text-right font-medium text-slate-500">${hist.precio_costo_anterior.toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-right font-black text-slate-900">${hist.precio_costo_nuevo.toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <Badge className={`${esAumento ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'} font-black`}>
                                                            {esAumento ? '+' : ''}{hist.porcentaje_cambio.toFixed(1)}%
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

        </div>
    );
}