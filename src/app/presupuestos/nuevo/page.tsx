"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    ClipboardList, Search, User, Plus, Loader2, X, PackageSearch,
    Trash2, ArrowLeft, CheckCircle2, AlertTriangle
} from "lucide-react";
import Link from "next/link";

import { buscarClientes, buscarProductos } from "@/app/actions/ventas";
import { getListasPrecio } from "@/app/actions/configuracion";
import { crearPresupuesto } from "@/app/actions/presupuestos";
import {
    calcularPrecioConCascada, formatCantidad, getUnidadLabel, getStepParaMedicion,
    type TipoMedicionType,
} from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function NuevoPresupuestoPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [listasGlobales, setListasGlobales] = useState<any[]>([]);

    const [clienteQuery, setClienteQuery] = useState("");
    const [clientesResultados, setClientesResultados] = useState<any[]>([]);
    const [clienteSeleccionado, setClienteSeleccionado] = useState<any | null>(null);
    const [showClienteModal, setShowClienteModal] = useState(false);

    const [listaPrecioSeleccionada, setListaPrecioSeleccionada] = useState("");
    const [vigenciaDias, setVigenciaDias] = useState(15);
    const [notas, setNotas] = useState("");

    const [productoQuery, setProductoQuery] = useState("");
    const [productosResultados, setProductosResultados] = useState<any[]>([]);
    const [showProductoModal, setShowProductoModal] = useState(false);
    const [carrito, setCarrito] = useState<any[]>([]);
    const [descuentoGlobal, setDescuentoGlobal] = useState(0);

    useEffect(() => {
        const init = async () => { setListasGlobales(await getListasPrecio()); };
        init();
    }, []);

    useEffect(() => {
        const timer = setTimeout(async () => {
            setClientesResultados(await buscarClientes(clienteQuery));
        }, 300);
        return () => clearTimeout(timer);
    }, [clienteQuery]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            setProductosResultados(await buscarProductos(productoQuery));
        }, 300);
        return () => clearTimeout(timer);
    }, [productoQuery]);

    const handleSeleccionarCliente = (cli: any) => {
        setClienteSeleccionado(cli);
        setClienteQuery("");
        setShowClienteModal(false);
        if (cli.lista_default_id) setListaPrecioSeleccionada(String(cli.lista_default_id));
    };

    const listaObj = listasGlobales.find(l => String(l.id) === listaPrecioSeleccionada);

    const handleAgregarAlCarrito = (prod: any) => {
        if (!listaPrecioSeleccionada) return toast.error("Seleccione una lista de precios.");
        const listaIDNum = Number(listaPrecioSeleccionada);
        const pivot = prod.listas_precios?.find((p: any) => p.listaPrecioId === listaIDNum);
        if (!pivot) return toast.error("Este producto no está habilitado para la lista seleccionada.");

        const listaGlobal = listasGlobales.find(l => l.id === listaIDNum);
        const margenFinal = pivot?.margen_personalizado ?? listaGlobal?.margen_defecto ?? 0;
        const aumProv = prod.proveedor?.aumento_porcentaje || 0;
        const aumMarca = prod.marca?.aumento_porcentaje || 0;
        const aumCat = prod.categoria?.aumento_porcentaje || 0;

        const precio = calcularPrecioConCascada(prod.precio_costo, prod.descuento_proveedor, prod.alicuota_iva, aumProv, aumMarca, aumCat, margenFinal);
        const tipo = (prod.tipo_medicion || "UNIDAD") as TipoMedicionType;

        setCarrito([...carrito, {
            productoId: prod.id, nombre: prod.nombre_producto, codigo: prod.codigo_articulo,
            cantidad: 1, precio_unitario: Number(precio.toFixed(2)), descuento_individual: 0,
            precio_final: Number(precio.toFixed(2)), subtotal: Number(precio.toFixed(2)),
            tipo_medicion: tipo, _rawProducto: prod
        }]);
        setProductoQuery(""); setShowProductoModal(false);
        toast.success("Agregado al presupuesto");
    };

    const handleActualizarItem = (index: number, campo: string, valor: string) => {
        const numValue = Number(valor);
        const items = [...carrito]; const item = items[index];
        if (campo === "cantidad") { item.cantidad = numValue; item.subtotal = numValue * item.precio_final; }
        else if (campo === "descuento_individual") {
            item.descuento_individual = numValue;
            item.precio_final = Number((item.precio_unitario * (1 - numValue / 100)).toFixed(2));
            item.subtotal = item.cantidad * item.precio_final;
        }
        else if (campo === "precio_final") { item.precio_final = numValue; item.descuento_individual = 0; item.subtotal = item.cantidad * numValue; }
        setCarrito(items);
    };

    const subtotalCarrito = carrito.reduce((acc, i) => acc + i.subtotal, 0);
    const montoDescuento = subtotalCarrito * (descuentoGlobal / 100);
    const totalFinal = subtotalCarrito - montoDescuento;

    const handleGuardar = () => {
        if (!clienteSeleccionado) return toast.error("Seleccione un cliente.");
        if (carrito.length === 0) return toast.error("El presupuesto está vacío.");

        startTransition(async () => {
            const res = await crearPresupuesto({
                clienteId: clienteSeleccionado.id,
                listaPrecioId: Number(listaPrecioSeleccionada),
                vigencia_dias: vigenciaDias,
                notas,
                subtotal: subtotalCarrito,
                descuento_global: montoDescuento,
                total: totalFinal,
                carrito: carrito.map(i => ({
                    productoId: i.productoId, cantidad: i.cantidad,
                    precio_unitario: i.precio_unitario, descuento_individual: i.descuento_individual,
                    precio_final: i.precio_final, subtotal: i.subtotal,
                }))
            });
            if (res.success) {
                toast.success("¡Presupuesto creado!");
                router.push("/presupuestos");
            } else toast.error(res.error);
        });
    };

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12">
            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4">
                    <Link href="/presupuestos">
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-50 p-2 rounded-lg"><ClipboardList className="h-5 w-5 text-emerald-600" /></div>
                        <div><h2 className="text-xl font-bold text-slate-900">Nuevo Presupuesto</h2><p className="text-sm text-slate-500">Cree una cotización para un cliente.</p></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT — Items */}
                <div className="lg:col-span-2 space-y-4">
                    <Card className="shadow-sm border-slate-200 bg-white overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-semibold text-lg">Ítems del Presupuesto</h3>
                            <Button onClick={() => setShowProductoModal(true)} disabled={!listaPrecioSeleccionada} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                <PackageSearch className="w-4 h-4 mr-2" /> Buscar Producto
                            </Button>
                        </div>
                        <div className="overflow-auto bg-slate-50/50 flex-1">
                            <table className="w-full text-sm">
                                <thead className="text-[10px] uppercase tracking-wider bg-slate-50 text-slate-500 border-b sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Producto</th>
                                        <th className="px-4 py-3 text-center w-20">Cant.</th>
                                        <th className="px-4 py-3 text-center w-20">Desc.%</th>
                                        <th className="px-4 py-3 text-right w-24">P.Final</th>
                                        <th className="px-4 py-3 text-right w-24">Subtotal</th>
                                        <th className="px-2 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {carrito.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-16 text-slate-400"><ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-20" /><p>Agregue productos al presupuesto.</p></td></tr>
                                    ) : carrito.map((item, i) => {
                                        const tipo = (item.tipo_medicion || "UNIDAD") as TipoMedicionType;
                                        return (
                                            <tr key={i} className="bg-white hover:bg-slate-50">
                                                <td className="px-4 py-3"><p className="font-semibold text-sm">{item.nombre}</p><p className="text-[11px] text-slate-400 font-mono">{item.codigo}</p></td>
                                                <td className="px-4 py-3"><Input type="number" step={getStepParaMedicion(tipo)} value={item.cantidad || ""} onChange={(e) => handleActualizarItem(i, "cantidad", e.target.value)} className="h-8 w-18 text-center mx-auto" /></td>
                                                <td className="px-4 py-3"><Input type="number" step="0.1" value={item.descuento_individual || ""} onChange={(e) => handleActualizarItem(i, "descuento_individual", e.target.value)} className="h-8 w-18 text-center mx-auto" /></td>
                                                <td className="px-4 py-3 text-right font-bold">${item.precio_final.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-black">${item.subtotal.toFixed(2)}</td>
                                                <td className="px-2 py-3"><Button variant="ghost" size="icon" onClick={() => setCarrito(carrito.filter((_, idx) => idx !== i))} className="h-7 w-7 text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* RIGHT — Config */}
                <div className="space-y-4">
                    <Card className="shadow-sm border-slate-200 bg-white">
                        <CardHeader className="py-3 px-4 border-b"><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4 text-slate-400" /> Cliente y Lista</CardTitle></CardHeader>
                        <CardContent className="p-4 space-y-4">
                            {!clienteSeleccionado ? (
                                <Button onClick={() => setShowClienteModal(true)} variant="outline" className="w-full h-10 border-dashed hover:border-emerald-400 hover:bg-emerald-50 text-slate-500 font-medium"><Search className="w-4 h-4 mr-2" /> Buscar Cliente</Button>
                            ) : (
                                <div className="bg-slate-50 border rounded-lg p-3 relative">
                                    <Button variant="ghost" size="sm" onClick={() => { setClienteSeleccionado(null); setCarrito([]); }} className="absolute right-1 top-1 h-6 text-[10px] text-slate-400">Cambiar</Button>
                                    <p className="font-bold text-sm pr-12 truncate">{clienteSeleccionado.nombre_razon_social}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{clienteSeleccionado.dni_cuit || "S/D"}</p>
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Lista de Precios</Label>
                                <Select value={listaPrecioSeleccionada} onValueChange={(v) => setListaPrecioSeleccionada(v || "")} disabled={!clienteSeleccionado}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccione...">{listaObj?.nombre || "Seleccione..."}</SelectValue></SelectTrigger>
                                    <SelectContent>{listasGlobales.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Vigencia (días)</Label>
                                <Input type="number" value={vigenciaDias} onChange={(e) => setVigenciaDias(Number(e.target.value))} className="h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Notas</Label>
                                <Textarea placeholder="Observaciones..." value={notas} onChange={(e) => setNotas(e.target.value)} className="resize-none h-16 text-sm" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-emerald-200 bg-emerald-50/30">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-mono">${subtotalCarrito.toFixed(2)}</span></div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500">Desc. Global %</span>
                                <Input type="number" value={descuentoGlobal || ""} onChange={(e) => setDescuentoGlobal(Number(e.target.value))} className="w-20 h-8 text-right" />
                            </div>
                            {descuentoGlobal > 0 && <p className="text-[10px] text-emerald-600 font-semibold text-right">- ${montoDescuento.toFixed(2)}</p>}
                            <Separator />
                            <div className="text-center">
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Total Presupuesto</span>
                                <p className="text-3xl font-black text-emerald-600">${totalFinal.toFixed(2)}</p>
                            </div>
                            <Button size="lg" onClick={handleGuardar} disabled={isPending || !clienteSeleccionado || carrito.length === 0}
                                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm">
                                {isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                                Guardar Presupuesto
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* MODAL CLIENTE */}
            {showClienteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 flex flex-col max-h-[85vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                            <h3 className="font-semibold flex items-center gap-2"><User className="h-5 w-5 text-emerald-500" /> Buscar Cliente</h3>
                            <Button variant="ghost" size="icon" onClick={() => setShowClienteModal(false)} className="h-8 w-8 rounded-full text-slate-400"><X className="h-4 w-4" /></Button>
                        </div>
                        <div className="p-4 border-b">
                            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input autoFocus placeholder="Nombre o DNI..." className="pl-9 h-10" value={clienteQuery} onChange={(e) => setClienteQuery(e.target.value)} /></div>
                        </div>
                        <div className="overflow-y-auto p-2 flex-1">
                            {clientesResultados.length === 0 ? <div className="text-center py-12 text-slate-400 text-sm">Escriba para buscar...</div> : (
                                <div className="space-y-1">{clientesResultados.map(cli => (
                                    <div key={cli.id} onClick={() => handleSeleccionarCliente(cli)} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg cursor-pointer">
                                        <div><p className="font-semibold text-sm">{cli.nombre_razon_social}</p><p className="text-[11px] text-slate-500">DNI: {cli.dni_cuit || "N/A"}</p></div>
                                        <Badge variant="outline" className="text-[10px]">{cli.lista_default?.nombre || "S/L"}</Badge>
                                    </div>
                                ))}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PRODUCTO */}
            {showProductoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-slate-200 flex flex-col max-h-[85vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                            <h3 className="font-semibold flex items-center gap-2"><PackageSearch className="h-5 w-5 text-emerald-500" /> Catálogo de Productos</h3>
                            <Button variant="ghost" size="icon" onClick={() => setShowProductoModal(false)} className="h-8 w-8 rounded-full text-slate-400"><X className="h-4 w-4" /></Button>
                        </div>
                        <div className="p-4 border-b flex gap-4">
                            <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input autoFocus placeholder="Buscar..." className="pl-9 h-10" value={productoQuery} onChange={(e) => setProductoQuery(e.target.value)} /></div>
                            <div className="bg-slate-50 px-4 py-2 rounded-lg border text-right shrink-0"><span className="text-[10px] font-bold text-slate-400 block">Lista</span><span className="font-semibold text-sm">{listaObj?.nombre}</span></div>
                        </div>
                        <div className="overflow-y-auto p-3 flex-1">
                            {productosResultados.length === 0 ? <div className="text-center py-16 text-slate-400"><PackageSearch className="h-10 w-10 mx-auto mb-3 opacity-20" /><p className="text-sm">Escriba para buscar</p></div> : (
                                <div className="space-y-2">{productosResultados.map(prod => {
                                    const listaIDNum = Number(listaPrecioSeleccionada);
                                    const pivot = prod.listas_precios?.find((p: any) => p.listaPrecioId === listaIDNum);
                                    const listaGlobal = listasGlobales.find(l => l.id === listaIDNum);
                                    const margenFinal = (pivot?.margen_personalizado ?? listaGlobal?.margen_defecto ?? 0);
                                    const precio = calcularPrecioConCascada(prod.precio_costo, prod.descuento_proveedor, prod.alicuota_iva, prod.proveedor?.aumento_porcentaje || 0, prod.marca?.aumento_porcentaje || 0, prod.categoria?.aumento_porcentaje || 0, margenFinal);
                                    const sinLista = !pivot;
                                    return (
                                        <div key={prod.id} className={`flex justify-between items-center p-3 rounded-xl border bg-white shadow-sm ${sinLista ? 'opacity-50 border-amber-200' : 'border-slate-200 hover:border-emerald-200'}`}>
                                            <div><p className="font-semibold text-sm">{prod.nombre_producto}</p><Badge variant="outline" className="text-[10px] mt-1">Stock: {formatCantidad(prod.stock_actual, prod.tipo_medicion)} {getUnidadLabel(prod.tipo_medicion)}</Badge></div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right"><p className="text-[10px] text-slate-400 uppercase font-bold">Precio</p><p className="font-black text-lg">{sinLista ? "-" : `$${precio.toFixed(2)}`}</p></div>
                                                <Button onClick={() => handleAgregarAlCarrito(prod)} size="sm" disabled={sinLista} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9"><Plus className="h-4 w-4 mr-1" /> Añadir</Button>
                                            </div>
                                        </div>
                                    );
                                })}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
