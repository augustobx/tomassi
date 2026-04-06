"use client";

import { useState, useEffect } from "react";
import { buscarClientes, buscarProductos, obtenerListasPrecio, obtenerMarcas, obtenerCategorias } from "@/app/actions/ventas";
import { registrarPedidoPWA, obtenerPedidosVendedor, accionarPedidoVendedor } from "@/app/actions/pedidos";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
    Trash2, Search, ShoppingCart, User, FileText, Ban, PackageSearch,
    Plus, Minus, X, ChevronRight, Bookmark, Tag, Percent, History, Edit, CheckCircle2
} from "lucide-react";

export default function PwaVendedor() {
    // ==========================================
    // ESTADOS MAESTROS Y NAVEGACIÓN
    // ==========================================
    const [listas, setListas] = useState<any[]>([]);
    const [marcas, setMarcas] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [pedidosHistorial, setPedidosHistorial] = useState<any[]>([]);
    const [filtroHistorial, setFiltroHistorial] = useState("");

    const [tabActiva, setTabActiva] = useState<'NUEVO' | 'HISTORIAL'>('NUEVO');
    const [vistaRemito, setVistaRemito] = useState(false);
    const [catalogoAbierto, setCatalogoAbierto] = useState(false);

    // ==========================================
    // ESTADOS DEL PEDIDO ACTUAL
    // ==========================================
    const [cliente, setCliente] = useState<any>(null);
    const [selectedListaId, setSelectedListaId] = useState<number>(1);
    const [notas, setNotas] = useState("");
    const [carrito, setCarrito] = useState<any[]>([]);

    // Pagos
    const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'CUENTA_CORRIENTE'>('EFECTIVO');
    const [montoAbonado, setMontoAbonado] = useState<number | "">("");

    // Buscadores
    const [queryCliente, setQueryCliente] = useState("");
    const [clientesRes, setClientesRes] = useState<any[]>([]);
    const [queryCatalogo, setQueryCatalogo] = useState("");
    const [filtroMarca, setFiltroMarca] = useState<string>("TODAS");
    const [filtroCategoria, setFiltroCategoria] = useState<string>("TODAS");
    const [productosCatalogo, setProductosCatalogo] = useState<any[]>([]);

    const depositoId = 1;

    // ==========================================
    // EFECTOS (CARGA DE DATOS)
    // ==========================================
    useEffect(() => {
        obtenerListasPrecio().then(setListas);
        obtenerMarcas().then(setMarcas);
        obtenerCategorias().then(setCategorias);
        cargarHistorial();
    }, []);

    const cargarHistorial = () => obtenerPedidosVendedor().then(setPedidosHistorial);

    useEffect(() => {
        if (queryCliente.length > 2) buscarClientes(queryCliente).then(setClientesRes);
    }, [queryCliente]);

    useEffect(() => {
        buscarProductos(queryCatalogo).then(res => {
            let filtrados = res;
            if (filtroMarca !== "TODAS") filtrados = filtrados.filter(p => p.marca?.nombre === filtroMarca);
            if (filtroCategoria !== "TODAS") filtrados = filtrados.filter(p => p.categoria?.nombre === filtroCategoria);
            setProductosCatalogo(filtrados);
        });
    }, [queryCatalogo, filtroMarca, filtroCategoria, catalogoAbierto]);

    // ==========================================
    // LÓGICA DE PRECIOS Y CARRITO
    // ==========================================
    const calcularPrecioBase = (producto: any, listaId: number) => {
        const precioCostoIva = producto.precio_costo * (1 + (producto.alicuota_iva / 100));
        let margen = listas.find(l => l.id === listaId)?.margen_defecto || 0;
        const pivot = producto.listas_precios?.find((lp: any) => lp.listaPrecioId === listaId);
        if (pivot && pivot.margen_personalizado !== null) margen = pivot.margen_personalizado;
        return precioCostoIva * (1 + (margen / 100));
    };

    const handleClienteSelect = (c: any) => {
        setCliente(c);
        setSelectedListaId(c.lista_default_id || (listas[0]?.id || 1));
        setClientesRes([]);
        setQueryCliente("");
    };

    const obtenerItemCarrito = (productoId: number) => carrito.find(i => i.productoId === productoId);

    const ajustarCantidadProducto = (prod: any, delta: number) => {
        const index = carrito.findIndex(i => i.productoId === prod.id);
        const itemExistente = carrito[index];
        const nuevaCantidad = (itemExistente ? itemExistente.cantidad : 0) + delta;

        if (nuevaCantidad > prod.stock_actual) return toast.warning(`Límite de stock: ${prod.stock_actual}`);
        if (nuevaCantidad < 0) return;

        let nuevos = [...carrito];
        const precioBase = calcularPrecioBase(prod, selectedListaId);

        if (index >= 0) {
            if (nuevaCantidad === 0) nuevos = nuevos.filter(i => i.productoId !== prod.id);
            else {
                nuevos[index].cantidad = nuevaCantidad;
                recalcularTotalesItem(nuevos[index]);
            }
        } else if (nuevaCantidad > 0) {
            nuevos.push({
                productoId: prod.id,
                nombre: prod.nombre_producto,
                cantidad: 1,
                precio_unitario: precioBase,
                descuento_individual: 0,
                precio_final: precioBase,
                subtotal: precioBase,
                stock_maximo: prod.stock_actual
            });
        }
        setCarrito(nuevos);
    };

    const cambiarDescuento = (productoId: number, nuevoDto: number) => {
        const nuevos = [...carrito];
        const index = nuevos.findIndex(i => i.productoId === productoId);
        if (index >= 0) {
            nuevos[index].descuento_individual = nuevoDto;
            recalcularTotalesItem(nuevos[index]);
            setCarrito(nuevos);
        }
    };

    const recalcularTotalesItem = (item: any) => {
        const descuentoMonto = item.precio_unitario * (item.descuento_individual / 100);
        item.precio_final = item.precio_unitario - descuentoMonto;
        item.subtotal = item.precio_final * item.cantidad;
    };

    const total = carrito.reduce((acc, item) => acc + item.subtotal, 0);

    // ==========================================
    // ACCIONES HACIA LA BASE DE DATOS
    // ==========================================
    const confirmarPedido = async () => {
        if (!cliente) return toast.error("Seleccioná un cliente");
        if (carrito.length === 0) return toast.error("Carrito vacío");

        const toastId = toast.loading("Enviando pedido a administración...");
        const res = await registrarPedidoPWA({
            clienteId: cliente.id,
            depositoId: depositoId,
            listaPrecioId: selectedListaId,
            subtotal: total,
            total: total,
            notas: notas,
            carrito: carrito,
            metodoPago: metodoPago,
            montoAbonado: metodoPago === 'EFECTIVO' ? (Number(montoAbonado) || total) : total
        });

        if (res.success) {
            toast.success("¡Pedido enviado correctamente!", { id: toastId });
            setCarrito([]);
            setCliente(null);
            setNotas("");
            setMontoAbonado("");
            setVistaRemito(false);
            cargarHistorial();
            setTabActiva('HISTORIAL');
        } else {
            toast.error(res.error, { id: toastId });
        }
    };

    const manejarAccionHistorial = async (pedido: any, accion: 'CANCELAR' | 'EDITAR') => {
        if (!confirm(`¿Seguro que querés ${accion} este pedido? Se devolverá el stock.`)) return;

        const toastId = toast.loading(`Procesando...`);
        const res = await accionarPedidoVendedor(pedido.id, accion);

        if (res.success) {
            toast.success(`Pedido ${accion === 'EDITAR' ? 'listo para editar' : 'cancelado'}`, { id: toastId });
            cargarHistorial();

            if (accion === 'EDITAR') {
                setCliente(pedido.cliente);
                toast.info("Por favor, volvé a seleccionar el cliente para validar la lista de precios.");
                setTabActiva('NUEVO');
            }
        } else {
            toast.error(res.error, { id: toastId });
        }
    };

    // ==========================================
    // RENDERIZADO DE LA INTERFAZ
    // ==========================================
    return (
        <div className="min-h-screen bg-zinc-50 pb-24 text-zinc-900 overflow-x-hidden font-sans">

            {/* VISTA PRINCIPAL (SI NO ESTÁ ABIERTO NI EL CATÁLOGO NI EL REMITO) */}
            {!vistaRemito && !catalogoAbierto && (
                <div className="p-4">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6 pt-2">
                        <h1 className="text-2xl font-black text-indigo-950 flex items-center tracking-tight">
                            {tabActiva === 'NUEVO' ? <><ShoppingCart className="mr-2 h-6 w-6 text-indigo-600" /> Toma de Pedido</> : <><History className="mr-2 h-6 w-6 text-indigo-600" /> Mis Pedidos</>}
                        </h1>
                    </div>

                    {/* ================= TAB 1: NUEVO PEDIDO ================= */}
                    {tabActiva === 'NUEVO' && (
                        <div className="animate-in fade-in duration-300">
                            {/* CLIENTE */}
                            {!cliente ? (
                                <div className="bg-white p-5 rounded-3xl shadow-sm border border-zinc-200 mb-4">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center"><User className="w-3 h-3 mr-1" /> Selección de Cliente</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 h-5 w-5 text-zinc-300" />
                                        <Input placeholder="Nombre o CUIT..." className="pl-10 h-14 bg-zinc-50 border-zinc-100 rounded-2xl text-base" value={queryCliente} onChange={(e) => setQueryCliente(e.target.value)} />
                                    </div>
                                    {clientesRes.length > 0 && (
                                        <div className="mt-3 border rounded-2xl divide-y bg-white shadow-xl max-h-64 overflow-y-auto border-zinc-100">
                                            {clientesRes.map(c => (
                                                <div key={c.id} className="p-4 flex justify-between items-center active:bg-indigo-50" onClick={() => handleClienteSelect(c)}>
                                                    <span className="font-bold text-zinc-800">{c.nombre_razon_social}</span>
                                                    <ChevronRight className="w-4 h-4 text-zinc-300" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-indigo-600 p-5 rounded-3xl shadow-lg mb-4 text-white relative overflow-hidden">
                                    <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full blur-2xl"></div>
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="max-w-[70%]">
                                            <p className="font-black text-xl leading-none mb-1 truncate">{cliente.nombre_razon_social}</p>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setCliente(null)} className="text-white hover:bg-white/20 h-8 rounded-xl px-3 text-xs font-bold border border-white/30">Cerrar</Button>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-white/20 relative z-10">
                                        <select value={selectedListaId} onChange={(e) => setSelectedListaId(Number(e.target.value))} className="w-full h-11 px-4 rounded-2xl bg-indigo-700/50 border border-indigo-400/50 text-sm font-black text-white outline-none">
                                            {listas.map(l => <option key={l.id} value={l.id} className="text-zinc-900 bg-white">{l.nombre}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* BOTÓN CATÁLOGO */}
                            {cliente && (
                                <Button onClick={() => setCatalogoAbierto(true)} className="w-full h-20 text-xl font-black bg-white border-2 border-indigo-100 text-indigo-600 rounded-3xl shadow-sm hover:bg-indigo-50 flex justify-between px-8 mb-6">
                                    <span className="flex items-center"><PackageSearch className="w-7 h-7 mr-3" /> CATÁLOGO</span>
                                    <div className="bg-indigo-100 p-2 rounded-full"><Plus className="w-6 h-6" /></div>
                                </Button>
                            )}

                            {/* CARRITO Y NOTAS */}
                            {carrito.length > 0 && (
                                <div className="space-y-4 mb-24">
                                    <div className="flex justify-between px-2 items-end">
                                        <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Resumen</p>
                                        <p className="text-xs font-bold text-red-500 cursor-pointer" onClick={() => setCarrito([])}>Vaciar todo</p>
                                    </div>
                                    {carrito.map((item, i) => (
                                        <Card key={i} className="border-0 shadow-sm rounded-3xl overflow-hidden">
                                            <CardContent className="p-5 bg-white">
                                                <div className="flex justify-between items-start mb-4">
                                                    <p className="font-bold text-sm text-zinc-900 leading-tight pr-4">{item.nombre}</p>
                                                    <p className="font-black text-lg text-emerald-600 leading-none">${item.subtotal.toFixed(2)}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="flex items-center justify-between bg-zinc-50 rounded-2xl p-1 border border-zinc-100">
                                                        <Button variant="ghost" size="icon" className="text-zinc-400" onClick={() => ajustarCantidadProducto({ id: item.productoId, stock_actual: item.stock_maximo }, -1)}><Minus className="h-4 w-4" /></Button>
                                                        <span className="font-black text-zinc-800">{item.cantidad}</span>
                                                        <Button variant="ghost" size="icon" className="text-zinc-400" onClick={() => ajustarCantidadProducto({ id: item.productoId, stock_actual: item.stock_maximo }, 1)}><Plus className="h-4 w-4" /></Button>
                                                    </div>
                                                    <div className="relative">
                                                        <Percent className="absolute left-3 top-3 h-4 w-4 text-indigo-400" />
                                                        <Input type="number" placeholder="Dto %" className="pl-9 h-12 bg-indigo-50/50 border-indigo-100 rounded-2xl font-black text-indigo-700 text-center" value={item.descuento_individual || ""} onChange={(e) => cambiarDescuento(item.productoId, Number(e.target.value))} />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}

                                    <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones para la oficina..." className="w-full p-4 border border-zinc-200 rounded-3xl bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] shadow-sm mt-4" />
                                </div>
                            )}

                            {/* BOTÓN VER PEDIDO (PREVIO A ENVIAR) */}
                            {carrito.length > 0 && (
                                <div className="fixed bottom-[80px] left-0 right-0 p-4 bg-gradient-to-t from-zinc-50 via-zinc-50 to-transparent z-30">
                                    <Button onClick={() => setVistaRemito(true)} className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 rounded-2xl h-16 font-black text-lg flex justify-between px-6">
                                        <span>VER PEDIDO</span>
                                        <span className="bg-indigo-800/50 px-3 py-1 rounded-xl">${total.toFixed(2)}</span>
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ================= TAB 2: HISTORIAL ================= */}
                    {tabActiva === 'HISTORIAL' && (
                        <div className="animate-in fade-in duration-300 pb-24">
                            <div className="relative mb-4">
                                <Search className="absolute left-4 top-4 h-5 w-5 text-zinc-400" />
                                <Input placeholder="Filtrar por nombre de cliente..." className="pl-12 h-14 bg-white border-zinc-200 rounded-2xl text-base shadow-sm" value={filtroHistorial} onChange={(e) => setFiltroHistorial(e.target.value)} />
                            </div>

                            <div className="space-y-4">
                                {pedidosHistorial.filter(p => p.cliente?.nombre_razon_social.toLowerCase().includes(filtroHistorial.toLowerCase())).map(pedido => (
                                    <Card key={pedido.id} className="border-0 shadow-sm rounded-3xl overflow-hidden">
                                        <CardContent className="p-5 bg-white">
                                            <div className="flex justify-between items-start border-b border-zinc-100 pb-3 mb-3">
                                                <div>
                                                    <p className="font-black text-sm text-zinc-900 leading-tight mb-1">{pedido.cliente?.nombre_razon_social}</p>
                                                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Pedido #{pedido.numero} • {new Date(pedido.fecha).toLocaleDateString()}</p>
                                                </div>
                                                <div className={`text-[10px] font-black px-2 py-1 rounded-lg ${pedido.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' : pedido.estado === 'CANCELADO' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {pedido.estado}
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center mb-4">
                                                <p className="text-xs text-zinc-500 font-medium">{pedido.detalles.length} artículos</p>
                                                <p className="font-black text-lg text-indigo-950">${pedido.total.toFixed(2)}</p>
                                            </div>

                                            {pedido.estado === 'PENDIENTE' && (
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => manejarAccionHistorial(pedido, 'EDITAR')} className="flex-1 h-10 rounded-xl border-zinc-200 text-zinc-600 font-bold"><Edit className="w-4 h-4 mr-2" /> Editar</Button>
                                                    <Button variant="outline" size="sm" onClick={() => manejarAccionHistorial(pedido, 'CANCELAR')} className="flex-1 h-10 rounded-xl border-red-100 bg-red-50 text-red-600 font-bold"><Ban className="w-4 h-4 mr-2" /> Anular</Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                                {pedidosHistorial.length === 0 && <p className="text-center text-zinc-400 p-8 font-medium">No hay pedidos registrados.</p>}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ================= BARRA DE NAVEGACIÓN INFERIOR FIJA ================= */}
            {!vistaRemito && !catalogoAbierto && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] pb-safe z-40 flex">
                    <button onClick={() => setTabActiva('NUEVO')} className={`flex-1 flex flex-col items-center py-3 ${tabActiva === 'NUEVO' ? 'text-indigo-600' : 'text-zinc-400'}`}>
                        <Plus className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Nuevo Pedido</span>
                    </button>
                    <button onClick={() => setTabActiva('HISTORIAL')} className={`flex-1 flex flex-col items-center py-3 ${tabActiva === 'HISTORIAL' ? 'text-indigo-600' : 'text-zinc-400'}`}>
                        <History className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Historial</span>
                    </button>
                </div>
            )}

            {/* ================= DRAWER CATÁLOGO COMPLETO ================= */}
            {catalogoAbierto && (
                <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
                    <div className="bg-white p-5 border-b border-zinc-100 shrink-0">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="font-black text-2xl text-zinc-900">Catálogo</h2>
                            <Button variant="ghost" size="icon" onClick={() => setCatalogoAbierto(false)} className="bg-zinc-100 rounded-2xl h-12 w-12"><X className="h-6 w-6" /></Button>
                        </div>
                        <div className="relative mb-5">
                            <Search className="absolute left-4 top-4 h-5 w-5 text-zinc-300" />
                            <Input placeholder="Buscar marca o producto..." className="pl-12 h-14 bg-zinc-50 border-transparent rounded-2xl text-lg font-medium" value={queryCatalogo} onChange={(e) => setQueryCatalogo(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="relative"><Bookmark className="absolute left-3 top-3 h-3 w-3 text-indigo-400" /><select className="w-full h-10 pl-8 rounded-xl bg-zinc-50 text-[11px] font-bold outline-none" value={filtroMarca} onChange={(e) => setFiltroMarca(e.target.value)}><option value="TODAS">TODAS LAS MARCAS</option>{marcas.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}</select></div>
                            <div className="relative"><Tag className="absolute left-3 top-3 h-3 w-3 text-indigo-400" /><select className="w-full h-10 pl-8 rounded-xl bg-zinc-50 text-[11px] font-bold outline-none" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}><option value="TODAS">CATEGORÍAS</option>{categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}</select></div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 bg-zinc-50 space-y-4">
                        {productosCatalogo.map(p => {
                            const itemEnCarrito = obtenerItemCarrito(p.id);
                            const precioBase = calcularPrecioBase(p, selectedListaId);
                            const precioMostrar = itemEnCarrito ? itemEnCarrito.precio_final : precioBase;
                            const tieneStock = p.stock_actual > 0;

                            return (
                                <Card key={p.id} className={`border-0 rounded-3xl shadow-sm ${!tieneStock && 'opacity-60'}`}>
                                    <CardContent className="p-5 flex flex-col">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="max-w-[65%]">
                                                <p className="font-black text-sm text-zinc-900 leading-tight mb-1">{p.nombre_producto}</p>
                                                <div className="flex gap-2">
                                                    <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg">{p.marca?.nombre || 'S/M'}</span>
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${tieneStock ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>STOCK: {p.stock_actual}</span>
                                                </div>
                                            </div>
                                            <p className={`font-black text-lg ${itemEnCarrito?.descuento_individual > 0 ? 'text-emerald-600' : 'text-indigo-600'}`}>${precioMostrar.toFixed(2)}</p>
                                        </div>
                                        <div className="grid grid-cols-5 gap-3 items-center">
                                            <div className="col-span-3 flex items-center justify-between bg-zinc-100 rounded-2xl p-1 h-12">
                                                <Button variant="ghost" size="icon" className="h-10 w-10 text-zinc-400" disabled={!tieneStock} onClick={() => ajustarCantidadProducto(p, -1)}><Minus className="h-4 w-4" /></Button>
                                                <span className="font-black text-zinc-900 text-lg">{itemEnCarrito?.cantidad || 0}</span>
                                                <Button variant="ghost" size="icon" className="h-10 w-10 text-zinc-400" disabled={!tieneStock} onClick={() => ajustarCantidadProducto(p, 1)}><Plus className="h-4 w-4" /></Button>
                                            </div>
                                            <div className="col-span-2 relative">
                                                <Percent className="absolute left-2 top-4 h-3 w-3 text-indigo-300" />
                                                <Input type="number" placeholder="Dto %" className="pl-6 h-12 bg-white border-zinc-100 rounded-2xl font-bold text-indigo-600 text-xs text-center" value={itemEnCarrito?.descuento_individual || ""} onChange={(e) => cambiarDescuento(p.id, Number(e.target.value))} disabled={!itemEnCarrito} />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                    <div className="p-5 border-t bg-white pb-safe">
                        <Button onClick={() => setCatalogoAbierto(false)} className="w-full h-16 bg-zinc-900 text-white font-black rounded-2xl text-lg shadow-xl">LISTO ({carrito.reduce((acc, i) => acc + i.cantidad, 0)} UNIDADES)</Button>
                    </div>
                </div>
            )}

            {/* ================= DRAWER REMITO Y PAGOS ================= */}
            {vistaRemito && (
                <div className="fixed inset-0 z-50 bg-zinc-900 flex flex-col p-4 pt-safe animate-in zoom-in-95 duration-300">
                    <div className="flex-1 bg-white rounded-3xl p-6 overflow-y-auto relative shadow-2xl">

                        <Button variant="ghost" size="icon" onClick={() => setVistaRemito(false)} className="absolute top-4 right-4 bg-zinc-100 rounded-full h-10 w-10 text-zinc-500"><X className="h-5 w-5" /></Button>

                        <div className="text-center border-b border-dashed border-zinc-300 pb-5 mb-5 mt-2">
                            <h2 className="font-black text-2xl text-zinc-900 tracking-tight">REMITO DE PEDIDO</h2>
                            <p className="text-xs font-bold text-zinc-400 uppercase mt-2">{cliente.nombre_razon_social}</p>
                            <p className="text-[10px] text-zinc-400">CUIT: {cliente.dni_cuit || 'S/D'}</p>
                        </div>

                        <div className="space-y-4 mb-6">
                            {carrito.map((item, i) => (
                                <div key={i} className="flex justify-between items-start">
                                    <div className="max-w-[70%]">
                                        <p className="font-bold text-xs text-zinc-800 leading-tight">{item.cantidad}x {item.nombre}</p>
                                        {item.descuento_individual > 0 && <p className="text-[9px] font-black text-emerald-600">Dto aplicado: {item.descuento_individual}%</p>}
                                    </div>
                                    <p className="font-black text-sm text-zinc-900">${item.subtotal.toFixed(2)}</p>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-dashed border-zinc-300 pt-5 space-y-2">
                            <div className="flex justify-between items-center text-zinc-500 text-xs font-bold"><span>Total Ítems</span><span>{carrito.reduce((acc, i) => acc + i.cantidad, 0)} unidades</span></div>
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-100 mb-4">
                                <span className="font-black text-lg text-zinc-900">TOTAL FINAL</span>
                                <span className="font-black text-2xl text-indigo-600">${total.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* SECCIÓN DE PAGOS */}
                        <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Método de Pago</p>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <Button
                                    variant={metodoPago === 'EFECTIVO' ? 'default' : 'outline'}
                                    onClick={() => setMetodoPago('EFECTIVO')}
                                    className={`h-12 font-bold rounded-xl ${metodoPago === 'EFECTIVO' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-zinc-500 border-zinc-200'}`}
                                >
                                    EFECTIVO
                                </Button>
                                <Button
                                    variant={metodoPago === 'CUENTA_CORRIENTE' ? 'default' : 'outline'}
                                    onClick={() => setMetodoPago('CUENTA_CORRIENTE')}
                                    className={`h-12 font-bold rounded-xl ${metodoPago === 'CUENTA_CORRIENTE' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-zinc-500 border-zinc-200'}`}
                                >
                                    CTA. CTE
                                </Button>
                            </div>

                            {metodoPago === 'EFECTIVO' && (
                                <div className="space-y-3 animate-in fade-in duration-200">
                                    <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-zinc-200">
                                        <span className="text-xs font-bold text-zinc-600 pl-2">Abona con:</span>
                                        <div className="relative w-[120px]">
                                            <span className="absolute left-3 top-2.5 text-zinc-400 font-bold">$</span>
                                            <Input
                                                type="number"
                                                className="pl-7 h-10 font-black text-right bg-zinc-50 border-none"
                                                value={montoAbonado}
                                                onChange={(e) => setMontoAbonado(Number(e.target.value))}
                                                placeholder={total.toFixed(2)}
                                            />
                                        </div>
                                    </div>
                                    {Number(montoAbonado) > total && (
                                        <div className="flex justify-between items-center pt-2 px-2">
                                            <span className="text-xs font-black text-emerald-600 uppercase tracking-wider">VUELTO:</span>
                                            <span className="font-black text-xl text-emerald-600">${(Number(montoAbonado) - total).toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {metodoPago === 'CUENTA_CORRIENTE' && (
                                <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 animate-in fade-in duration-200">
                                    <p className="text-xs text-indigo-700 font-semibold text-center">
                                        El importe total (${total.toFixed(2)}) se cargará en la cuenta del cliente.
                                    </p>
                                </div>
                            )}
                        </div>

                        {notas && (
                            <div className="mt-4 bg-amber-50 p-3 rounded-xl border border-amber-100">
                                <p className="text-[9px] font-black text-amber-600 uppercase mb-1">Notas al administrador:</p>
                                <p className="text-xs font-medium text-amber-900 italic">"{notas}"</p>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 shrink-0">
                        <Button onClick={confirmarPedido} className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 rounded-2xl font-black text-lg text-white">
                            <CheckCircle2 className="mr-2 h-6 w-6" /> CONFIRMAR Y ENVIAR
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}