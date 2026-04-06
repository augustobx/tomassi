"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
    Search, ShoppingCart, Trash2, User, FileText, CheckCircle2, Loader2,
    Plus, X, PackageSearch, Truck, StickyNote, UserPlus, Printer,
    CheckSquare, Square, AlertTriangle, CreditCard, MessageSquare, Eye
} from "lucide-react";

import { buscarClientes, buscarProductos, previsualizarProximoComprobante, registrarVenta, getConsumidorFinal } from "@/app/actions/ventas";
import { getListasPrecio, getSucursales } from "@/app/actions/configuracion";
import { crearCliente, getResumenFinancieroCliente } from "@/app/actions/clientes";
import { getClientSession } from "@/app/actions/auth";
import {
    calcularPrecioConCascada,
    formatCantidad, getUnidadLabel, getStepParaMedicion,
    type TipoMedicionType,
} from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function PuntoDeVentaPage() { return <PuntoDeVentaTabsPage />; }

function PosTerminal({ tabId, allOtherCarts, updateCartInfo }: any) {
    const [isPending, startTransition] = useTransition();

    // ==========================================
    // ESTADOS DEL SISTEMA
    // ==========================================
    const [listasGlobales, setListasGlobales] = useState<any[]>([]);

    // Sucursales y Depósitos Activos
    const [usuarioSesion, setUsuarioSesion] = useState<any>(null);
    const [sucursales, setSucursales] = useState<any[]>([]);
    const [sucursalActivaId, setSucursalActivaId] = useState<number | null>(null);
    const [depositoActivoId, setDepositoActivoId] = useState<number | null>(null);

    // Encabezado de Factura
    const [tipoComprobante, setTipoComprobante] = useState("COMPROBANTE_X");
    const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0]);
    const [comprobanteNumeros, setComprobanteNumeros] = useState({ punto_venta: 1, numero_str: "00000000", proximoNumero: 0 });

    // Modales
    const [showClienteModal, setShowClienteModal] = useState(false);
    const [showNuevoClienteModal, setShowNuevoClienteModal] = useState(false);
    const [showProductoModal, setShowProductoModal] = useState(false);

    // Modal de Éxito e Impresión
    const [ventaExitosa, setVentaExitosa] = useState<{ id: number, comprobante: string } | null>(null);
    const [imprimirConDescuentos, setImprimirConDescuentos] = useState(true);

    // Cliente
    const [clienteQuery, setClienteQuery] = useState("");
    const [clientesResultados, setClientesResultados] = useState<any[]>([]);
    const [clienteSeleccionado, setClienteSeleccionado] = useState<any | null>(null);
    const [resumenFinanciero, setResumenFinanciero] = useState<any | null>(null);
    const [cargandoResumen, setCargandoResumen] = useState(false);
    const [showResumenModal, setShowResumenModal] = useState(false);
    const [listaPrecioSeleccionada, setListaPrecioSeleccionada] = useState<string>("");

    // Detalles Extra
    const [requiereEnvio, setRequiereEnvio] = useState(false);
    const [direccionEnvio, setDireccionEnvio] = useState("");
    const [detallesVenta, setDetallesVenta] = useState("");
    const [comentarioVenta, setComentarioVenta] = useState("");

    // Producto y Carrito
    const [productoQuery, setProductoQuery] = useState("");
    const [productosResultados, setProductosResultados] = useState<any[]>([]);
    const [carrito, setCarrito] = useState<any[]>([]);
    const [descuentoGlobal, setDescuentoGlobal] = useState<number>(0);
    const [expandedProdId, setExpandedProdId] = useState<number | null>(null);

    // === PAGOS MÚLTIPLES ===
    const [pagos, setPagos] = useState<{ metodo_pago: string; monto: string; cuotas?: string; recargo_porcentaje?: string }[]>([
        { metodo_pago: "CONTADO", monto: "" }
    ]);

    // Cuenta Corriente
    const [diasCongelamiento, setDiasCongelamiento] = useState<number>(15);

    useEffect(() => {
        if (updateCartInfo) updateCartInfo(carrito);
    }, [carrito]);

    // ==========================================
    // INICIALIZACIÓN Y EFECTOS
    // ==========================================
    useEffect(() => {
        const init = async () => {
            const listas = await getListasPrecio();
            setListasGlobales(listas);

            const session = await getClientSession();
            setUsuarioSesion(session);

            const sucursalesResult = await getSucursales();
            setSucursales(sucursalesResult);

            if (session?.sucursalId) {
                setSucursalActivaId(Number(session.sucursalId));
                const sucursal = sucursalesResult.find((s: any) => s.id === Number(session.sucursalId));
                if (sucursal && sucursal.depositos.length > 0) {
                    setDepositoActivoId(sucursal.depositos[0].id);
                }
            }

            // === AUTO CONSUMIDOR FINAL ===
            const cf = await getConsumidorFinal();
            if (cf) {
                setClienteSeleccionado(cf);
                if (cf.lista_default_id) setListaPrecioSeleccionada(String(cf.lista_default_id));
                if (cf.comprobante_default) setTipoComprobante(cf.comprobante_default);
            }
        };
        init();
    }, []);

    // Efecto cuando cambia la sucursal activa manual (Admin)
    useEffect(() => {
        if (sucursalActivaId) {
            const sucursal = sucursales.find((s: any) => s.id === sucursalActivaId);
            if (sucursal && sucursal.depositos.length > 0) {
                setDepositoActivoId(sucursal.depositos[0].id);
            } else {
                setDepositoActivoId(null);
            }
        }
    }, [sucursalActivaId, sucursales]);

    const fetchNumeros = async () => {
        const comp = await previsualizarProximoComprobante(tipoComprobante, 1);
        setComprobanteNumeros({ punto_venta: comp.punto_venta, numero_str: comp.numero_str, proximoNumero: comp.proximoNumero });
    };

    useEffect(() => { fetchNumeros(); }, [tipoComprobante, isPending]);

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

    useEffect(() => {
        if (clienteSeleccionado && clienteSeleccionado.id) {
            setCargandoResumen(true);
            getResumenFinancieroCliente(clienteSeleccionado.id).then(res => {
                if (res.success) setResumenFinanciero(res);
                else setResumenFinanciero(null);
                setCargandoResumen(false);
            });
        } else {
            setResumenFinanciero(null);
        }
    }, [clienteSeleccionado?.id]);

    // ==========================================
    // ACCIONES
    // ==========================================
    const handleSeleccionarCliente = (cliente: any) => {
        setClienteSeleccionado(cliente);
        setClienteQuery("");
        setShowClienteModal(false);

        if (cliente.lista_default_id) setListaPrecioSeleccionada(String(cliente.lista_default_id));
        if (cliente.direccion) setDireccionEnvio(cliente.direccion);
        if (cliente.comprobante_default) setTipoComprobante(cliente.comprobante_default);
    };

    const handleLimpiarCliente = () => {
        if (carrito.length > 0 && !confirm("¿Desea vaciar el carrito actual?")) return;
        setClienteSeleccionado(null);
        setListaPrecioSeleccionada("");
        setCarrito([]);
        setRequiereEnvio(false);
        setDireccionEnvio("");
    };

    const handleCrearClienteRapido = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
            const res = await crearCliente(formData);
            if (res.success) {
                toast.success("¡Cliente guardado!");
                setShowNuevoClienteModal(false);
                setClienteQuery(formData.get("nombre_razon_social") as string);
            } else {
                toast.error(res.error);
            }
        });
    };

    const handleAgregarAlCarrito = (producto: any) => {
        if (!listaPrecioSeleccionada) return toast.error("Debe seleccionar una lista de precios.");
        if (!sucursalActivaId || !depositoActivoId) return toast.error("Debe estar operando en una sucursal y depósito activo.");

        const listaIDNum = Number(listaPrecioSeleccionada);
        const pivot = producto.listas_precios?.find((p: any) => p.listaPrecioId === listaIDNum);

        // === VALIDACIÓN DE LISTA ===
        if (!pivot) {
            return toast.error("Este producto no está habilitado para la lista seleccionada.");
        }

        const depoPivot = producto.stocks?.find((s: any) => s.depositoId === depositoActivoId);
        const stockFisico = depoPivot ? depoPivot.cantidad : 0;

        const cantEnOtrosCarritos = (allOtherCarts || []).filter((item:any) => item.productoId === producto.id).reduce((acc:any, item:any) => acc + item.cantidad, 0);
        const cantEnEsteCarrito = carrito.filter((item:any) => item.productoId === producto.id).reduce((acc:any, item:any) => acc + item.cantidad, 0);
        const stockEfectivo = stockFisico - cantEnOtrosCarritos - cantEnEsteCarrito;

        // === VALIDACIÓN DE STOCK ===
        if (stockEfectivo <= 0) {
            if (cantEnOtrosCarritos > 0) {
                if (!window.confirm(`ATENCIÓN: Cuentas con ${stockFisico} en stock físico, pero ${cantEnOtrosCarritos} unidades están apartadas en otras pestañas. Stock libre es ${stockEfectivo}. ¿Forzar venta en negativo?`)) {
                    return;
                }
            } else {
                if (!window.confirm(`El producto "${producto.nombre_producto}" tiene stock en 0 o negativo (${stockEfectivo}) en el depósito activo. ¿Desea continuar de todos modos?`)) {
                    return;
                }
            }
            toast.warning(`Vendiendo por debajo del límite de stock.`);
        }

        const listaGlobal = listasGlobales.find(l => l.id === listaIDNum);
        const margenFinal = (pivot?.margen_personalizado !== null && pivot?.margen_personalizado !== undefined)
            ? Number(pivot.margen_personalizado)
            : Number(listaGlobal?.margen_defecto || 0);

        const aumProv = producto.proveedor?.aumento_porcentaje || 0;
        const aumMarca = producto.marca?.aumento_porcentaje || 0;
        const aumCat = producto.categoria?.aumento_porcentaje || 0;

        const precioBaseCalculado = calcularPrecioConCascada(
            producto.precio_costo, producto.descuento_proveedor, producto.alicuota_iva,
            aumProv, aumMarca, aumCat, margenFinal
        );

        const tipo = (producto.tipo_medicion || "UNIDAD") as TipoMedicionType;

        const nuevoItem = {
            productoId: producto.id,
            nombre: producto.nombre_producto,
            codigo: producto.codigo_articulo,
            cantidad: 1,
            precio_unitario: Number(precioBaseCalculado.toFixed(2)),
            descuento_individual: 0,
            precio_final: Number(precioBaseCalculado.toFixed(2)),
            subtotal: Number(precioBaseCalculado.toFixed(2)),
            stock_actual: stockFisico,
            tipo_medicion: tipo,
            _rawProducto: producto
        };

        setCarrito([...carrito, nuevoItem]);
        setProductoQuery("");
        setShowProductoModal(false);
        toast.success("Agregado al carrito");
    };

    const handleCambioLista = (nuevaListaId: string) => {
        setListaPrecioSeleccionada(nuevaListaId);

        if (carrito.length > 0) {
            const listaIDNum = Number(nuevaListaId);
            const listaGlobal = listasGlobales.find(l => l.id === listaIDNum);
            const margenDefault = listaGlobal?.margen_defecto || 0;

            const nuevoCarrito = carrito.map(item => {
                const prod = item._rawProducto;
                const pivot = prod.listas_precios?.find((p: any) => p.listaPrecioId === listaIDNum);
                const margenFinal = (pivot?.margen_personalizado !== null && pivot?.margen_personalizado !== undefined)
                    ? Number(pivot.margen_personalizado)
                    : Number(margenDefault);

                const aumProv = prod.proveedor?.aumento_porcentaje || 0;
                const aumMarca = prod.marca?.aumento_porcentaje || 0;
                const aumCat = prod.categoria?.aumento_porcentaje || 0;

                const precioBaseCalculado = calcularPrecioConCascada(
                    prod.precio_costo, prod.descuento_proveedor, prod.alicuota_iva,
                    aumProv, aumMarca, aumCat, margenFinal
                );

                const nuevoPrecioUnitario = Number(precioBaseCalculado.toFixed(2));
                const nuevoPrecioFinal = Number((nuevoPrecioUnitario * (1 - (item.descuento_individual / 100))).toFixed(2));

                return {
                    ...item,
                    precio_unitario: nuevoPrecioUnitario,
                    precio_final: nuevoPrecioFinal,
                    subtotal: Number((item.cantidad * nuevoPrecioFinal).toFixed(2))
                };
            });

            setCarrito(nuevoCarrito);
            toast.info("Precios actualizados", { description: "Se recalcularon todos los productos según la nueva lista." });
        }
    };

    const handleActualizarItem = (index: number, campo: string, valor: string) => {
        const numValue = Number(valor);
        const nuevosItems = [...carrito];
        const item = nuevosItems[index];

        if (campo === "cantidad") {
            item.cantidad = numValue;
            item.subtotal = numValue * item.precio_final;
        }
        else if (campo === "descuento_individual") {
            item.descuento_individual = numValue;
            const precioConDesc = item.precio_unitario * (1 - (numValue / 100));
            item.precio_final = Number(precioConDesc.toFixed(2));
            item.subtotal = item.cantidad * item.precio_final;
        }
        else if (campo === "precio_final") {
            item.precio_final = numValue;
            item.descuento_individual = 0;
            item.subtotal = item.cantidad * item.precio_final;
        }
        setCarrito(nuevosItems);
    };

    // === PAGOS MÚLTIPLES ===
    const agregarLineaPago = () => {
        setPagos([...pagos, { metodo_pago: "CONTADO", monto: "" }]);
    };

    const eliminarLineaPago = (index: number) => {
        if (pagos.length <= 1) return;
        setPagos(pagos.filter((_, i) => i !== index));
    };

    const actualizarPago = (index: number, campo: string, valor: string) => {
        const nuevosPagos = [...pagos];
        (nuevosPagos[index] as any)[campo] = valor;
        setPagos(nuevosPagos);
    };

    const totalPagos = pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
    const tieneCuentaCorriente = pagos.some(p => p.metodo_pago === "CUENTA_CORRIENTE");

    // ==========================================
    // CÁLCULOS Y ENVÍO A BD
    // ==========================================
    const subtotalCarrito = carrito.reduce((acc, item) => acc + item.subtotal, 0);
    const montoDescuentoGlobal = subtotalCarrito * ((descuentoGlobal || 0) / 100);
    const totalParcial = subtotalCarrito - montoDescuentoGlobal;

    // Calcular recargos de tarjetas (se aplican sobre el total de la venta)
    const montoRecargosTarjetas = pagos.reduce((acc, p) => {
        if (p.metodo_pago === "TARJETA" && p.recargo_porcentaje) {
            // El recargo se calcula asumiendo que aplica al total de la compra (práctica habitual)
            return acc + ((totalParcial * (Number(p.recargo_porcentaje) / 100)));
        }
        return acc;
    }, 0);

    const totalFinal = totalParcial + montoRecargosTarjetas;
    const listaSeleccionadaObj = listasGlobales.find(l => String(l.id) === listaPrecioSeleccionada);


    const handleProcesarVenta = () => {
        if (!clienteSeleccionado) return toast.error("Debe seleccionar un cliente.");
        if (carrito.length === 0) return toast.error("El carrito está vacío.");

        const pagosValidos = pagos.map(p => ({ 
            metodo_pago: p.metodo_pago, 
            monto: Number(p.monto) || 0,
            cuotas: p.cuotas || undefined,
            recargo_porcentaje: p.recargo_porcentaje || undefined
        })).filter(p => p.monto > 0);
        if (pagosValidos.length === 0) {
            // Si no puso montos, asumir pago completo con el primer método
            pagosValidos.push({ 
                metodo_pago: pagos[0].metodo_pago, 
                monto: totalFinal,
                cuotas: pagos[0].cuotas,
                recargo_porcentaje: pagos[0].recargo_porcentaje
            });
        }

        const sumaAislada = pagosValidos.reduce((acc, p) => acc + p.monto, 0);
        if (sumaAislada < totalFinal && Math.abs(sumaAislada - totalFinal) > 0.01) {
            return toast.error(`Falta abonar $${(totalFinal - sumaAislada).toFixed(2)}`);
        }
        
        let vueltoDelPago = 0;
        if (sumaAislada > totalFinal && Math.abs(sumaAislada - totalFinal) > 0.01) {
            const indexEfectivo = pagosValidos.findIndex(p => p.metodo_pago === 'CONTADO');
            if (indexEfectivo !== -1) {
                vueltoDelPago = sumaAislada - totalFinal;
                pagosValidos[indexEfectivo].monto -= vueltoDelPago;
                if (pagosValidos[indexEfectivo].monto < 0) {
                    return toast.error("El monto de vuelto supera el efectivo ingresado. Revisa los pagos.");
                }
            } else {
                return toast.error("La suma de pagos excede el total. Sólo se puede dar vuelto si incluyes un pago de contado (Efectivo).");
            }
        }

        if (!confirm(`¿Confirmar venta por un total de $${totalFinal.toFixed(2)}${vueltoDelPago > 0 ? ` entregando $${vueltoDelPago.toFixed(2)} de vuelto` : ''}?`)) return;

        let fechaVencimiento = null;
        if (tieneCuentaCorriente) {
            const f = new Date(fechaEmision);
            f.setDate(f.getDate() + (diasCongelamiento || 0));
            fechaVencimiento = f.toISOString();
        }

        let finalCarrito = [...carrito];
        let subtotalVenta = subtotalCarrito;
        let descuentoGlobalVenta = montoDescuentoGlobal;
        let totalVenta = totalFinal;

        // Repartir Recargo de Tarjeta por Cada Producto individualmente
        if (montoRecargosTarjetas > 0) {
            const factorMultiplicador = 1 + (montoRecargosTarjetas / totalParcial);
            finalCarrito = carrito.map(item => {
                const nuevoPrecioUnitario = Number((item.precio_unitario * factorMultiplicador).toFixed(2));
                const nuevoPrecioFinal = Number((item.precio_final * factorMultiplicador).toFixed(2));
                return {
                    ...item,
                    precio_unitario: nuevoPrecioUnitario,
                    precio_final: nuevoPrecioFinal,
                    subtotal: Number((item.cantidad * nuevoPrecioFinal).toFixed(2))
                };
            });
            
            subtotalVenta = finalCarrito.reduce((acc, i) => acc + i.subtotal, 0);
            descuentoGlobalVenta = subtotalVenta * ((descuentoGlobal || 0) / 100);
            totalVenta = subtotalVenta - descuentoGlobalVenta;
            
            // Reajustar diferencias mínimas de centavos al primer método de pago (si era automático)
            if (pagosValidos.length === 1 && pagosValidos[0].monto === totalFinal) {
                pagosValidos[0].monto = totalVenta;
            }
        }

        startTransition(async () => {
            const payload = {
                sucursalId: sucursalActivaId,
                depositoId: depositoActivoId,
                fecha_emision: fechaEmision,
                tipo_comprobante: tipoComprobante,
                clienteId: clienteSeleccionado.id,
                listaPrecioId: Number(listaPrecioSeleccionada),
                metodo_pago: pagosValidos[0].metodo_pago,
                pagos: pagosValidos,
                fecha_vencimiento_cc: fechaVencimiento,
                requiere_envio: requiereEnvio,
                direccion_envio: requiereEnvio ? direccionEnvio : null,
                detalles: detallesVenta,
                comentario_venta: comentarioVenta,
                subtotal: subtotalVenta,
                descuento_global: descuentoGlobalVenta,
                total: totalVenta,
                carrito: finalCarrito
            };

            const res = await registrarVenta(payload);

            if (res.success && res.ventaId) {
                toast.success("¡Venta registrada exitosamente!");
                setVentaExitosa({
                    id: res.ventaId,
                    comprobante: `000${comprobanteNumeros.punto_venta}-${comprobanteNumeros.numero_str}`
                });

                // Reset — Auto-seleccionar CF de nuevo
                const cf = await getConsumidorFinal();
                if (cf) {
                    setClienteSeleccionado(cf);
                    if (cf.lista_default_id) setListaPrecioSeleccionada(String(cf.lista_default_id));
                } else {
                    setClienteSeleccionado(null);
                    setListaPrecioSeleccionada("");
                }
                setCarrito([]);
                setDescuentoGlobal(0);
                setRequiereEnvio(false);
                setDireccionEnvio("");
                setDetallesVenta("");
                setComentarioVenta("");
                setPagos([{ metodo_pago: "CONTADO", monto: "" }]);
                fetchNumeros();
            } else {
                toast.error(res.error || "Error al registrar la venta.");
                // Bug fix: Do NOT reset pagos so user can fix the problem.
            }
        });
    };

    return (
        <div className="flex flex-col gap-4 w-full h-full min-h-[calc(100vh-6rem)] relative">

            {/* HEADER MODERNO CON SELECTOR DE SUCURSAL */}
            <div className="flex flex-col md:flex-row items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm shrink-0">
                <div className="flex items-center gap-3 w-full md:w-auto mb-4 md:mb-0">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 p-2.5 rounded-lg shrink-0">
                        <ShoppingCart className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Terminal de Ventas</h2>
                        <p className="text-sm text-slate-500 hidden sm:block">Facturación rápida</p>
                    </div>
                </div>

                {/* SELECTOR DE SUCURSAL - SOLO PARA ADMINS O USUARIOS GLOBALES */}
                {usuarioSesion?.rol === 'ADMIN' && (
                    <div className="flex flex-col items-start gap-1 w-full md:w-auto mb-4 md:mb-0 md:ml-4">
                        <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Sucursal Operativa</Label>
                        <Select
                            value={String(sucursalActivaId || "")}
                            onValueChange={(val) => setSucursalActivaId(Number(val))}
                        >
                            <SelectTrigger className="h-9 w-full md:w-[220px] bg-slate-50 dark:bg-zinc-800/50">
                                <SelectValue placeholder="Seleccione Sucursal..." />
                            </SelectTrigger>
                            <SelectContent>
                                {sucursales.map(s => (
                                    <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto ml-auto">
                    <div className="flex flex-col items-center sm:items-start gap-1">
                        <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Fecha</Label>
                        <Input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} className="h-9 text-sm font-medium bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 w-[140px]" />
                    </div>
                    <div className="flex flex-col items-center sm:items-start gap-1">
                        <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Comprobante</Label>
                        <Select value={tipoComprobante} onValueChange={(v) => setTipoComprobante(v || "")}>
                            <SelectTrigger className="h-9 text-sm font-bold bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 w-[190px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="COMPROBANTE_X">Ticket No Fiscal (X)</SelectItem>
                                <SelectItem value="FACTURA_A">Factura Fiscal A</SelectItem>
                                <SelectItem value="FACTURA_B">Factura Fiscal B</SelectItem>
                                <SelectItem value="FACTURA_C">Factura Fiscal C</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="hidden sm:block h-10 w-px bg-slate-200 dark:bg-zinc-800 mx-2"></div>
                    <div className="text-center sm:text-right px-2">
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Nº Documento</p>
                        <p className="text-lg font-mono font-bold text-slate-700 dark:text-slate-300">000{comprobanteNumeros.punto_venta}-{comprobanteNumeros.numero_str}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">

                {/* PANEL IZQUIERDO: CARRITO */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                    <Card className="flex-1 shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
                            <h3 className="font-semibold text-lg">Detalle de Compra</h3>
                            <Button onClick={() => setShowProductoModal(true)} disabled={!listaPrecioSeleccionada} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm">
                                <PackageSearch className="w-4 h-4 mr-2" /> Buscar Producto
                            </Button>
                        </div>

                        <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-zinc-900/50">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 sticky top-0 z-10 text-slate-500 border-b border-slate-200 dark:border-zinc-800">
                                    <tr>
                                        <th className="px-4 py-3 w-[35%] font-semibold">Producto</th>
                                        <th className="px-4 py-3 w-[12%] font-semibold text-center">Cant.</th>
                                        <th className="px-4 py-3 w-[10%] font-semibold text-center">Unid.</th>
                                        <th className="px-4 py-3 w-[12%] font-semibold text-center">Desc. %</th>
                                        <th className="px-4 py-3 w-[15%] font-semibold text-right">P. Final</th>
                                        <th className="px-4 py-3 w-[15%] font-semibold text-right">Subtotal</th>
                                        <th className="px-2 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {carrito.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-20 text-slate-400 dark:text-zinc-600">
                                                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                                <p className="text-base font-medium">El carrito está vacío</p>
                                                <p className="text-sm">Seleccione una lista de precios y busque productos.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        carrito.map((item, index) => {
                                            const tipo = (item.tipo_medicion || "UNIDAD") as TipoMedicionType;
                                            const step = getStepParaMedicion(tipo);
                                            return (
                                                <tr key={index} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors bg-white dark:bg-zinc-900">
                                                    <td className="px-4 py-3">
                                                        <p className="font-semibold text-sm line-clamp-1">{item.nombre}</p>
                                                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{item.codigo}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Input type="number" step={step} value={item.cantidad || ""} onChange={(e) => handleActualizarItem(index, "cantidad", e.target.value)} className="h-9 w-20 text-center mx-auto font-medium bg-slate-50 dark:bg-zinc-800" />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Badge variant="outline" className="text-[10px] font-bold">{getUnidadLabel(tipo)}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Input type="number" step="0.1" value={item.descuento_individual || ""} onChange={(e) => handleActualizarItem(index, "descuento_individual", e.target.value)} className="h-9 w-20 text-center mx-auto bg-slate-50 dark:bg-zinc-800" />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="relative max-w-[100px] ml-auto">
                                                            <span className="absolute left-2 top-2 text-slate-400 text-xs">$</span>
                                                            <Input type="number" step="1" value={item.precio_final || ""} onChange={(e) => handleActualizarItem(index, "precio_final", e.target.value)} className="h-9 pl-5 font-medium text-right bg-slate-50 dark:bg-zinc-800" disabled />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-base text-slate-900 dark:text-slate-100">
                                                        ${item.subtotal.toFixed(2)}
                                                    </td>
                                                    <td className="px-2 py-3 text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => setCarrito(carrito.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 h-8 w-8 rounded-md">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* PANEL DERECHO: CLIENTE Y FACTURACIÓN */}
                <div className="lg:col-span-4 flex flex-col gap-4">

                    <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                        <CardHeader className="py-3 px-4 border-b border-slate-100 dark:border-zinc-800 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                <User className="h-4 w-4 text-slate-400" /> Cliente y Tarifario
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            {!clienteSeleccionado ? (
                                <Button onClick={() => setShowClienteModal(true)} variant="outline" className="w-full h-12 border-dashed hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 transition-all text-slate-500 font-medium">
                                    <Search className="w-4 h-4 mr-2" /> Buscar Cliente
                                </Button>
                            ) : (
                                <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 relative flex flex-col gap-2">
                                    <Button variant="ghost" size="sm" onClick={handleLimpiarCliente} className="absolute right-1 top-1 h-6 text-[10px] text-slate-400 hover:text-red-500 font-medium">Cambiar</Button>
                                    <div>
                                        <p className="font-bold text-base text-slate-900 dark:text-slate-100 pr-12 truncate">{clienteSeleccionado.nombre_razon_social}</p>
                                        <p className="text-xs font-mono text-slate-500 mt-0.5">DNI/CUIT: {clienteSeleccionado.dni_cuit || "Consumidor Final"}</p>
                                    </div>

                                    {cargandoResumen ? (
                                        <div className="flex items-center gap-2 mt-1 px-2 py-1.5 bg-slate-100 dark:bg-zinc-800 rounded-md w-fit">
                                            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Verificando saldos...</span>
                                        </div>
                                    ) : resumenFinanciero && (
                                        <div className="mt-1 flex items-center gap-2">
                                            {resumenFinanciero.deuda > 0 ? (
                                                <button onClick={() => setShowResumenModal(true)} type="button" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-red-700 dark:text-red-400 rounded-md transition-colors border border-red-200 dark:border-red-500/20 w-fit">
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                    <span className="text-[11px] font-black uppercase tracking-wider">TIPO: DEUDOR por ${resumenFinanciero.deuda.toFixed(2)}</span>
                                                </button>
                                            ) : resumenFinanciero.saldo_a_favor > 0 ? (
                                                <button onClick={() => setShowResumenModal(true)} type="button" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-100 dark:bg-emerald-500/10 hover:bg-emerald-200 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-md transition-colors border border-emerald-200 dark:border-emerald-500/20 w-fit">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    <span className="text-[11px] font-black uppercase tracking-wider">SALDO A FAVOR: ${resumenFinanciero.saldo_a_favor.toFixed(2)}</span>
                                                </button>
                                            ) : (
                                                <button onClick={() => setShowResumenModal(true)} type="button" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-slate-400 rounded-md transition-colors border border-slate-200 dark:border-zinc-700 w-fit">
                                                    <CheckSquare className="h-3.5 w-3.5" />
                                                    <span className="text-[11px] font-bold uppercase tracking-wider">CUENTA AL DÍA (SALDO $0)</span>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-1.5 pt-1">
                                <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Lista de Precios Aplicada</Label>
                                <Select value={listaPrecioSeleccionada} onValueChange={(v) => handleCambioLista(v || "")} disabled={!clienteSeleccionado}>
                                    <SelectTrigger className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 font-medium h-9">
                                        <SelectValue placeholder="Seleccione una lista...">{listaSeleccionadaObj ? listaSeleccionadaObj.nombre : "Seleccione una lista..."}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {listasGlobales.map(l => (<SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* ALERTA FACTURA A */}
                            {tipoComprobante === "FACTURA_A" && clienteSeleccionado && 
                             clienteSeleccionado.condicion_iva !== "Responsable Inscripto" && 
                             clienteSeleccionado.condicion_iva !== "RESPONSABLE_INSCRIPTO" &&
                             clienteSeleccionado.condicion_iva !== "Monotributo" && (
                                <div className="p-3 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 text-xs font-bold rounded-lg border border-red-200 dark:border-red-500/20">
                                    El cliente no es Responsable Inscripto o Monotributista. No se podrá emitir Factura A en AFIP.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-1 flex flex-col">
                        <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">

                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="envio" checked={requiereEnvio} onCheckedChange={(val) => setRequiereEnvio(!!val)} className="border-slate-300 data-[state=checked]:bg-indigo-600" />
                                    <Label htmlFor="envio" className="cursor-pointer font-medium text-sm flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                        <Truck className="h-3 w-3 text-slate-400" /> Envío a domicilio
                                    </Label>
                                </div>
                                {requiereEnvio && (
                                    <Input placeholder="Dirección de entrega..." value={direccionEnvio} onChange={e => setDireccionEnvio(e.target.value)} className="h-9 text-sm bg-slate-50 dark:bg-zinc-800/50" />
                                )}

                                <div className="space-y-1.5 pt-2">
                                    <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider flex items-center gap-1"><StickyNote className="h-3 w-3" /> Notas de Venta</Label>
                                    <Textarea placeholder="Ej: Entregar por la tarde..." value={detallesVenta} onChange={e => setDetallesVenta(e.target.value)} className="resize-none h-14 bg-slate-50 dark:bg-zinc-800/50 text-sm border-slate-200 dark:border-zinc-700" />
                                </div>

                                {/* === COMENTARIO DE VENTA (NUEVO) === */}
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Comentario interno</Label>
                                    <Input placeholder="Ej: Cliente frecuente, dio seña..." value={comentarioVenta} onChange={e => setComentarioVenta(e.target.value)} className="h-9 text-sm bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" />
                                </div>
                            </div>

                            <Separator className="bg-slate-100 dark:bg-zinc-800 my-4" />

                            <div className="space-y-2.5">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">Subtotal</span>
                                    <span className="font-mono font-medium">${subtotalCarrito.toFixed(2)}</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-500">Descuento Global (%)</span>
                                    <div className="flex flex-col items-end">
                                        <div className="relative">
                                            <Input type="number" value={descuentoGlobal || ""} onChange={(e) => setDescuentoGlobal(Number(e.target.value))} className="w-20 h-8 pr-6 text-right font-medium bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" />
                                            <span className="absolute right-2 top-1.5 text-slate-400 text-xs">%</span>
                                        </div>
                                        {descuentoGlobal > 0 && (
                                            <span className="text-[10px] text-emerald-600 font-semibold mt-1">- ${montoDescuentoGlobal.toFixed(2)}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 space-y-4">
                                <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 flex flex-col items-center justify-center text-center">
                                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-widest mb-1">Total a Cobrar</span>
                                    <span className="text-4xl font-black tracking-tighter text-indigo-600 dark:text-indigo-400">${totalFinal.toFixed(2)}</span>
                                </div>

                                {/* === PAGOS MÚLTIPLES === */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider flex items-center gap-1">
                                            <CreditCard className="h-3 w-3" /> Métodos de Pago
                                        </Label>
                                        <Button type="button" variant="ghost" size="sm" onClick={agregarLineaPago} className="text-indigo-600 hover:text-indigo-700 text-xs h-7">
                                            <Plus className="h-3 w-3 mr-1" /> Agregar
                                        </Button>
                                    </div>

                                    {pagos.map((pago, i) => (
                                        <div key={i} className="flex flex-col gap-2 p-2 mb-2 bg-slate-50 dark:bg-zinc-800/10 rounded-lg border border-slate-100 dark:border-zinc-800/50">
                                            <div className="flex gap-2 items-center">
                                                <Select value={pago.metodo_pago} onValueChange={(val) => {
                                                    actualizarPago(i, "metodo_pago", val || "");
                                                    if (val === "SALDO_A_FAVOR" && resumenFinanciero?.saldo_a_favor > 0) {
                                                        const sumaOtros = pagos.filter((_, idx) => idx !== i).reduce((a, b) => a + (Number(b.monto) || 0), 0);
                                                        const maxAFavor = Math.min(resumenFinanciero.saldo_a_favor, Math.max(0, totalFinal - sumaOtros));
                                                        actualizarPago(i, "monto", maxAFavor.toFixed(2));
                                                    }
                                                }}>
                                                    <SelectTrigger className="bg-white dark:bg-zinc-900 h-9 font-semibold border-slate-200 dark:border-zinc-700 flex-1 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="CONTADO">Efectivo</SelectItem>
                                                        <SelectItem value="CUENTA_CORRIENTE" className="text-orange-600 font-bold">Cta. Corriente</SelectItem>
                                                        <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                                                        <SelectItem value="TARJETA">Tarjeta</SelectItem>
                                                        {resumenFinanciero && resumenFinanciero.saldo_a_favor > 0 && (
                                                            <SelectItem value="SALDO_A_FAVOR" className="text-emerald-600 font-bold">
                                                                Usar Saldo a Favor (Disp: ${resumenFinanciero.saldo_a_favor.toFixed(2)})
                                                            </SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <div className="relative w-28">
                                                    <span className="absolute left-2 top-2 text-slate-400 text-xs">$</span>
                                                    <Input type="number" step="0.01" placeholder={pagos.length === 1 ? totalFinal.toFixed(2) : "0.00"}
                                                        value={pago.monto} onChange={(e) => actualizarPago(i, "monto", e.target.value)}
                                                        className="h-9 pl-5 text-right font-bold bg-white dark:bg-zinc-900 border-slate-200" />
                                                </div>
                                                {pagos.length > 1 && (
                                                    <Button variant="ghost" size="icon" onClick={() => eliminarLineaPago(i)} className="h-8 w-8 text-red-400 hover:text-red-600 shrink-0">
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                            {pago.metodo_pago === 'TARJETA' && (
                                                <div className="flex gap-2 items-center flex-wrap pt-1 animate-in fade-in">
                                                    <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-2 py-1 rounded-md border border-slate-200 dark:border-zinc-700">
                                                        <Label className="text-[10px] uppercase font-bold text-slate-500">Cuotas</Label>
                                                        <Input type="number" placeholder="1" className="h-7 w-16 text-center text-xs font-bold bg-slate-50 dark:bg-zinc-800 border-slate-200" value={pago.cuotas || ""} onChange={(e) => actualizarPago(i, "cuotas", e.target.value)} />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-2 py-1 rounded-md border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/30">
                                                        <Label className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">% Recargo</Label>
                                                        <Input type="number" placeholder="0" className="h-7 w-16 text-center text-xs font-bold border-indigo-200 bg-white" value={pago.recargo_porcentaje || ""} onChange={(e) => actualizarPago(i, "recargo_porcentaje", e.target.value)} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {pagos.length >= 1 && (
                                        <div className={`mt-2 flex items-center justify-between p-3 rounded-lg border ${totalPagos > totalFinal + 0.01 ? 'bg-emerald-50 border-emerald-200' : totalPagos < totalFinal - 0.01 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-slate-500">Suma ingresada</p>
                                                <p className={`font-bold ${totalPagos > totalFinal + 0.01 ? 'text-emerald-700' : totalPagos < totalFinal - 0.01 ? 'text-red-600' : 'text-slate-700'}`}>${totalPagos.toFixed(2)}</p>
                                            </div>
                                            <div className="text-right">
                                                {totalPagos < totalFinal - 0.01 && (
                                                    <>
                                                        <Label className="text-[10px] uppercase text-red-600 font-bold tracking-wider">Falta abonar</Label>
                                                        <p className="text-xl font-black text-red-600">${(totalFinal - totalPagos).toFixed(2)}</p>
                                                    </>
                                                )}
                                                {totalPagos > totalFinal + 0.01 && (
                                                    pagos.some(p => p.metodo_pago === 'CONTADO') ? (
                                                        <>
                                                            <Label className="text-[10px] uppercase text-emerald-600 font-bold tracking-wider">Vuelto</Label>
                                                            <p className="text-xl font-black text-emerald-600">${(totalPagos - totalFinal).toFixed(2)}</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Label className="text-[10px] uppercase text-red-600 font-bold tracking-wider">Excede el total!</Label>
                                                            <p className="text-sm font-bold text-red-600">No hay efectivo para vuelto</p>
                                                        </>
                                                    )
                                                )}
                                                {Math.abs(totalPagos - totalFinal) <= 0.01 && (
                                                    <div className="flex items-center gap-1 text-emerald-600 font-bold">
                                                        <CheckCircle2 className="h-5 w-5" /> Coincide
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {tieneCuentaCorriente && (
                                        <div className="p-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-lg mt-2 animate-in fade-in">
                                            <Label className="text-[10px] uppercase text-orange-600 dark:text-orange-400 font-bold tracking-wider block mb-1">Plazo Congelado (Días)</Label>
                                            <Input type="number" value={diasCongelamiento} onChange={(e) => setDiasCongelamiento(Number(e.target.value))} className="w-20 h-8 font-mono font-medium bg-white dark:bg-zinc-900 border-orange-200 dark:border-orange-500/30 text-center" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <Button variant="outline" size="lg" onClick={() => { if(!confirm('¿Cancelar y vaciar pestaña?')) return; setClienteSeleccionado(null); setCarrito([]); setDescuentoGlobal(0); setPagos([{metodo_pago:'CONTADO', monto:''}]); setShowClienteModal(false); }} className="w-1/3 h-12 text-red-500 border-red-200 hover:bg-red-50 font-bold">
                                        Cancelar
                                    </Button>
                                    <Button size="lg" onClick={handleProcesarVenta} disabled={isPending || carrito.length === 0 || !clienteSeleccionado}
                                        className="w-2/3 h-12 text-base font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all">
                                        {isPending ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                                        Confirmar Venta
                                    </Button>
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ========= MODAL VENTA EXITOSA ========= */}
            {ventaExitosa && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
                    <Card className="w-full max-w-sm shadow-2xl border border-slate-200 dark:border-zinc-800 rounded-[2rem] flex flex-col overflow-hidden">
                        <div className="bg-emerald-500 p-8 flex flex-col items-center justify-center text-white text-center">
                            <div className="bg-white/20 p-4 rounded-full mb-4 shadow-sm"><CheckCircle2 className="h-10 w-10 text-white" /></div>
                            <h3 className="text-2xl font-black tracking-tight">¡Venta Registrada!</h3>
                            <p className="text-emerald-100 text-sm mt-1 font-medium bg-black/10 px-3 py-1 rounded-full">Comprobante Nº {ventaExitosa.comprobante}</p>
                        </div>
                        <CardContent className="p-6 space-y-3 bg-white dark:bg-zinc-900">
                            <p className="text-xs text-center font-bold text-slate-400 uppercase tracking-wider mb-2">Entregar Comprobante</p>
                            <div onClick={() => setImprimirConDescuentos(!imprimirConDescuentos)} className="flex items-center justify-center gap-2 p-2.5 mb-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                                {imprimirConDescuentos ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4 text-slate-400" />}
                                <span className="text-xs font-medium text-slate-700 select-none">Detallar descuentos en el papel</span>
                            </div>
                            <div onClick={() => window.location.href = `/imprimir/ticket/${ventaExitosa.id}?descuentos=${imprimirConDescuentos}`} className="block">
                                <Button className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold text-base shadow-sm"><Printer className="h-5 w-5 mr-2" /> Imprimir Ticket (80mm)</Button>
                            </div>
                            <div onClick={() => window.location.href = `/imprimir/a4/${ventaExitosa.id}?descuentos=${imprimirConDescuentos}`} className="block">
                                <Button variant="outline" className="w-full h-12 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-base"><FileText className="h-5 w-5 mr-2" /> Imprimir Hoja A4</Button>
                            </div>
                            <div className="pt-4 mt-2 border-t border-slate-100 dark:border-zinc-800">
                                <Button variant="ghost" onClick={() => setVentaExitosa(null)} className="w-full h-12 text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold">
                                    Cerrar y Vender
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ========= MODAL BUSCADOR DE CLIENTES ========= */}
            {showClienteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[85vh] overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-900">
                            <h3 className="text-lg font-semibold flex items-center gap-2"><User className="h-5 w-5 text-indigo-500" /> Buscar Cliente</h3>
                            <Button variant="ghost" type="button" size="icon" onClick={(e) => { e.preventDefault(); setShowClienteModal(false); }} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></Button>
                        </div>
                        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                <Input autoFocus placeholder="Nombre, apellido o DNI..." className="pl-9 h-11 text-sm bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" value={clienteQuery} onChange={(e) => setClienteQuery(e.target.value)} />
                            </div>
                            <Button onClick={() => { setShowClienteModal(false); setShowNuevoClienteModal(true); }} className="h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium">
                                <UserPlus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Nuevo</span>
                            </Button>
                        </div>
                        <div className="overflow-y-auto p-2 flex-1">
                            {clientesResultados.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 text-sm">Escriba para buscar...</div>
                            ) : (
                                <div className="space-y-1">
                                    {clientesResultados.map(cli => (
                                        <div key={cli.id} onClick={() => handleSeleccionarCliente(cli)} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-lg cursor-pointer transition-colors">
                                            <div>
                                                <p className="font-semibold text-sm">{cli.nombre_razon_social}</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">DNI/CUIT: {cli.dni_cuit || "N/A"}</p>
                                            </div>
                                            <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded">{cli.lista_default ? cli.lista_default.nombre : "Sin Lista"}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ========= MODAL CREAR CLIENTE RÁPIDO ========= */}
            {showNuevoClienteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-md shadow-2xl border border-slate-200 dark:border-zinc-800 rounded-2xl flex flex-col">
                        <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-4 shrink-0 rounded-t-2xl">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4 text-indigo-500" /> Alta Rápida</CardTitle>
                                <Button variant="ghost" type="button" size="icon" onClick={(e) => { e.preventDefault(); setShowNuevoClienteModal(false); setShowClienteModal(false); }} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-200"><X className="h-4 w-4" /></Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-5">
                            <form onSubmit={handleCrearClienteRapido} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Razón Social / Nombre <span className="text-red-500">*</span></Label>
                                    <Input name="nombre_razon_social" autoFocus required className="h-10" placeholder="Ej: Juan Pérez" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5"><Label className="text-xs font-semibold">DNI o CUIT</Label><Input name="dni_cuit" className="h-10" /></div>
                                    <div className="space-y-1.5"><Label className="text-xs font-semibold">Teléfono</Label><Input name="telefono" className="h-10" /></div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Tarifa por Defecto</Label>
                                    <Select name="lista_default_id">
                                        <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Seleccione tarifa..." /></SelectTrigger>
                                        <SelectContent>{listasGlobales.map(l => (<SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                                <input type="hidden" name="comprobante_default" value="COMPROBANTE_X" />
                                <div className="flex gap-2 pt-2 border-t border-slate-100">
                                    <Button type="button" variant="ghost" onClick={() => { setShowNuevoClienteModal(false); setShowClienteModal(true); }} className="w-1/3 text-slate-600 font-medium">Volver</Button>
                                    <Button type="submit" disabled={isPending} className="w-2/3 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm">
                                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar y Usar"}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ========= MODAL BUSCADOR DE PRODUCTOS ========= */}
            {showProductoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[85vh] overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-900">
                            <h3 className="text-lg font-semibold flex items-center gap-2"><PackageSearch className="h-5 w-5 text-indigo-500" /> Catálogo de Productos</h3>
                            <Button variant="ghost" size="icon" onClick={() => setShowProductoModal(false)} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></Button>
                        </div>
                        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                <Input autoFocus placeholder="Código o nombre..." className="pl-9 h-11 text-sm bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" value={productoQuery} onChange={(e) => setProductoQuery(e.target.value)} />
                            </div>
                            <div className="bg-slate-50 dark:bg-zinc-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 shrink-0 text-right">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block leading-none mb-1">Lista Activa</span>
                                <span className="font-semibold text-sm leading-none">{listaSeleccionadaObj?.nombre}</span>
                            </div>
                        </div>
                        <div className="overflow-y-auto p-3 flex-1 bg-slate-50/50 dark:bg-zinc-900/50">
                            {productosResultados.length === 0 ? (
                                <div className="text-center py-16 text-slate-400">
                                    <PackageSearch className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm font-medium">Escriba para buscar artículos</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {productosResultados.map(prod => {
                                        const listaIDNum = Number(listaPrecioSeleccionada);
                                        const pivot = prod.listas_precios?.find((p: any) => p.listaPrecioId === listaIDNum);
                                        const listaGlobal = listasGlobales.find(l => l.id === listaIDNum);
                                        const margenFinal = (pivot?.margen_personalizado !== null && pivot?.margen_personalizado !== undefined)
                                            ? Number(pivot.margen_personalizado)
                                            : Number(listaGlobal?.margen_defecto || 0);

                                        const aumProv = prod.proveedor?.aumento_porcentaje || 0;
                                        const aumMarca = prod.marca?.aumento_porcentaje || 0;
                                        const aumCat = prod.categoria?.aumento_porcentaje || 0;

                                        const precioPreview = calcularPrecioConCascada(
                                            prod.precio_costo, prod.descuento_proveedor, prod.alicuota_iva,
                                            aumProv, aumMarca, aumCat, margenFinal
                                        );

                                        const sinStock = prod.stock_actual <= 0;
                                        const noTieneLista = !pivot;
                                        const tipo = (prod.tipo_medicion || "UNIDAD") as TipoMedicionType;

                                        return (
                                            <div key={prod.id} className={`flex flex-col p-3 rounded-xl border transition-all bg-white dark:bg-zinc-900 shadow-sm gap-2 ${sinStock ? 'border-red-200 bg-red-50/50 opacity-75' : noTieneLista ? 'border-amber-200 bg-amber-50/50 opacity-75' : 'border-slate-200 dark:border-zinc-700 hover:border-indigo-200 hover:bg-white dark:hover:bg-zinc-800'}`}>
                                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-sm">{prod.nombre_producto}</p>
                                                    <div className="flex flex-wrap gap-2 mt-1.5">
                                                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">Cód: {prod.codigo_barras !== "0" ? prod.codigo_barras : prod.codigo_articulo}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sinStock ? 'text-red-600 bg-red-100' : prod.stock_actual > prod.stock_recomendado ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' : 'text-orange-600 bg-orange-50'}`}>
                                                            Stock: {formatCantidad(prod.stock_actual, tipo)} {getUnidadLabel(tipo)}
                                                        </span>
                                                        {sinStock && <Badge variant="destructive" className="text-[10px] h-5"><AlertTriangle className="h-3 w-3 mr-1" />SIN STOCK</Badge>}
                                                        {noTieneLista && <Badge variant="outline" className="text-[10px] h-5 border-amber-300 text-amber-700">NO EN ESTA LISTA</Badge>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                                                    <div className="text-right">
                                                        <p className="text-[10px] uppercase font-bold text-slate-400">Precio Final</p>
                                                        <p className="font-black text-lg text-slate-900 dark:text-slate-100">{noTieneLista ? "-" : `$${precioPreview.toFixed(2)}`}</p>
                                                    </div>
                                                    <Button variant="outline" size="icon" className="h-9 w-9 text-slate-500 hover:text-indigo-600" onClick={() => setExpandedProdId(expandedProdId === prod.id ? null : prod.id)}>
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button onClick={() => handleAgregarAlCarrito(prod)} size="sm" disabled={sinStock || noTieneLista}
                                                        className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 h-9 px-4 disabled:opacity-40">
                                                        <Plus className="h-4 w-4 mr-1" /> Añadir
                                                    </Button>
                                                    </div>
                                                </div>
                                                
                                                {/* PANEL EXPANDIDO DE COSTOS Y LISTAS */}
                                                {expandedProdId === prod.id && (
                                                    <div className="w-full mt-2 pt-3 border-t border-slate-100 dark:border-zinc-800 animate-in slide-in-from-top-2">
                                                        <div className="p-3 bg-slate-50 dark:bg-zinc-800/80 rounded-lg">
                                                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200 dark:border-zinc-700">
                                                                <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">Precio Costo Base</span>
                                                                <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">${prod.precio_costo.toFixed(2)}</span>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {listasGlobales.map(lista => {
                                                                    const pivotInfo = prod.listas_precios?.find((p: any) => p.listaPrecioId === lista.id);
                                                                    const mFinal = (pivotInfo?.margen_personalizado !== null && pivotInfo?.margen_personalizado !== undefined)
                                                                        ? Number(pivotInfo.margen_personalizado)
                                                                        : Number(lista?.margen_defecto || 0);

                                                                    const pPreview = calcularPrecioConCascada(
                                                                        prod.precio_costo, prod.descuento_proveedor, prod.alicuota_iva,
                                                                        aumProv, aumMarca, aumCat, mFinal
                                                                    );
                                                                    const isSelected = String(lista.id) === listaPrecioSeleccionada;
                                                                    
                                                                    return (
                                                                        <div key={lista.id} className={`flex justify-between items-center p-2 rounded-md border ${isSelected ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' : 'bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-700 text-slate-600 dark:text-slate-400'}`}>
                                                                            <span className={`text-[11px] ${isSelected ? 'font-bold' : 'font-medium'}`}>{lista.nombre} <span className="opacity-60 font-mono ml-0.5">+{mFinal}%</span></span>
                                                                            <span className={`font-mono text-sm ${isSelected ? 'font-black' : 'font-semibold'}`}>${pPreview.toFixed(2)}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ========= MODAL RESUMEN FINANCIERO ========= */}
            {showResumenModal && resumenFinanciero && clienteSeleccionado && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
                    <Card className="w-full max-w-md shadow-2xl border border-slate-200 dark:border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
                        <CardHeader className="py-4 px-6 border-b border-slate-100 dark:border-zinc-800 flex flex-row items-center justify-between bg-slate-50 dark:bg-zinc-900/50">
                            <div>
                                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                    Resumen de Cuenta
                                </CardTitle>
                                <p className="text-xs text-slate-500 mt-0.5">{clienteSeleccionado.nombre_razon_social}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowResumenModal(false)} className="h-8 w-8 text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-full">
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-6 bg-white dark:bg-zinc-900 space-y-6">

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 rounded-xl flex flex-col items-center text-center">
                                    <span className="text-[10px] uppercase font-bold text-red-500 mb-1">Deuda Vigente</span>
                                    <span className="text-2xl font-black text-red-600 dark:text-red-400">${resumenFinanciero.deuda.toFixed(2)}</span>
                                </div>
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 rounded-xl flex flex-col items-center text-center">
                                    <span className="text-[10px] uppercase font-bold text-emerald-500 mb-1">Dinero a Favor</span>
                                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">${resumenFinanciero.saldo_a_favor.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">Balance Neto Contable:</span>
                                    <span className={`font-mono font-bold ${resumenFinanciero.balance > 0 ? 'text-emerald-600' : resumenFinanciero.balance < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                        ${resumenFinanciero.balance.toFixed(2)}
                                    </span>
                                </div>

                                {resumenFinanciero.fecha_mas_antigua && resumenFinanciero.deuda > 0 && (
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Deuda más antigua desde:</span>
                                        <span className="font-medium text-slate-800 dark:text-slate-200">
                                            {new Date(resumenFinanciero.fecha_mas_antigua).toLocaleDateString('es-AR')}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-slate-200 dark:border-zinc-700">
                                <p className="text-xs text-slate-500 italic text-center leading-snug">
                                    {resumenFinanciero.deuda > 0
                                        ? "El cliente presenta saldos atrasados. Operá a cuenta corriente dictando el riesgo."
                                        : "El cliente se encuentra al día con sus obligaciones o tiene crédito."}
                                </p>
                            </div>

                            <Button onClick={() => setShowResumenModal(false)} className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold h-11">
                                Entendido, volver a la venta
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

        </div>
    );
}

function PuntoDeVentaTabsPage() {
    const [tabs, setTabs] = useState([{ id: 1, name: "Venta 1" }]);
    const [activeTab, setActiveTab] = useState(1);
    const [cartsPerTab, setCartsPerTab] = useState<Record<number, any[]>>({});

    const addTab = () => {
        const nextId = tabs.length > 0 ? Math.max(...tabs.map(t => t.id)) + 1 : 1;
        setTabs([...tabs, { id: nextId, name: `Venta ${nextId}` }]);
        setActiveTab(nextId);
    };

    const removeTab = (id: number) => {
        if (tabs.length === 1) return;
        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);
        if (activeTab === id) setActiveTab(newTabs[0].id);
        
        const newCarts = { ...cartsPerTab };
        delete newCarts[id];
        setCartsPerTab(newCarts);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] relative">
            <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1 shrink-0">
                {tabs.map(tab => (
                    <div key={tab.id} className={`flex items-center gap-2 px-4 py-2 rounded-t-xl border-t border-x cursor-pointer transition-colors ${activeTab === tab.id ? 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-indigo-600 font-bold shadow-sm' : 'bg-slate-50 dark:bg-zinc-900/50 border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`} onClick={() => setActiveTab(tab.id)}>
                        <span>{tab.name}</span>
                        {tabs.length > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); removeTab(tab.id); }} className="hover:text-red-500 rounded-full p-0.5"><X className="h-4 w-4" /></button>
                        )}
                    </div>
                ))}
                <button onClick={addTab} className="flex items-center gap-1 px-3 py-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                    <Plus className="h-4 w-4" /> Nueva Pestaña
                </button>
            </div>

            <div className="flex-1 bg-transparent overflow-hidden">
                {tabs.map(tab => (
                    <div key={tab.id} className={activeTab === tab.id ? "block h-full overflow-y-auto" : "hidden"}>
                        <PosTerminal 
                           tabId={tab.id} 
                           updateCartInfo={(cart: any[]) => setCartsPerTab(prev => ({...prev, [tab.id]: cart}))}
                           allOtherCarts={Object.entries(cartsPerTab).filter(([k]) => Number(k) !== tab.id).flatMap(([_, v]) => v)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}