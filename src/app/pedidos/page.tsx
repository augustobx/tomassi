"use client";

import { useState, useEffect } from "react";
import { obtenerTodosLosPedidos, cambiarEstadoPedidoAdmin, editarPedidoAdmin } from "@/app/actions/pedidos";
import { buscarProductos } from "@/app/actions/ventas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, ClipboardList, CheckCircle2, Ban, Receipt, User, Clock, Package, X, FileText, CreditCard, Edit, Calendar, Plus, Minus } from "lucide-react";

export default function AdminPedidosPage() {
    const [pedidos, setPedidos] = useState<any[]>([]);
    const [filtroEstado, setFiltroEstado] = useState<string>("PENDIENTE");
    const [query, setQuery] = useState("");
    const [filtroDesde, setFiltroDesde] = useState("");
    const [filtroHasta, setFiltroHasta] = useState("");
    const [filtroVendedor, setFiltroVendedor] = useState("TODOS");

    const [pedidoActivo, setPedidoActivo] = useState<any>(null);
    const [cargando, setCargando] = useState(false);

    // Modal de edición
    const [modalEditar, setModalEditar] = useState(false);
    const [carritoEditar, setCarritoEditar] = useState<any[]>([]);
    const [queryProducto, setQueryProducto] = useState("");
    const [productosBuscados, setProductosBuscados] = useState<any[]>([]);

    // Modal de facturación
    const [modalFacturar, setModalFacturar] = useState(false);
    const [tipoComprobanteSeleccionado, setTipoComprobanteSeleccionado] = useState("COMPROBANTE_X");

    useEffect(() => {
        cargarPedidos();
    }, []);

    const cargarPedidos = async () => {
        const data = await obtenerTodosLosPedidos();
        setPedidos(data);

        // Auto-seleccionar el primer pedido pendiente si existe y no hay nada seleccionado
        if (!pedidoActivo) {
            const primerPendiente = data.find((p: any) => p.estado === 'PENDIENTE');
            if (primerPendiente) setPedidoActivo(primerPendiente);
        }
    };

    const vendedores = Array.from(new Set(pedidos.map(p => p.usuario?.nombre).filter(Boolean)));

    const pedidosFiltrados = pedidos.filter(p => {
        const coincideEstado = filtroEstado === "TODOS" || p.estado === filtroEstado;
        const coincideVendedor = filtroVendedor === "TODOS" || p.usuario?.nombre === filtroVendedor;
        const coincideQuery = p.cliente?.nombre_razon_social.toLowerCase().includes(query.toLowerCase()) ||
            p.usuario?.nombre.toLowerCase().includes(query.toLowerCase()) ||
            p.numero.toString().includes(query);

        let coincideFecha = true;
        if (filtroDesde) {
            coincideFecha = coincideFecha && new Date(p.fecha) >= new Date(filtroDesde + "T00:00:00");
        }
        if (filtroHasta) {
            coincideFecha = coincideFecha && new Date(p.fecha) <= new Date(filtroHasta + "T23:59:59");
        }

        return coincideEstado && coincideVendedor && coincideQuery && coincideFecha;
    });

    // Lógica Modal Editar
    const abrirModalEditar = () => {
        setCarritoEditar(pedidoActivo.detalles.map((d: any) => ({
            productoId: d.productoId,
            codigo_articulo: d.producto?.codigo_articulo,
            nombre: d.producto?.nombre_producto,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario,
            descuento_individual: d.descuento_individual,
            precio_final: d.precio_final,
            subtotal: d.subtotal
        })));
        setModalEditar(true);
    };

    useEffect(() => {
        if (queryProducto.length > 2) {
            buscarProductos(queryProducto).then(setProductosBuscados);
        } else {
            setProductosBuscados([]);
        }
    }, [queryProducto]);

    const ajustarCantidadEditar = (idx: number, delta: number) => {
        const nuevos = [...carritoEditar];
        nuevos[idx].cantidad += delta;
        if (nuevos[idx].cantidad <= 0) {
            nuevos.splice(idx, 1);
        } else {
            nuevos[idx].precio_final = nuevos[idx].precio_unitario * (1 - nuevos[idx].descuento_individual / 100);
            nuevos[idx].subtotal = nuevos[idx].precio_final * nuevos[idx].cantidad;
        }
        setCarritoEditar(nuevos);
    };

    const agregarProductoEditar = (prod: any) => {
        const alicuota = prod.alicuota_iva || 21;
        // Precio base aproximado (Costo + IVA + Margen)
        const margen = pedidoActivo.listaPrecio?.margen_defecto || 0;
        const precio = prod.precio_costo * (1 + (alicuota / 100)) * (1 + (margen / 100));

        setCarritoEditar([...carritoEditar, {
            productoId: prod.id,
            codigo_articulo: prod.codigo_articulo,
            nombre: prod.nombre_producto,
            cantidad: 1,
            precio_unitario: precio,
            descuento_individual: 0,
            precio_final: precio,
            subtotal: precio
        }]);
        setQueryProducto("");
        setProductosBuscados([]);
    };

    const guardarEdicion = async () => {
        setCargando(true);
        const subtotal = carritoEditar.reduce((acc, item) => acc + item.subtotal, 0);
        const total = subtotal - (pedidoActivo.descuento_global || 0);

        const toastId = toast.loading(`Guardando cambios en pedido #${pedidoActivo.numero}...`);
        const res = await editarPedidoAdmin(pedidoActivo.id, carritoEditar, subtotal, total, pedidoActivo.notas || "");
        if (res.success) {
            toast.success("Pedido editado correctamente", { id: toastId });
            await cargarPedidos();
            setModalEditar(false);
            setPedidoActivo(null);
        } else {
            toast.error(res.error, { id: toastId });
        }
        setCargando(false);
    };

    const procesarPedido = async (nuevoEstado: 'APROBADO' | 'RECHAZADO') => {
        if (!pedidoActivo) return;

        if (nuevoEstado === 'RECHAZADO' && !confirm("¿Seguro que querés RECHAZAR este pedido? Se devolverá el stock al inventario.")) return;

        setCargando(true);
        const toastId = toast.loading(`Procesando pedido #${pedidoActivo.numero}...`);

        const res = await cambiarEstadoPedidoAdmin(pedidoActivo.id, nuevoEstado);

        if (res.success) {
            toast.success(`Pedido ${nuevoEstado} correctamente.`, { id: toastId });
            await cargarPedidos();
            setPedidoActivo(null);
        } else {
            toast.error(res.error, { id: toastId });
        }
        setCargando(false);
    };

    const facturarPedido = async () => {
        if (!pedidoActivo) return;
        setCargando(true);
        setModalFacturar(false);

        const toastId = toast.loading(`Facturando pedido #${pedidoActivo.numero} como ${tipoComprobanteSeleccionado.replace('_', ' ')}...`);

        const res = await cambiarEstadoPedidoAdmin(pedidoActivo.id, 'FACTURADO', tipoComprobanteSeleccionado);

        if (res.success) {
            toast.success(`Pedido FACTURADO correctamente como ${tipoComprobanteSeleccionado.replace('_', ' ')}.`, { id: toastId });
            await cargarPedidos();
            setPedidoActivo(null);
        } else {
            toast.error(res.error, { id: toastId });
        }
        setCargando(false);
    };

    const abrirModalFacturar = () => {
        // Pre-seleccionar tipo de comprobante basado en el cliente
        const condicion = pedidoActivo?.cliente?.condicion_iva || "CONSUMIDOR_FINAL";
        if (condicion === "RESPONSABLE_INSCRIPTO") {
            setTipoComprobanteSeleccionado("FACTURA_A");
        } else if (condicion === "MONOTRIBUTISTA") {
            setTipoComprobanteSeleccionado("FACTURA_A");
        } else {
            setTipoComprobanteSeleccionado("COMPROBANTE_X");
        }
        setModalFacturar(true);
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'PENDIENTE': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'APROBADO': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'FACTURADO': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'RECHAZADO':
            case 'CANCELADO': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-zinc-100 text-zinc-700 border-zinc-200';
        }
    };

    const getMetodoPagoLabel = (metodo: string) => {
        return metodo === 'CUENTA_CORRIENTE' ? 'CTA. CTE.' : 'EFECTIVO';
    };

    const getMetodoPagoColor = (metodo: string) => {
        return metodo === 'CUENTA_CORRIENTE' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700';
    };

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-2rem)] gap-6 p-2">

            {/* PANEL IZQUIERDO: LISTA DE PEDIDOS */}
            <div className="w-full md:w-1/3 flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="font-black text-lg text-slate-800 flex items-center mb-4">
                        <ClipboardList className="mr-2 h-5 w-5 text-indigo-600" /> Recepción de Pedidos
                    </h2>

                    {/* Botonera Filtros Rápidos */}
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1 hide-scrollbar">
                        {['PENDIENTE', 'APROBADO', 'FACTURADO', 'TODOS'].map(est => (
                            <Button
                                key={est}
                                variant={filtroEstado === est ? "default" : "outline"}
                                size="sm"
                                className={`text-[10px] font-bold rounded-lg h-7 px-3 ${filtroEstado === est ? 'bg-indigo-600 hover:bg-indigo-700' : 'text-slate-500'}`}
                                onClick={() => setFiltroEstado(est)}
                            >
                                {est}
                            </Button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="relative">
                            <Calendar className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
                            <Input type="date" className="pl-8 h-8 text-xs bg-white rounded-xl" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
                            <Input type="date" className="pl-8 h-8 text-xs bg-white rounded-xl" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
                        </div>
                    </div>

                    <div className="flex gap-2 mb-2">
                        <select
                            className="w-1/3 h-8 px-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-600 outline-none"
                            value={filtroVendedor}
                            onChange={(e) => setFiltroVendedor(e.target.value)}
                        >
                            <option value="TODOS">Vendedor...</option>
                            {vendedores.map(v => <option key={v as string} value={v as string}>{v as string}</option>)}
                        </select>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Buscar por cliente o #" className="pl-9 h-8 bg-white text-xs rounded-xl" value={query} onChange={(e) => setQuery(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/30">
                    {pedidosFiltrados.map(p => (
                        <div
                            key={p.id}
                            onClick={() => setPedidoActivo(p)}
                            className={`p-3 rounded-xl cursor-pointer border transition-all ${pedidoActivo?.id === p.id ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'bg-white border-slate-100 hover:border-indigo-100 hover:bg-slate-50'}`}
                        >
                            <div className="flex justify-between items-start mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${getEstadoColor(p.estado)}`}>
                                        {p.estado}
                                    </span>
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${getMetodoPagoColor(p.metodo_pago)}`}>
                                        {getMetodoPagoLabel(p.metodo_pago)}
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold">#{p.numero}</span>
                            </div>
                            <p className="font-bold text-sm text-slate-800 leading-tight mb-1">{p.cliente?.nombre_razon_social}</p>
                            <div className="flex justify-between items-end mt-2">
                                <div className="flex items-center text-[10px] text-slate-500 font-medium">
                                    <User className="w-3 h-3 mr-1" /> {p.usuario?.nombre}
                                </div>
                                <span className="font-black text-indigo-700">${p.total.toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                    {pedidosFiltrados.length === 0 && (
                        <div className="text-center p-8 text-slate-400 font-medium text-sm">No hay pedidos para mostrar.</div>
                    )}
                </div>
            </div>

            {/* PANEL DERECHO: DETALLE DEL PEDIDO (MESA DE TRABAJO) */}
            <div className="w-full md:w-2/3 flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
                {!pedidoActivo ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                        <Package className="w-20 h-20 mb-4 opacity-50" />
                        <p className="font-semibold text-slate-400">Seleccioná un pedido de la lista para gestionarlo</p>
                    </div>
                ) : (
                    <>
                        {/* Cabecera del Detalle */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50 shrink-0">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-2xl font-black text-slate-900">Pedido #{pedidoActivo.numero}</h2>
                                    <span className={`text-xs font-black px-3 py-1 rounded-lg border ${getEstadoColor(pedidoActivo.estado)}`}>
                                        {pedidoActivo.estado}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-slate-500 flex items-center">
                                    <Clock className="w-4 h-4 mr-1" /> {new Date(pedidoActivo.fecha).toLocaleString('es-AR')}
                                </p>
                            </div>

                            {/* BOTONERA DE ACCIÓN ADMIN */}
                            {pedidoActivo.estado === 'PENDIENTE' && (
                                <div className="flex gap-2">
                                    <Button disabled={cargando} onClick={abrirModalEditar} variant="outline" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold">
                                        <Edit className="w-4 h-4 mr-2" /> Editar
                                    </Button>
                                    <Button disabled={cargando} onClick={() => procesarPedido('RECHAZADO')} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 font-bold">
                                        <Ban className="w-4 h-4 mr-2" /> Rechazar
                                    </Button>
                                    <Button disabled={cargando} onClick={() => procesarPedido('APROBADO')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md">
                                        <CheckCircle2 className="w-4 h-4 mr-2" /> Aprobar (Preparar)
                                    </Button>
                                    <Button disabled={cargando} onClick={abrirModalFacturar} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-md">
                                        <Receipt className="w-4 h-4 mr-2" /> Facturar y Cerrar
                                    </Button>
                                </div>
                            )}
                            {pedidoActivo.estado === 'APROBADO' && (
                                <div className="flex gap-2">
                                    <Button disabled={cargando} onClick={abrirModalEditar} variant="outline" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold">
                                        <Edit className="w-4 h-4 mr-2" /> Editar
                                    </Button>
                                    <Button disabled={cargando} onClick={abrirModalFacturar} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-md">
                                        <Receipt className="w-4 h-4 mr-2" /> Facturar (Ya entregado)
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Cuerpo del Detalle (Scroll) */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* Tarjetas de Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <Card className="border-slate-200 shadow-none">
                                    <CardHeader className="p-4 pb-2"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Datos del Cliente</p></CardHeader>
                                    <CardContent className="p-4 pt-0">
                                        <p className="font-bold text-slate-800 text-base">{pedidoActivo.cliente?.nombre_razon_social}</p>
                                        <p className="text-xs text-slate-500 mt-1">CUIT: {pedidoActivo.cliente?.dni_cuit || 'N/A'}</p>
                                        <p className="text-xs text-slate-500 mt-1">Lista: {pedidoActivo.listaPrecio?.nombre}</p>
                                    </CardContent>
                                </Card>
                                <Card className="border-slate-200 shadow-none">
                                    <CardHeader className="p-4 pb-2"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Información Interna</p></CardHeader>
                                    <CardContent className="p-4 pt-0">
                                        <p className="font-bold text-slate-800 text-base flex items-center"><User className="w-4 h-4 mr-2 text-slate-400" /> Vendedor: {pedidoActivo.usuario?.nombre}</p>

                                        {/* Referencia a la venta generada */}
                                        {pedidoActivo.ventaId && (
                                            <div className="mt-2 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                                                <p className="text-xs font-bold text-emerald-700 flex items-center">
                                                    <FileText className="w-3.5 h-3.5 mr-1" /> Venta generada: ID #{pedidoActivo.ventaId}
                                                </p>
                                            </div>
                                        )}

                                        <div className="mt-3 bg-amber-50 p-3 rounded-lg border border-amber-100">
                                            <p className="text-[10px] font-bold text-amber-700 uppercase mb-1">Notas del Pedido:</p>
                                            <p className="text-xs text-amber-900 whitespace-pre-wrap">{pedidoActivo.notas || 'Sin notas.'}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Tabla de Artículos */}
                            <div>
                                <h3 className="font-black text-slate-800 mb-3 border-b pb-2">Artículos Solicitados ({pedidoActivo.detalles.length})</h3>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs">
                                            <tr>
                                                <th className="px-4 py-3">Código</th>
                                                <th className="px-4 py-3">Producto</th>
                                                <th className="px-4 py-3 text-center">Cant.</th>
                                                <th className="px-4 py-3 text-right">Unitario</th>
                                                <th className="px-4 py-3 text-center">Dto %</th>
                                                <th className="px-4 py-3 text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {pedidoActivo.detalles.map((item: any, idx: number) => (
                                                <tr key={idx} className="bg-white hover:bg-slate-50">
                                                    <td className="px-4 py-3 text-xs text-slate-400">{item.producto?.codigo_articulo}</td>
                                                    <td className="px-4 py-3 font-semibold text-slate-700">{item.producto?.nombre_producto}</td>
                                                    <td className="px-4 py-3 text-center font-black">{item.cantidad}</td>
                                                    <td className="px-4 py-3 text-right text-slate-500">${item.precio_unitario.toFixed(2)}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {item.descuento_individual > 0 ? (
                                                            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold">{item.descuento_individual}%</span>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-black text-emerald-600">${item.subtotal.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Footer Total */}
                        <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Método de Pago</p>
                                <span className={`text-xs font-black px-3 py-1 rounded-lg ${getMetodoPagoColor(pedidoActivo.metodo_pago)}`}>
                                    {pedidoActivo.metodo_pago === 'CUENTA_CORRIENTE' ? 'CUENTA CORRIENTE' : 'EFECTIVO'}
                                </span>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total a Pagar</p>
                                <p className="text-3xl font-black text-indigo-900">${pedidoActivo.total.toFixed(2)}</p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ========= MODAL DE FACTURACIÓN — SELECTOR DE COMPROBANTE ========= */}
            {modalFacturar && pedidoActivo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">

                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Receipt className="h-5 w-5 text-emerald-600" /> Facturar Pedido #{pedidoActivo.numero}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">{pedidoActivo.cliente?.nombre_razon_social} — ${pedidoActivo.total.toFixed(2)}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setModalFacturar(false)} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-200">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5">

                            {/* Info del pago */}
                            <div className="flex gap-4">
                                <div className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Método de Pago</p>
                                    <p className={`font-black text-sm ${pedidoActivo.metodo_pago === 'CUENTA_CORRIENTE' ? 'text-indigo-700' : 'text-emerald-700'}`}>
                                        <CreditCard className="w-4 h-4 inline mr-1" />
                                        {pedidoActivo.metodo_pago === 'CUENTA_CORRIENTE' ? 'CUENTA CORRIENTE' : 'EFECTIVO'}
                                    </p>
                                </div>
                                <div className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Total</p>
                                    <p className="font-black text-xl text-slate-900">${pedidoActivo.total.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* Aviso CC */}
                            {pedidoActivo.metodo_pago === 'CUENTA_CORRIENTE' && (
                                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                                    <p className="text-xs text-indigo-700 font-semibold">
                                        💳 Se generará un CARGO de ${pedidoActivo.total.toFixed(2)} en la Cuenta Corriente de {pedidoActivo.cliente?.nombre_razon_social}.
                                    </p>
                                </div>
                            )}

                            {/* Selector de tipo comprobante */}
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-3">Tipo de Comprobante</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: "COMPROBANTE_X", label: "Comprobante X", desc: "Interno (sin AFIP)" },
                                        { id: "FACTURA_A", label: "Factura A", desc: "Resp. Inscripto" },
                                        { id: "FACTURA_B", label: "Factura B", desc: "Consumidor Final" },
                                        { id: "FACTURA_C", label: "Factura C", desc: "Monotributo" },
                                    ].map(tipo => (
                                        <button
                                            key={tipo.id}
                                            type="button"
                                            onClick={() => setTipoComprobanteSeleccionado(tipo.id)}
                                            className={`p-3 rounded-xl border-2 text-left transition-all ${tipoComprobanteSeleccionado === tipo.id
                                                    ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                                                    : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            <p className={`font-bold text-sm ${tipoComprobanteSeleccionado === tipo.id ? 'text-emerald-800' : 'text-slate-700'}`}>
                                                {tipo.label}
                                            </p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">{tipo.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Aviso AFIP */}
                            {["FACTURA_A", "FACTURA_B", "FACTURA_C"].includes(tipoComprobanteSeleccionado) && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                    <p className="text-xs text-amber-700 font-semibold">
                                        ⚡ Se emitirá factura electrónica a AFIP. Verificá que los datos del cliente sean correctos (CUIT/DNI, Condición IVA).
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setModalFacturar(false)} className="bg-white">
                                Cancelar
                            </Button>
                            <Button
                                disabled={cargando}
                                onClick={facturarPedido}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-md px-8"
                            >
                                <Receipt className="w-4 h-4 mr-2" /> Confirmar Facturación
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========= MODAL EDITAR PEDIDO ADMIN ========= */}
            {modalEditar && pedidoActivo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Edit className="h-5 w-5 text-indigo-600" /> Editar Pedido #{pedidoActivo.numero}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">Cliente: {pedidoActivo.cliente?.nombre_razon_social}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setModalEditar(false)} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-200">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">

                            {/* Buscador de Productos */}
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Buscar producto para agregar..."
                                    className="pl-9 h-10 bg-slate-50 border-slate-200 rounded-xl"
                                    value={queryProducto}
                                    onChange={(e) => setQueryProducto(e.target.value)}
                                />
                                {productosBuscados.length > 0 && (
                                    <div className="absolute top-11 left-0 right-0 bg-white border border-slate-200 shadow-xl rounded-xl z-10 max-h-48 overflow-y-auto divide-y divide-slate-100">
                                        {productosBuscados.map(prod => (
                                            <div key={prod.id} className="p-3 hover:bg-slate-50 flex justify-between items-center cursor-pointer" onClick={() => agregarProductoEditar(prod)}>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{prod.nombre_producto}</p>
                                                    <p className="text-[10px] text-slate-400">Stock: {prod.stock_actual}</p>
                                                </div>
                                                <Plus className="h-4 w-4 text-indigo-600" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Lista de Items */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-2">Producto</th>
                                            <th className="px-4 py-2 text-center w-32">Cant.</th>
                                            <th className="px-4 py-2 text-right">Unitario</th>
                                            <th className="px-4 py-2 text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {carritoEditar.map((item, idx) => (
                                            <tr key={idx} className="bg-white">
                                                <td className="px-4 py-3 font-semibold text-slate-700 text-xs">{item.nombre}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-between bg-slate-50 rounded-lg p-1 border border-slate-200">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500" onClick={() => ajustarCantidadEditar(idx, -1)}><Minus className="h-3 w-3" /></Button>
                                                        <span className="font-black text-slate-800 text-xs">{item.cantidad}</span>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500" onClick={() => ajustarCantidadEditar(idx, 1)}><Plus className="h-3 w-3" /></Button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-500 text-xs">${item.precio_unitario.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-black text-emerald-600 text-xs">${item.subtotal.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {carritoEditar.length === 0 && (
                                <p className="text-center text-red-500 text-sm font-bold py-4">El pedido quedará vacío y podría ser inválido.</p>
                            )}

                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Nuevo Total</p>
                                <p className="text-2xl font-black text-indigo-900">${carritoEditar.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2)}</p>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => setModalEditar(false)} className="bg-white">
                                    Cancelar
                                </Button>
                                <Button
                                    disabled={cargando || carritoEditar.length === 0}
                                    onClick={guardarEdicion}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md px-6"
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" /> Guardar Cambios
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}