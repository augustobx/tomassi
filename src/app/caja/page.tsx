"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
    Wallet, Plus, Minus, Lock, Unlock, AlertCircle,
    CreditCard, Landmark, ArrowRightLeft, DollarSign, Loader2, Clock, CalendarDays
} from "lucide-react";

import { getCajaActiva, abrirCaja, cerrarCaja, registrarMovimientoManual, getHistorialCajas } from "@/app/actions/caja";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSucursales } from "@/app/actions/configuracion";
import { getClientSession } from "@/app/actions/auth";

export default function CajaDiariaPage() {
    const [isPending, startTransition] = useTransition();
    const [caja, setCaja] = useState<any | null>(null);
    const [historialCajas, setHistorialCajas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Estados de formularios
    const [montoApertura, setMontoApertura] = useState("");
    const [montoCierre, setMontoCierre] = useState("");

    // Modales
    const [showModalMovimiento, setShowModalMovimiento] = useState(false);
    const [showModalCierre, setShowModalCierre] = useState(false);
    const [tipoMov, setTipoMov] = useState<"INGRESO_MANUAL" | "EGRESO_MANUAL">("EGRESO_MANUAL");
    const [montoMov, setMontoMov] = useState("");
    const [descMov, setDescMov] = useState("");

    const [cajaHistoricaSeleccionada, setCajaHistoricaSeleccionada] = useState<any | null>(null);
    const [showModalHistorial, setShowModalHistorial] = useState(false);

    const [usuarioSesion, setUsuarioSesion] = useState<any>(null);
    const [sucursales, setSucursales] = useState<any[]>([]);
    const [sucursalActivaId, setSucursalActivaId] = useState<number | null>(null);

    const cargarDatos = async (sId?: number | null) => {
        const idToUse = sId ?? sucursalActivaId;
        if (!idToUse) return; // No intentamos cargar si no hay sucursalActiva disponible
        
        setLoading(true);
        startTransition(async () => {
            const resCaja = await getCajaActiva(idToUse);
            if (resCaja?.success && resCaja.data) setCaja(resCaja.data); else setCaja(null);

            const resHistorial = await getHistorialCajas(idToUse);
            if (resHistorial?.success && resHistorial.data) setHistorialCajas(resHistorial.data); else setHistorialCajas([]);

            setLoading(false);
        });
    };

    useEffect(() => {
        const init = async () => {
            const session = await getClientSession();
            setUsuarioSesion(session);
            
            const sucs = await getSucursales();
            setSucursales(sucs);
            
            if (session?.sucursalId) {
                setSucursalActivaId(Number(session.sucursalId));
                cargarDatos(Number(session.sucursalId));
            } else if (sucs.length > 0) {
                setSucursalActivaId(sucs[0].id);
                cargarDatos(sucs[0].id);
            } else {
                setLoading(false);
            }
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Efecto para recargar datos si el admin cambia de sucursal
    useEffect(() => {
        if (sucursalActivaId) {
            cargarDatos(sucursalActivaId);
        }
    }, [sucursalActivaId]);

    const handleAbrirCaja = () => {
        if (!montoApertura) return toast.error("Ingrese el monto inicial (cambio en cajón).");
        if (!sucursalActivaId) return toast.error("Debe tener una sucursal activa.");
        
        startTransition(async () => {
            const res = await abrirCaja(Number(montoApertura), sucursalActivaId);
            if (res.success) {
                toast.success("¡Turno Abierto Exitosamente!");
                setMontoApertura("");
                cargarDatos(sucursalActivaId);
            } else toast.error(res.error);
        });
    };

    const handleMovimientoManual = () => {
        if (!montoMov || !descMov) return toast.error("Complete el monto y la descripción.");
        startTransition(async () => {
            const res = await registrarMovimientoManual(caja.id, tipoMov, Number(montoMov), descMov);
            if (res.success) {
                toast.success("Movimiento registrado correctamente.");
                setShowModalMovimiento(false);
                setMontoMov(""); setDescMov("");
                cargarDatos(sucursalActivaId);
            } else toast.error(res.error);
        });
    };

    const handleCerrarCaja = () => {
        if (!montoCierre) return toast.error("Debe ingresar cuánto efectivo físico contó en el cajón.");
        startTransition(async () => {
            const res = await cerrarCaja(caja.id, Number(montoCierre));
            if (res.success) {
                toast.success("Turno Cerrado", {
                    description: res.data?.diferencia === 0
                        ? `¡Caja perfecta! Ganancia de este turno: $${res.data?.ganancia?.toFixed(2)}`
                        : `Diferencia: $${res.data?.diferencia?.toFixed(2)} | Ganancia: $${res.data?.ganancia?.toFixed(2)}`
                });
                setShowModalCierre(false);
                setMontoCierre("");
                cargarDatos(sucursalActivaId);
            } else toast.error(res.error);
        });
    };

    const verMovimientosCajaAnterior = async (cajaCerrada: any) => {
        // Necesitamos cargar los movimientos porque el backend getHistorialCajas
        // probablemente no los trae por cuestiones de rendimiento.
        startTransition(async () => {
            setCajaHistoricaSeleccionada(cajaCerrada);
            setShowModalHistorial(true);
        });
    };

    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalTransferencia = 0;
    let totalEgresos = 0;

    if (caja) {
        caja.movimientos.forEach((m: any) => {
            if (m.metodo_pago === 'CONTADO') {
                if (m.tipo === 'EGRESO_MANUAL') {
                    totalEfectivo -= m.monto;
                    totalEgresos += m.monto;
                } else {
                    totalEfectivo += m.monto;
                }
            } else if (m.metodo_pago === 'TARJETA') {
                totalTarjeta += m.monto;
            } else if (m.metodo_pago === 'TRANSFERENCIA') {
                totalTransferencia += m.monto;
            }
        });
    }

    if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>;

    return (
        <>
            {/* VISTAS PRINCIPALES */}
            {!caja ? (
                // ==========================================
                // VISTA 1: CAJA CERRADA (APERTURA + HISTORIAL)
                // ==========================================
                <div className="flex flex-col gap-8 max-w-5xl mx-auto min-h-[calc(100vh-6rem)] relative">
                
                {/* SELECTOR DE SUCURSAL PARA ADMIN */}
                {usuarioSesion?.rol === 'ADMIN' && (
                    <div className="absolute -top-14 right-0 w-[250px] z-10 bg-white/50 backdrop-blur-md rounded-xl p-1 shadow-sm border border-slate-200">
                        <Select value={String(sucursalActivaId || "")} onValueChange={(val) => setSucursalActivaId(Number(val))}>
                            <SelectTrigger className="border-none h-8 font-semibold shadow-none bg-transparent">
                                <SelectValue placeholder="Sucursal..." />
                            </SelectTrigger>
                            <SelectContent>
                                {sucursales.map(s => (
                                    <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* BLOQUE DE APERTURA */}
                <div className="flex flex-col md:flex-row gap-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-8 rounded-2xl shadow-sm mt-8">
                    <div className="flex-1 space-y-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-zinc-800 pb-6 md:pb-0 md:pr-6">
                        <div className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-xl w-fit mb-4">
                            <Lock className="h-8 w-8 text-slate-400" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white">Turno Cerrado</h2>
                        <p className="text-slate-500 text-sm">El sistema de facturación está bloqueado. El horario y fecha de apertura quedarán registrados automáticamente al iniciar.</p>
                    </div>

                    <div className="flex-1 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="font-bold text-xs uppercase text-slate-500 tracking-wider">Declarar Efectivo Inicial ($)</Label>
                            <Input
                                type="number" autoFocus value={montoApertura} onChange={e => setMontoApertura(e.target.value)}
                                className="h-14 text-2xl font-black text-center bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" placeholder="Ej: 5000"
                            />
                        </div>
                        <Button size="lg" className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 font-bold text-base shadow-sm" disabled={isPending} onClick={handleAbrirCaja}>
                            {isPending ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Unlock className="h-5 w-5 mr-2" />}
                            Abrir Turno Ahora
                        </Button>
                    </div>
                </div>

                {/* HISTORIAL DE TURNOS */}
                <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 py-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-slate-700 dark:text-slate-200">
                            <CalendarDays className="h-5 w-5 text-indigo-500" /> Historial de Turnos Anteriores
                        </CardTitle>
                    </CardHeader>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 text-slate-500 border-b border-slate-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-3 font-semibold">Apertura (Horario)</th>
                                    <th className="px-6 py-3 font-semibold">Cierre (Horario)</th>
                                    <th className="px-6 py-3 font-semibold text-right">Efectivo Declarado</th>
                                    <th className="px-6 py-3 font-semibold text-right">Diferencia</th>
                                    <th className="px-6 py-3 font-semibold text-right">Ganancia</th>
                                    <th className="px-6 py-3 font-semibold text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {historialCajas.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-slate-400">No hay registros de turnos anteriores.</td>
                                    </tr>
                                ) : (
                                    historialCajas.map((c) => (
                                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-6 py-3">
                                                <p className="font-semibold text-slate-700 dark:text-slate-300">{new Date(c.fecha_apertura).toLocaleDateString('es-AR')}</p>
                                                <p className="text-xs text-slate-500 font-mono mt-0.5">{new Date(c.fecha_apertura).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</p>
                                            </td>
                                            <td className="px-6 py-3">
                                                <p className="font-semibold text-slate-700 dark:text-slate-300">{new Date(c.fecha_cierre).toLocaleDateString('es-AR')}</p>
                                                <p className="text-xs text-slate-500 font-mono mt-0.5">{new Date(c.fecha_cierre).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</p>
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono font-medium">${c.saldo_real?.toFixed(2)}</td>
                                            <td className="px-6 py-3 text-right">
                                                <Badge variant="outline" className={`font-mono ${c.diferencia === 0 ? 'text-slate-500 bg-slate-100' : c.diferencia && c.diferencia < 0 ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>
                                                    {c.diferencia && c.diferencia > 0 ? '+' : ''}{c.diferencia?.toFixed(2)}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                ${(c.ganancia || 0).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold" onClick={() => verMovimientosCajaAnterior(c)}>
                                                    Ver Detalle
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

            </div>
            ) : (
                // ==========================================
                // VISTA 2: CAJA ABIERTA (DASHBOARD MODERNO)
                // ==========================================
                <div className="flex flex-col gap-6 w-full min-h-[calc(100vh-6rem)] relative">
                    
                    {/* Opcional: El selector aquí también si el admin quiere cambiar, pero generalmente cierra antes */}

            {/* HEADER CAJA */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl gap-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl">
                        <Wallet className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Caja en Operación</h2>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mt-1">
                            <Clock className="h-3.5 w-3.5" />
                            Abierto a las {new Date(caja.fecha_apertura).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <Button variant="outline" className="flex-1 md:w-auto border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium shadow-sm" onClick={() => { setTipoMov('EGRESO_MANUAL'); setShowModalMovimiento(true); }}>
                        <ArrowRightLeft className="h-4 w-4 mr-2 text-orange-500" /> Retiro / Gasto
                    </Button>
                    <Button className="flex-1 md:w-auto bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm" onClick={() => setShowModalCierre(true)}>
                        <Lock className="h-4 w-4 mr-2" /> Cerrar Turno
                    </Button>
                </div>
            </div>

            {/* MÉTRICAS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="shadow-sm border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-500/5 relative overflow-hidden">
                    <CardContent className="p-5">
                        <p className="text-[11px] font-bold uppercase text-indigo-600/80 tracking-wider">Efectivo en Cajón</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-2">${totalEfectivo.toFixed(2)}</h3>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg"><Landmark className="h-5 w-5 text-blue-600" /></div>
                        <div>
                            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Transferencias</p>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">${totalTransferencia.toFixed(2)}</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="p-2.5 bg-slate-100 dark:bg-zinc-800 rounded-lg"><CreditCard className="h-5 w-5 text-slate-600" /></div>
                        <div>
                            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Tarjetas</p>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">${totalTarjeta.toFixed(2)}</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 rounded-lg"><Minus className="h-5 w-5 text-orange-500" /></div>
                        <div>
                            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Salidas / Gastos</p>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">${totalEgresos.toFixed(2)}</h3>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* LISTA DE MOVIMIENTOS */}
            <Card className="flex-1 shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 py-3 px-4">
                    <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Auditoría del Turno</CardTitle>
                </CardHeader>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 sticky top-0 z-10 text-slate-500 border-b border-slate-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Hora</th>
                                <th className="px-6 py-3 font-semibold">Concepto</th>
                                <th className="px-6 py-3 font-semibold text-center">Medio</th>
                                <th className="px-6 py-3 font-semibold text-center">Cajero</th>
                                <th className="px-6 py-3 font-semibold text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {caja.movimientos.map((mov: any) => {
                                const esIngreso = ['APERTURA', 'INGRESO_MANUAL', 'VENTA', 'COBRO_CC'].includes(mov.tipo);
                                return (
                                    <tr key={mov.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-3 font-mono text-slate-400 text-xs">
                                            {new Date(mov.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-3">
                                            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{mov.descripcion}</p>
                                            <Badge variant="outline" className="text-[9px] mt-1 bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500">{mov.tipo.replace('_', ' ')}</Badge>
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <Badge variant="secondary" className="font-bold text-[10px] bg-slate-100 text-slate-600">{mov.metodo_pago}</Badge>
                                        </td>
                                        <td className="px-6 py-3 text-center font-mono text-[10px] text-slate-500 uppercase">
                                            {mov.usuario?.nombre || 'SISTEMA'}
                                        </td>
                                        <td className={`px-6 py-3 text-right font-black text-base ${esIngreso ? 'text-slate-900 dark:text-white' : 'text-orange-600'}`}>
                                            {esIngreso ? '+' : '-'}${mov.monto.toFixed(2)}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
        )}

        {/* MODALES LOCALIZADOS EN SCOPE GLOBAL PARA AMBAS VISTAS */}
        {/* MODAL RETIRO / INGRESO */}
        {showModalMovimiento && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                <Card className="w-full max-w-sm shadow-xl border border-slate-200 dark:border-zinc-800">
                    <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-4">
                        <CardTitle className="text-base flex items-center gap-2"><ArrowRightLeft className="text-orange-500 h-4 w-4" /> Registrar Salida</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="font-semibold text-sm">Monto a retirar ($)</Label>
                            <Input type="number" autoFocus value={montoMov} onChange={e => setMontoMov(e.target.value)} className="h-11 text-lg font-bold text-center border-slate-200" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="font-semibold text-sm">Motivo del retiro</Label>
                            <Input value={descMov} onChange={e => setDescMov(e.target.value)} placeholder="Ej: Pago a proveedor..." className="bg-slate-50 h-10" />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setShowModalMovimiento(false)} className="w-1/3">Cancelar</Button>
                            <Button onClick={handleMovimientoManual} disabled={isPending} className="w-2/3 bg-slate-900 hover:bg-slate-800 text-white font-medium">Guardar Retiro</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {/* MODAL CIERRE DE CAJA */}
        {showModalCierre && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in zoom-in-95">
                <Card className="w-full max-w-sm shadow-xl border border-slate-200 dark:border-zinc-800">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5 text-center">
                        <div className="mx-auto bg-slate-200/50 w-12 h-12 rounded-full flex items-center justify-center mb-3">
                            <Lock className="h-5 w-5 text-slate-700" />
                        </div>
                        <CardTitle className="text-xl font-bold">Cierre de Turno</CardTitle>
                        <CardDescription className="text-xs">Declare el efectivo exacto que hay en el cajón.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Efectivo Físico Contado ($)</Label>
                            <Input type="number" autoFocus value={montoCierre} onChange={e => setMontoCierre(e.target.value)} className="h-14 text-2xl font-black text-center bg-white border-slate-300 focus-visible:ring-slate-400" />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setShowModalCierre(false)} className="w-1/3 h-11">Volver</Button>
                            <Button onClick={handleCerrarCaja} disabled={isPending} className="w-2/3 h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium">Finalizar Turno</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {/* MODAL DETALLES CAJA HISTÓRICA */}
        {showModalHistorial && cajaHistoricaSeleccionada && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in zoom-in-95">
                <Card className="w-full max-w-3xl shadow-xl border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[85vh] overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold">Detalle de Turno</CardTitle>
                            <CardDescription className="text-xs">
                                Apertura: {new Date(cajaHistoricaSeleccionada.fecha_apertura).toLocaleString('es-AR')} | 
                                Cierre: {cajaHistoricaSeleccionada.fecha_cierre ? new Date(cajaHistoricaSeleccionada.fecha_cierre).toLocaleString('es-AR') : 'Sin cierre'}
                            </CardDescription>
                        </div>
                        <Button variant="ghost" onClick={() => setShowModalHistorial(false)}>Cerrar</Button>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-auto bg-slate-50">
                        {/* Acá podríamos colocar los movimientos, pero requerirá un endpoint si no los trajimos.
                            Por simplicidad y dado que ya incluímos "movimientos" en la consulta si lo modificamos, lo renderizamos aquí. */}
                        {!cajaHistoricaSeleccionada.movimientos ? (
                            <div className="p-8 text-center text-slate-500">Los movimientos completos deben ser solicitados al servidor (cargar en actions).</div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] uppercase tracking-wider bg-slate-100 sticky top-0 z-10 text-slate-500">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold">Hora</th>
                                        <th className="px-6 py-3 font-semibold">Concepto</th>
                                        <th className="px-6 py-3 font-semibold text-center">Medio</th>
                                        <th className="px-6 py-3 font-semibold text-center">Cajero</th>
                                        <th className="px-6 py-3 font-semibold text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {cajaHistoricaSeleccionada.movimientos.map((mov: any) => {
                                        const esIngreso = ['APERTURA', 'INGRESO_MANUAL', 'VENTA', 'COBRO_CC'].includes(mov.tipo);
                                        return (
                                            <tr key={mov.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-2 font-mono text-slate-400 text-xs">
                                                    {new Date(mov.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-6 py-2">
                                                    <p className="font-semibold text-slate-700 text-xs">{mov.descripcion}</p>
                                                    <Badge variant="outline" className="text-[9px] mt-0.5 text-slate-500">{mov.tipo.replace('_', ' ')}</Badge>
                                                </td>
                                                <td className="px-6 py-2 text-center">
                                                    <Badge variant="secondary" className="font-bold text-[9px] bg-slate-100">{mov.metodo_pago}</Badge>
                                                </td>
                                                <td className="px-6 py-2 text-center font-mono text-[9px] text-slate-500 uppercase">
                                                    {mov.usuario?.nombre || 'SISTEMA'}
                                                </td>
                                                <td className={`px-6 py-2 text-right font-black text-sm ${esIngreso ? 'text-slate-900' : 'text-orange-600'}`}>
                                                    {esIngreso ? '+' : '-'}${mov.monto.toFixed(2)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>
            </div>
        )}
        </>
    );
}