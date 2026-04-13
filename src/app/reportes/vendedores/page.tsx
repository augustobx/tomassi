"use client";

import { useState, useEffect, useTransition } from "react";
import { obtenerRendimiento } from "@/app/actions/rendimiento-vendedores";
import {
    Users, Calendar, Filter, TrendingUp, AlertOctagon,
    BadgeDollarSign, Search, FileText, Download, Wallet
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ========================================================
// REGLAS DE NEGOCIO PARA COMISIONES (Editables)
// ========================================================
const COMISION_BASE = 0.05; // 5% de comisión estándar
const UMBRAL_DESCUENTO_MAX = 10; // Si el DTO global supera el 10%, hay penalización
const PENALIZACION = 0.02; // Restar 2% a la comisión si hay exceso de descuento

export default function RendimientoVendedoresPage() {
    const [isPending, startTransition] = useTransition();

    // Filtros
    const [fechaDesde, setFechaDesde] = useState(() => {
        const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
    });
    const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0]);
    const [vendedorId, setVendedorId] = useState<number | "TODOS">("TODOS");
    const [clienteId, setClienteId] = useState<number | "TODOS">("TODOS");

    // Datos
    const [ventas, setVentas] = useState<any[]>([]);
    const [recibos, setRecibos] = useState<any[]>([]);
    const [vendedores, setVendedores] = useState<any[]>([]);
    const [clientes, setClientes] = useState<any[]>([]);

    const cargarDatos = () => {
        startTransition(async () => {
            const res = await obtenerRendimiento({ fechaDesde, fechaHasta, vendedorId, clienteId });
            if (res.success) {
                // SOLUCIÓN: Agregamos || [] para que TypeScript confíe en que nunca será undefined
                setVentas(res.ventas || []);
                setRecibos(res.recibos || []);
                setVendedores(res.vendedores || []);
                setClientes(res.clientes || []);
            }
        });
    };

    // Carga inicial
    useEffect(() => {
        cargarDatos();
    }, []);

    // ========================================================
    // CÁLCULOS DINÁMICOS
    // ========================================================
    const metricas = ventas.reduce((acc, v) => {
        const dtoPorcentaje = v.subtotal > 0 ? (v.descuento_global / v.subtotal) * 100 : 0;

        let porcentajeComision = COMISION_BASE;
        let esPenalizado = false;

        // Regla de penalización por descuentos agresivos
        if (dtoPorcentaje > UMBRAL_DESCUENTO_MAX) {
            porcentajeComision = Math.max(0, COMISION_BASE - PENALIZACION);
            esPenalizado = true;
            acc.operacionesPenalizadas++;
        }

        const comisionGenerada = v.total * porcentajeComision;

        acc.totalVendido += v.total;
        acc.comisionesTotales += comisionGenerada;
        if (esPenalizado) acc.totalPenalizaciones += (v.total * PENALIZACION);

        // Agregamos la info procesada al objeto de la venta para mostrarlo en la tabla
        v.dtoPorcentaje = dtoPorcentaje;
        v.comision = comisionGenerada;
        v.esPenalizado = esPenalizado;

        return acc;
    }, { totalVendido: 0, comisionesTotales: 0, totalPenalizaciones: 0, operacionesPenalizadas: 0 });

    const totalCobrado = recibos.reduce((acc, r) => acc + r.monto, 0);

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10">
            {/* ENCABEZADO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 border border-slate-200 p-5 rounded-2xl shadow-sm gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 p-3 rounded-xl"><TrendingUp className="h-6 w-6 text-indigo-600" /></div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Rendimiento de Vendedores</h2>
                        <p className="text-sm text-slate-500 font-medium">Análisis de comisiones, penalizaciones y cobros.</p>
                    </div>
                </div>
                <Button onClick={cargarDatos} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm">
                    {isPending ? 'Procesando...' : 'Aplicar Filtros'} <Filter className="ml-2 h-4 w-4" />
                </Button>
            </div>

            {/* BARRA DE FILTROS */}
            <Card className="shadow-sm border-slate-200">
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 block">Desde</label>
                        <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="h-11 bg-slate-50 border-slate-200 font-bold text-slate-700" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 block">Hasta</label>
                        <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="h-11 bg-slate-50 border-slate-200 font-bold text-slate-700" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 block">Vendedor / Operador</label>
                        <select className="w-full h-11 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-semibold" value={vendedorId} onChange={e => setVendedorId(e.target.value === "TODOS" ? "TODOS" : Number(e.target.value))}>
                            <option value="TODOS">TODOS LOS VENDEDORES</option>
                            {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre} ({v.rol})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 block">Cliente</label>
                        <select className="w-full h-11 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-semibold" value={clienteId} onChange={e => setClienteId(e.target.value === "TODOS" ? "TODOS" : Number(e.target.value))}>
                            <option value="TODOS">TODOS LOS CLIENTES</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_razon_social}</option>)}
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* MÉTRICAS GLOBALES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Facturación Bruta</p>
                            <h3 className="text-2xl font-black text-slate-900 mt-1">${metricas.totalVendido.toFixed(2)}</h3>
                            <p className="text-xs font-semibold text-slate-500 mt-1">{ventas.length} operaciones</p>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg text-slate-500"><FileText className="h-5 w-5" /></div>
                    </CardContent>
                </Card>

                <Card className="bg-emerald-50/50 border-emerald-100 shadow-sm">
                    <CardContent className="p-5 flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-black text-emerald-600/80 uppercase tracking-widest">Comisiones a Pagar</p>
                            <h3 className="text-2xl font-black text-emerald-700 mt-1">${metricas.comisionesTotales.toFixed(2)}</h3>
                            <p className="text-xs font-semibold text-emerald-600/70 mt-1">Base del {(COMISION_BASE * 100)}%</p>
                        </div>
                        <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg"><BadgeDollarSign className="h-5 w-5" /></div>
                    </CardContent>
                </Card>

                <Card className="bg-red-50/50 border-red-100 shadow-sm">
                    <CardContent className="p-5 flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-black text-red-600/80 uppercase tracking-widest">Penalizaciones Restadas</p>
                            <h3 className="text-2xl font-black text-red-700 mt-1">-${metricas.totalPenalizaciones.toFixed(2)}</h3>
                            <p className="text-xs font-semibold text-red-600/70 mt-1">{metricas.operacionesPenalizadas} ops con Dto {'>'} {UMBRAL_DESCUENTO_MAX}%</p>
                        </div>
                        <div className="bg-red-100 text-red-600 p-2 rounded-lg"><AlertOctagon className="h-5 w-5" /></div>
                    </CardContent>
                </Card>

                <Card className="bg-indigo-50/50 border-indigo-100 shadow-sm">
                    <CardContent className="p-5 flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-black text-indigo-600/80 uppercase tracking-widest">Cobranza Realizada (Cta. Cte.)</p>
                            <h3 className="text-2xl font-black text-indigo-700 mt-1">${totalCobrado.toFixed(2)}</h3>
                            <p className="text-xs font-semibold text-indigo-600/70 mt-1">{recibos.length} recibos generados</p>
                        </div>
                        <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg"><Wallet className="h-5 w-5" /></div>
                    </CardContent>
                </Card>
            </div>

            {/* TABLA DE OPERACIONES DETALLADA */}
            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText className="h-4 w-4 text-slate-500" /> Registro Detallado de Operaciones</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] uppercase tracking-wider bg-slate-50 text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="px-5 py-3 font-semibold">Fecha</th>
                                <th className="px-5 py-3 font-semibold">Vendedor</th>
                                <th className="px-5 py-3 font-semibold">Cliente</th>
                                <th className="px-5 py-3 font-semibold text-right">Facturado</th>
                                <th className="px-5 py-3 font-semibold text-center">Dto % Global</th>
                                <th className="px-5 py-3 font-semibold text-right">Comisión Gen.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {ventas.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-slate-400 font-medium">No hay ventas registradas con estos filtros.</td></tr>
                            ) : (
                                ventas.map((v) => (
                                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3 text-slate-500 font-medium whitespace-nowrap">{new Date(v.fecha_emision).toLocaleString()}</td>
                                        <td className="px-5 py-3 font-bold text-slate-800">{v.usuario?.nombre || "Sin Asignar"}</td>
                                        <td className="px-5 py-3 font-semibold text-slate-600 max-w-[200px] truncate" title={v.cliente?.nombre_razon_social}>{v.cliente?.nombre_razon_social}</td>
                                        <td className="px-5 py-3 text-right font-black text-slate-900">${v.total.toFixed(2)}</td>
                                        <td className="px-5 py-3 text-center">
                                            <Badge variant="outline" className={`font-mono text-[10px] ${v.esPenalizado ? 'text-red-600 bg-red-50 border-red-200' : 'text-slate-600 bg-white border-slate-200'}`}>
                                                {v.dtoPorcentaje.toFixed(1)}%
                                            </Badge>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <span className={`font-black ${v.esPenalizado ? 'text-orange-600' : 'text-emerald-600'}`}>
                                                ${v.comision.toFixed(2)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}