"use client";

import { useState, useTransition, useEffect } from "react";
import { getClientes, crearCliente, actualizarCliente, eliminarCliente, getHistorialCliente, getResumenFinancieroCliente, cobrarCuentaCorriente, buscarCuitEnAfip } from "@/app/actions/clientes";
import { getListasPrecio } from "@/app/actions/configuracion";
import { toast } from "sonner";
import { Loader2, Users, UserPlus, History, Receipt, DollarSign, X, Pencil, Trash2, FolderOpen, ArrowRight, ExternalLink, CreditCard, Plus, CheckCircle2, Search } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatFechaHoraLocal, formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function ClientesPage() {
    const [isPending, startTransition] = useTransition();
    const [listas, setListas] = useState<any[]>([]);
    const [clientes, setClientes] = useState<any[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [showAlta, setShowAlta] = useState(false);

    const clientesFiltrados = clientes.filter(c => 
        c.nombre_razon_social.toLowerCase().includes(busqueda.toLowerCase()) || 
        (c.dni_cuit && c.dni_cuit.includes(busqueda))
    );

    // Alta
    const [listaDefault, setListaDefault] = useState<string>("");
    const [comprobanteDefault, setComprobanteDefault] = useState<string>("COMPROBANTE_X");
    const [cuitDniAlta, setCuitDniAlta] = useState("");
    const [condicionIvaAlta, setCondicionIvaAlta] = useState("Consumidor Final");

    const handleCuitChangeAlta = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setCuitDniAlta(val);
        const chars = val.replace(/[^0-9]/g, '').length;
        if (chars >= 10) setCondicionIvaAlta("Responsable Inscripto");
        else setCondicionIvaAlta("Consumidor Final");
    };

    const handleBuscarAFIPAlta = async () => {
        if (cuitDniAlta.length < 10) return toast.error("CUIT muy corto");
        toast.loading("Buscando en AFIP...");
        const res = await buscarCuitEnAfip(cuitDniAlta);
        toast.dismiss();
        if (res.success && res.data) {
            toast.success("Datos encontrados");
            const nombreDocumento = document.getElementById("nombre_razon_social") as HTMLInputElement;
            if (nombreDocumento) {
                nombreDocumento.value = res.data.personReturn?.person?.name || res.data.personReturn?.person?.idPersona?.toString() || "";
            }
            const direccionDocumento = document.getElementById("direccion_alta") as HTMLInputElement;
            if (direccionDocumento) {
                const dom = res.data.personReturn?.person?.domicilio?.[0];
                if (dom) direccionDocumento.value = `${dom.direccion || ""} ${dom.localidad || ""} ${dom.codigoPostal || ""}`.trim();
            }
        } else {
            toast.error(res.error || "No encontrado");
        }
    };

    // Edición
    const [clienteEditando, setClienteEditando] = useState<any | null>(null);
    const [listaDefaultEdit, setListaDefaultEdit] = useState<string>("");
    const [comprobanteDefaultEdit, setComprobanteDefaultEdit] = useState<string>("");
    const [cuitDniEdit, setCuitDniEdit] = useState("");
    const [condicionIvaEdit, setCondicionIvaEdit] = useState("");

    const handleCuitChangeEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setCuitDniEdit(val);
        const chars = val.replace(/[^0-9]/g, '').length;
        if (chars >= 10) setCondicionIvaEdit("Responsable Inscripto");
        else setCondicionIvaEdit("Consumidor Final");
    };

    // Vista Carpeta Cliente (CRM)
    const [clienteAbierto, setClienteAbierto] = useState<any | null>(null);
    const [historial, setHistorial] = useState<any[]>([]);
    const [resumenFinanciero, setResumenFinanciero] = useState<any | null>(null);
    const [loadingCarpeta, setLoadingCarpeta] = useState(false);
    const [activeTab, setActiveTab] = useState("resumen");

    // Cobrar Cta Cte
    const [pagos, setPagos] = useState([{ metodo_pago: "CONTADO", monto: "" }]);
    const [notasPago, setNotasPago] = useState("");
    const [procesandoCobro, setProcesandoCobro] = useState(false);

    const handleAddPago = () => setPagos([...pagos, { metodo_pago: "CONTADO", monto: "" }]);
    const handleRemovePago = (idx: number) => pagos.length > 1 && setPagos(pagos.filter((_, i) => i !== idx));
    const handleUpdatePago = (idx: number, campo: string, valor: string) => {
        const nuevos = [...pagos];
        (nuevos[idx] as any)[campo] = valor;
        setPagos(nuevos);
    };

    const handleCobrarCtaCte = async () => {
        const pagosValidos = pagos.map(p => ({ metodo_pago: p.metodo_pago, monto: Number(p.monto) })).filter(p => p.monto > 0);
        if (pagosValidos.length === 0) return toast.error("Debe ingresar al menos un monto válido");

        setProcesandoCobro(true);
        const res = await cobrarCuentaCorriente(clienteAbierto.id, pagosValidos, notasPago);
        if (res.success) {
            toast.success("Pago registrado correctamente");
            abrirCarpetaCliente(clienteAbierto); // recargar vista
        } else {
            toast.error(res.error || "Ocurrió un error");
        }
        setProcesandoCobro(false);
    };

    const fetchData = async () => {
        const listasData = await getListasPrecio();
        const clientesData = await getClientes();
        setListas(listasData);
        setClientes(clientesData);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmitNuevo = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.append("lista_default_id", listaDefault);
        formData.append("comprobante_default", comprobanteDefault);
        formData.append("condicion_iva", condicionIvaAlta);

        startTransition(async () => {
            const res = await crearCliente(formData);
            if (res.success) {
                toast.success("Cliente registrado con éxito");
                (e.target as HTMLFormElement).reset();
                setListaDefault("");
                setComprobanteDefault("COMPROBANTE_X");
                setCuitDniAlta("");
                setCondicionIvaAlta("Consumidor Final");
                setShowAlta(false);
                fetchData();
            } else {
                toast.error(res.error);
            }
        });
    };

    const handleGuardarEdicion = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.append("lista_default_id", listaDefaultEdit);
        formData.append("comprobante_default", comprobanteDefaultEdit);
        formData.append("condicion_iva", condicionIvaEdit);

        startTransition(async () => {
            const res = await actualizarCliente(clienteEditando.id, formData);
            if (res.success) {
                toast.success("Cliente actualizado");
                setClienteEditando(null);
                fetchData();
            } else {
                toast.error(res.error);
            }
        });
    };

    const handleEliminar = (id: number, nombre: string) => {
        if (!confirm(`¿Estás seguro de eliminar a "${nombre}"?`)) return;
        startTransition(async () => {
            const res = await eliminarCliente(id);
            if (res.success) {
                toast.success("Cliente eliminado");
                fetchData();
            } else {
                toast.error(res.error);
            }
        });
    };

    const abrirCarpetaCliente = async (cliente: any) => {
        setClienteAbierto(cliente);
        setActiveTab("resumen");
        setLoadingCarpeta(true);
        setPagos([{ metodo_pago: "CONTADO", monto: "" }]);
        setNotasPago("");
        
        const [resHistorial, resFinanzas] = await Promise.all([
            getHistorialCliente(cliente.id),
            getResumenFinancieroCliente(cliente.id)
        ]);
        
        if (resHistorial.success && resHistorial.data) setHistorial(resHistorial.data);
        else setHistorial([]);

        if (resFinanzas.success) setResumenFinanciero(resFinanzas);
        else setResumenFinanciero(null);

        setLoadingCarpeta(false);
    };

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto min-h-[calc(100vh-6rem)]">

            {/* HEADER */}
            <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl shrink-0">
                    <Users className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Directorio de Clientes</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Administrá la información, asigná tarifas y consultá el historial de actividad.</p>
                </div>
            </div>

            {!clienteAbierto ? (
                <div className="flex flex-col gap-6">

                    {/* TOP BAR: Buscador y Botón Crear */}
                    <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm gap-4">
                        <div className="relative w-full md:w-1/2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <Input placeholder="Buscar cliente por nombre o CUIT..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-10 h-12 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 text-base" />
                        </div>
                        <Button onClick={() => setShowAlta(true)} className="w-full md:w-auto h-12 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm"><UserPlus className="h-5 w-5 mr-2" /> Agregar Cliente</Button>
                    </div>

                    {/* MODAL DE ALTA */}
                {showAlta && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                    <Card className="w-full max-w-lg shadow-xl relative max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                        <Button size="icon" variant="ghost" className="absolute top-3 right-3 text-slate-400" onClick={() => setShowAlta(false)}><X className="h-5 w-5" /></Button>
                        <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-5 pt-6">
                            <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <UserPlus className="h-4 w-4 text-indigo-500" /> Nuevo Cliente
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5">
                            <form onSubmit={handleSubmitNuevo} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Razón Social / Nombre <span className="text-red-500">*</span></Label>
                                    <Input id="nombre_razon_social" name="nombre_razon_social" required className="h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">DNI o CUIT</Label>
                                        <div className="flex gap-2">
                                            <Input name="dni_cuit" value={cuitDniAlta} onChange={handleCuitChangeAlta} className="h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 flex-1" />
                                            <Button type="button" onClick={handleBuscarAFIPAlta} variant="outline" className="h-10 px-3 bg-white border-slate-200"><Search className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Teléfono</Label>
                                        <Input name="telefono" className="h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Dirección</Label>
                                    <Input id="direccion_alta" name="direccion" className="h-10 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Condición IVA</Label>
                                        <Select value={condicionIvaAlta} onValueChange={(val) => setCondicionIvaAlta(val || "")}>
                                            <SelectTrigger className="h-10 bg-slate-50 border-slate-200 text-xs font-medium"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
                                                <SelectItem value="Responsable Inscripto">Responsable Inscripto</SelectItem>
                                                <SelectItem value="Monotributo">Monotributo</SelectItem>
                                                <SelectItem value="Exento">Exento</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5"></div>
                                </div>

                                {/* LIMITE DE CREDITO Y AVISOS */}
                                <div className="p-4 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-xl space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold uppercase text-orange-600 tracking-wider">Límite de Crédito ($)</Label>
                                        <Input type="number" step="0.01" name="limite_credito" placeholder="Ej: 50000 (Vacio = Ilimitado)" className="h-10 bg-white dark:bg-zinc-900 border-orange-200 dark:border-orange-500/30 font-medium" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold uppercase text-orange-600 tracking-wider">Días p/ Vencimiento C.C.</Label>
                                        <Input type="number" name="dias_aviso_deuda" defaultValue={30} className="h-10 bg-white dark:bg-zinc-900 border-orange-200 dark:border-orange-500/30 font-medium" />
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-zinc-800/30 border border-slate-100 dark:border-zinc-800 rounded-xl space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold uppercase text-indigo-600 tracking-wider">Comprobante Automático</Label>
                                        <Select value={comprobanteDefault} onValueChange={(v) => setComprobanteDefault(v || "")}>
                                            <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 font-medium">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="COMPROBANTE_X">COMPROBANTE X</SelectItem>
                                                <SelectItem value="FACTURA_A">FACTURA A</SelectItem>
                                                <SelectItem value="FACTURA_B">FACTURA B</SelectItem>
                                                <SelectItem value="FACTURA_C">FACTURA C</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold uppercase text-emerald-600 tracking-wider">Lista de Precios por Defecto</Label>
                                        <Select value={listaDefault} onValueChange={(v) => setListaDefault(v || "")}>
                                            <SelectTrigger className="h-10 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 font-medium">
                                                <SelectValue placeholder="Seleccione tarifa..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {listas.map(l => (
                                                    <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Notas Internas</Label>
                                    <Textarea name="comentarios" className="resize-none h-16 bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 text-sm" />
                                </div>

                                <Button type="submit" className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm" disabled={isPending}>
                                    {isPending ? <Loader2 className="animate-spin h-5 w-5" /> : "Guardar Cliente"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
                )}

                    {/* LISTADO DE CLIENTES */}
                    <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col overflow-hidden">
                        <div className="p-0 overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                                    <tr>
                                        <th className="px-6 py-4">Cliente / Razón Social</th>
                                        <th className="px-6 py-4">CUIT / DNI</th>
                                        <th className="px-6 py-4 hidden md:table-cell">Condición IVA</th>
                                        <th className="px-6 py-4 hidden lg:table-cell">Comprobante Def.</th>
                                        <th className="px-6 py-4 text-center">Teléfono</th>
                                        <th className="px-6 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                    {clientesFiltrados.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-16 text-slate-400">
                                                <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                                <p className="text-sm font-medium">No se encontraron clientes.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        clientesFiltrados.map(c => (
                                            <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer group" onClick={() => abrirCarpetaCliente(c)}>
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{c.nombre_razon_social}</p>
                                                    <span className="text-indigo-600/80 font-bold text-[10px] tracking-wider uppercase">TARIFA: {c.lista_default ? c.lista_default.nombre : "N/A"}</span>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs">{c.dni_cuit || "---"}</td>
                                                <td className="px-6 py-4 hidden md:table-cell">
                                                    <Badge variant="outline" className="bg-slate-50 dark:bg-zinc-800 text-slate-500">{c.condicion_iva}</Badge>
                                                </td>
                                                <td className="px-6 py-4 hidden lg:table-cell text-xs text-slate-500 font-mono">{c.comprobante_default?.replace('_', ' ')}</td>
                                                <td className="px-6 py-4 text-center text-slate-500 text-xs">{c.telefono || "---"}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                        <Button size="icon" variant="ghost" onClick={() => {
                                                        setClienteEditando(c);
                                                        setListaDefaultEdit(String(c.lista_default_id || ""));
                                                        setComprobanteDefaultEdit(c.comprobante_default);
                                                        setCuitDniEdit(c.dni_cuit || "");
                                                        setCondicionIvaEdit(c.condicion_iva || "Consumidor Final");
                                                    }} className="h-8 w-8 text-slate-400 hover:text-indigo-600"><Pencil className="h-4 w-4" /></Button>
                                                        <Button size="icon" variant="ghost" onClick={() => handleEliminar(c.id, c.nombre_razon_social)} className="h-8 w-8 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
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
                /* =========================================================================
                   CARPETA DEL CLIENTE (CRM)
                   ========================================================================= */
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <Button variant="outline" onClick={() => setClienteAbierto(null)} className="mb-4 text-slate-600 hover:text-slate-900 bg-white">
                        <ArrowRight className="h-4 w-4 mr-2 rotate-180" /> Volver al Directorio
                    </Button>
                    
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col overflow-hidden min-h-[600px]">
                        {/* HEADER DEL CLIENTE */}
                        <div className="px-6 py-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 h-12 w-12 rounded-full flex items-center justify-center font-black text-xl">
                                        {clienteAbierto.nombre_razon_social.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{clienteAbierto.nombre_razon_social}</h3>
                                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 font-medium">
                                            {clienteAbierto.telefono && <span>📞 {clienteAbierto.telefono}</span>}
                                            {clienteAbierto.dni_cuit && <span>📄 {clienteAbierto.dni_cuit}</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <Badge variant="secondary" className="mb-2">{clienteAbierto.lista_default ? clienteAbierto.lista_default.nombre : "Sin tarifa plana"}</Badge>
                                <p className="text-xs text-slate-400">Cliente activo</p>
                            </div>
                        </div>

                        {/* CONTENIDO TABS */}
                        <div className="flex-1 p-6 bg-slate-50/30 dark:bg-zinc-950">
                            {loadingCarpeta ? (
                                <div className="h-full flex items-center justify-center flex-col text-slate-400">
                                    <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
                                    <p className="font-medium animate-pulse">Cargando legajo financiero...</p>
                                </div>
                            ) : (
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <TabsList className="bg-slate-100 dark:bg-zinc-800 p-1 mb-6 rounded-lg font-medium text-slate-600">
                                        <TabsTrigger value="resumen" className="rounded-md data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">📉 Resumen & Deuda</TabsTrigger>
                                        <TabsTrigger value="historial" className="rounded-md data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">📦 Historial Actividad</TabsTrigger>
                                        <TabsTrigger value="notas" className="rounded-md data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">📝 Anotaciones</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="resumen" className="space-y-6 mt-0">
                                        {/* TARJETAS DE SALDO */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <div className="bg-red-50/50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 p-5 rounded-xl text-center">
                                                <p className="text-xs font-bold uppercase text-red-500 tracking-wider mb-2">Deuda Pendiente Vigente</p>
                                                <p className="text-3xl font-black text-red-600 dark:text-red-400">
                                                    ${resumenFinanciero?.deuda?.toFixed(2) || "0.00"}
                                                </p>
                                            </div>
                                            <div className="bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 p-5 rounded-xl text-center">
                                                <p className="text-xs font-bold uppercase text-emerald-500 tracking-wider mb-2">Saldo a Favor</p>
                                                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                                                    ${resumenFinanciero?.saldo_a_favor?.toFixed(2) || "0.00"}
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-5 rounded-xl flex flex-col justify-center items-center">
                                                <p className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Balance Neto</p>
                                                <p className={`text-2xl font-black ${(resumenFinanciero?.balance || 0) > 0 ? 'text-emerald-600' : (resumenFinanciero?.balance || 0) < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                                    ${resumenFinanciero?.balance?.toFixed(2) || "0.00"}
                                                </p>
                                            </div>
                                        </div>

                                        {/* ACA VAMOS A PONER EL COMPONENTE DE COBRO */}
                                        {(resumenFinanciero?.deuda || 0) > 0 && (
                                            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 mt-4">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div>
                                                        <h4 className="text-lg font-bold flex items-center gap-2"><CreditCard className="h-5 w-5 text-indigo-500" /> Ingresar Pago a Cuenta Corriente</h4>
                                                        <p className="text-xs text-slate-500">Monto total adeudado: ${resumenFinanciero.deuda.toFixed(2)}</p>
                                                    </div>
                                                    <Button variant="outline" size="sm" onClick={handleAddPago} className="h-8 text-xs text-indigo-600 hover:text-indigo-700 font-semibold border-indigo-200 hover:bg-indigo-50">
                                                        <Plus className="h-3 w-3 mr-1" /> Otro Método
                                                    </Button>
                                                </div>

                                                <div className="space-y-3">
                                                    {pagos.map((pago, idx) => (
                                                        <div key={idx} className="flex gap-3 items-center">
                                                            <Select value={pago.metodo_pago} onValueChange={(v) => handleUpdatePago(idx, "metodo_pago", v || "")}>
                                                                <SelectTrigger className="w-[180px] bg-slate-50 dark:bg-zinc-800 font-medium">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="CONTADO">Efectivo</SelectItem>
                                                                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                                                                    <SelectItem value="TARJETA">Tarjeta</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <div className="relative flex-1">
                                                                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                                                                <Input type="number" step="0.01" value={pago.monto} onChange={(e) => handleUpdatePago(idx, "monto", e.target.value)} placeholder="0.00" className="pl-7 font-mono font-bold" />
                                                            </div>
                                                            {pagos.length > 1 && (
                                                                <Button variant="ghost" size="icon" onClick={() => handleRemovePago(idx)} className="text-red-400 hover:text-red-600 shrink-0">
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="mt-4 space-y-2">
                                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notas del Pago (Opcional)</Label>
                                                    <Input value={notasPago} onChange={(e) => setNotasPago(e.target.value)} placeholder="Ej: Pago parcial, transferencia banco Galicia..." className="h-9 text-sm" />
                                                </div>

                                                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                                                    <p className="text-sm font-bold text-slate-500">
                                                        Total a Ingresar: <span className="text-lg font-black text-slate-900 dark:text-white">${pagos.reduce((acc, p) => acc + Number(p.monto) || 0, 0).toFixed(2)}</span>
                                                    </p>
                                                    <Button onClick={handleCobrarCtaCte} disabled={procesandoCobro || pagos.reduce((acc, p) => acc + Number(p.monto) || 0, 0) <= 0} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-8">
                                                        {procesandoCobro ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                                        Registrar Pago
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="historial" className="mt-0">
                                        <div className="space-y-4">
                                            {historial.length === 0 ? (
                                                <div className="text-center py-16 text-slate-400 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl">
                                                    <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                                    <p className="text-sm font-medium">Este cliente no tiene compras ni pagos registrados.</p>
                                                </div>
                                            ) : (
                                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl max-h-[500px] overflow-y-auto">
                                                    {/* Usaremos el mismo mapeo que el modal viejo, simplificado */}
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="text-[10px] uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 sticky top-0 text-slate-500 border-b border-slate-200 dark:border-zinc-800 z-10">
                                                            <tr>
                                                                <th className="px-5 py-3 font-semibold">Fecha</th>
                                                                <th className="px-5 py-3 font-semibold">Movimiento</th>
                                                                <th className="px-5 py-3 font-semibold text-center">Cajero</th>
                                                                <th className="px-5 py-3 font-semibold text-right">Monto</th>
                                                                <th className="px-5 py-3 text-center">Acción</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                                            {historial.map((item) => (
                                                                <tr key={item.id_unico} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                                                                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">{formatFechaHoraLocal(item.fecha)}</td>
                                                                    <td className="px-5 py-3 flex items-center gap-3">
                                                                        <div className={`h-8 w-8 rounded-full flex justify-center items-center text-white shrink-0 ${item.tipo === 'VENTA' ? 'bg-indigo-500' : item.tipo === 'DEVOLUCION' ? 'bg-amber-500' : item.tipo === 'CARGO_CC' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                                                                            {item.tipo === 'VENTA' ? <Receipt className="h-3 w-3" /> : <DollarSign className="h-3 w-3" />}
                                                                        </div>
                                                                        <div>
                                                                            <p className="font-bold text-slate-900 dark:text-slate-100 leading-none">{item.titulo}</p>
                                                                            <Badge variant="outline" className={`mt-1 text-[9px] px-1 py-0 ${item.estado === 'PENDIENTE' ? 'border-red-200 text-red-600 bg-red-50' : item.estado === 'PARCIAL' ? 'border-orange-200 text-orange-600 bg-orange-50' : 'border-emerald-200 text-emerald-600 bg-emerald-50'}`}>{item.estado}</Badge>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-5 py-3 text-center font-mono text-[9px] text-slate-500 uppercase">
                                                                        {item.cajero}
                                                                    </td>
                                                                    <td className={`px-5 py-3 text-right font-bold ${item.tipo === 'PAGO' || item.tipo === 'DEVOLUCION' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                                                                        {item.tipo === 'PAGO' || item.tipo === 'DEVOLUCION' ? '+' : ''}${item.monto.toFixed(2)}
                                                                    </td>
                                                                    <td className="px-5 py-3 text-center">
                                                                        {item.tipo === 'VENTA' ? (
                                                                            <Link href={`/historial?buscar=${item.numero_comprobante}&abrir=true`}>
                                                                                <Button size="sm" variant="outline" className="h-7 text-xs px-2"><ExternalLink className="h-3 w-3 mr-1"/> Ver</Button>
                                                                            </Link>
                                                                        ) : "-"}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="notas" className="mt-0">
                                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6">
                                            <Label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Anotaciones del Cliente</Label>
                                            <Textarea className="min-h-[200px] text-sm leading-relaxed" readOnly value={clienteAbierto.comentarios || "No hay notas internas registradas para este cliente."} />
                                            <p className="text-xs text-slate-400 mt-2 italic">* Para editar las notas, regresá al directorio y usá el botón del lápiz de edición general.</p>
                                        </div>
                                    </TabsContent>
                                    
                                </Tabs>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
          MODAL DE EDICIÓN DE CLIENTE
          ========================================================================= */}
            {clienteEditando && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                    <Card className="w-full max-w-md shadow-xl border border-slate-200 dark:border-zinc-800">
                        <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-4 flex flex-row justify-between items-center">
                            <CardTitle className="text-base flex items-center gap-2"><Pencil className="h-4 w-4 text-indigo-500" /> Editar Cliente</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setClienteEditando(null)} className="h-6 w-6 rounded-full text-slate-400 hover:bg-slate-200">
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-5">
                            <form onSubmit={handleGuardarEdicion} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Razón Social</Label>
                                    <Input name="nombre_razon_social" defaultValue={clienteEditando.nombre_razon_social} required className="h-10" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">DNI/CUIT</Label>
                                        <Input name="dni_cuit" value={cuitDniEdit} onChange={handleCuitChangeEdit} className="h-10" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Teléfono</Label>
                                        <Input name="telefono" defaultValue={clienteEditando.telefono} className="h-10" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Dirección</Label>
                                    <Input name="direccion" defaultValue={clienteEditando.direccion} className="h-10" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-orange-600">Límite Crédito ($)</Label>
                                        <Input type="number" step="0.01" name="limite_credito" defaultValue={clienteEditando.limite_credito || ""} placeholder="Ilimitado" className="h-10 border-orange-200" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-orange-600">Días Aviso</Label>
                                        <Input type="number" name="dias_aviso_deuda" defaultValue={clienteEditando.dias_aviso_deuda} className="h-10 border-orange-200" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Comprobante</Label>
                                        <Select value={comprobanteDefaultEdit} onValueChange={(v) => setComprobanteDefaultEdit(v || "")}>
                                            <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="COMPROBANTE_X">X</SelectItem>
                                                <SelectItem value="FACTURA_A">A</SelectItem>
                                                <SelectItem value="FACTURA_B">B</SelectItem>
                                                <SelectItem value="FACTURA_C">C</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Tarifa</Label>
                                        <Select value={listaDefaultEdit} onValueChange={(v) => setListaDefaultEdit(v || "")}>
                                            <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Ninguna" /></SelectTrigger>
                                            <SelectContent>
                                                {listas.map(l => (
                                                    <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5 col-span-2">
                                        <Label className="text-xs font-semibold">Condición frente al IVA</Label>
                                        <Select value={condicionIvaEdit} onValueChange={(val) => setCondicionIvaEdit(val || "")}>
                                            <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
                                                <SelectItem value="Responsable Inscripto">Responsable Inscripto</SelectItem>
                                                <SelectItem value="Monotributo">Monotributo</SelectItem>
                                                <SelectItem value="Exento">Exento</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Notas</Label>
                                    <Textarea name="comentarios" defaultValue={clienteEditando.comentarios} className="resize-none h-12 text-xs" />
                                </div>

                                <div className="flex gap-2 pt-2 border-t border-slate-100">
                                    <Button type="button" variant="ghost" onClick={() => setClienteEditando(null)} className="w-1/3">Cancelar</Button>
                                    <Button type="submit" disabled={isPending} className="w-2/3 bg-slate-900 hover:bg-slate-800 text-white">
                                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}



        </div>
    );
}