"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Settings, Save, Loader2, Store, Image as ImageIcon } from "lucide-react";

import { getDatosEmpresa, actualizarDatosEmpresa } from "@/app/actions/configuracion-empresa";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ConfiguracionPage() {
    const [isPending, startTransition] = useTransition();
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState({
        razon_social: "",
        nombre_fantasia: "",
        cuit: "",
        inicio_actividad: "",
        condicion_iva: "",
        direccion: "",
        telefono: "",
        redes_sociales: "",
        punto_venta: 1,
        cuit_facturacion: "",
        certificado_crt: "",
        clave_privada: "",
        modo_produccion_afip: false,
        logo_url: "",
    });

    useEffect(() => {
        startTransition(async () => {
            const data = await getDatosEmpresa();
            if (data) {
                // Formateamos los datos para evitar que pase 'null' a los inputs de React
                setFormData({
                    razon_social: data.razon_social || "",
                    nombre_fantasia: data.nombre_fantasia || "",
                    cuit: data.cuit || "",
                    inicio_actividad: data.inicio_actividad || "",
                    condicion_iva: data.condicion_iva || "",
                    direccion: data.direccion || "",
                    telefono: data.telefono || "",
                    redes_sociales: data.redes_sociales || "",
                    punto_venta: data.punto_venta || 1,
                    cuit_facturacion: data.cuit_facturacion || "",
                    certificado_crt: data.certificado_crt || "",
                    clave_privada: data.clave_privada || "",
                    modo_produccion_afip: data.modo_produccion_afip || false,
                    logo_url: (data as any).logo_url || "",
                });
            }
            setLoading(false);
        });
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = new FormData();
        Object.entries(formData).forEach(([key, value]) => data.append(key, String(value)));

        startTransition(async () => {
            const res = await actualizarDatosEmpresa(data);
            if (res.success) {
                toast.success("¡Datos actualizados!", { description: "Tus facturas y tickets ahora mostrarán esta información." });
            } else {
                toast.error(res.error);
            }
        });
    };

    if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>;

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto min-h-[calc(100vh-6rem)] pb-12">

            {/* HEADER */}
            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl shrink-0">
                        <Settings className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Configuración de Empresa</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Datos legales y comerciales para comprobantes e impresión.</p>
                    </div>
                </div>
                <Button onClick={handleSubmit} disabled={isPending} className="bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm h-10 px-6 hidden sm:flex">
                    {isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Guardar Cambios
                </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* BLOQUE 1: DATOS FISCALES */}
                <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-5">
                        <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <Store className="h-4 w-4 text-indigo-500" /> Datos Principales (Fiscales)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Razón Social <span className="text-red-500">*</span></Label>
                            <Input name="razon_social" value={formData.razon_social} onChange={handleChange} className="h-11 font-medium bg-slate-50" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-slate-500">Nombre de Fantasía (Comercial)</Label>
                            <Input name="nombre_fantasia" value={formData.nombre_fantasia} onChange={handleChange} className="h-11 bg-slate-50" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-slate-500">CUIT</Label>
                            <Input name="cuit" value={formData.cuit} onChange={handleChange} className="h-11 bg-slate-50" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-slate-500">Condición frente al IVA</Label>
                            <Input name="condicion_iva" value={formData.condicion_iva} onChange={handleChange} className="h-11 bg-slate-50" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-slate-500">Inicio de Actividades</Label>
                            <Input name="inicio_actividad" value={formData.inicio_actividad} onChange={handleChange} className="h-11 bg-slate-50" placeholder="Ej: 01/01/2024" />
                        </div>
                    </CardContent>
                </Card>

                {/* BLOQUE 2: CONTACTO Y LOGO */}
                <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-5">
                        <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <ImageIcon className="h-4 w-4 text-indigo-500" /> Identidad y Contacto
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Dirección Comercial</Label>
                            <Input name="direccion" value={formData.direccion} onChange={handleChange} className="h-11 bg-slate-50" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-slate-500">Teléfono (WhatsApp)</Label>
                            <Input name="telefono" value={formData.telefono} onChange={handleChange} className="h-11 bg-slate-50" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-slate-500">Redes Sociales</Label>
                            <Input name="redes_sociales" value={formData.redes_sociales} onChange={handleChange} className="h-11 bg-slate-50" placeholder="Ej: @tendeco.pinturas" />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2 pt-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">URL del Logo (Opcional)</Label>
                            <Input name="logo_url" value={formData.logo_url} onChange={handleChange} className="h-11 bg-slate-50" placeholder="Ej: https://mi-sitio.com/logo.png" />
                            <p className="text-[10px] text-slate-500 mt-1">Pegá aquí un enlace directo a la imagen de tu logo. Si lo dejás vacío, se mostrará el ícono de la tienda.</p>
                        </div>
                    </CardContent>
                </Card>

                {/* BLOQUE 3: AFIP FACTURACIÓN ELECTRÓNICA */}
                <Card className="shadow-sm border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-5">
                        <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <Store className="h-4 w-4 text-emerald-500" /> Facturación Electrónica AFIP
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1.5 flex flex-col justify-end pb-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="modo_produccion_afip" checked={formData.modo_produccion_afip} onChange={(e) => setFormData({...formData, modo_produccion_afip: e.target.checked})} className="h-5 w-5 accent-emerald-600 rounded" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Modo Producción (AFIP Real)</span>
                            </label>
                            <p className="text-[10px] text-slate-500 mt-1 ml-7">Si está desactivado, usará el WSFE de Homologación (Pruebas).</p>
                        </div>
                        <div className="space-y-1.5 flex flex-col justify-end pb-2">
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-slate-500">Punto de Venta</Label>
                            <Input name="punto_venta" type="number" value={formData.punto_venta} onChange={handleChange} className="h-11 bg-slate-50" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-slate-500">CUIT Emisor (Facturación)</Label>
                            <Input name="cuit_facturacion" value={formData.cuit_facturacion} onChange={handleChange} className="h-11 bg-slate-50" placeholder="Ej: 20123456780" />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2 pt-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Certificado CRT (Texto Completo)</Label>
                            <textarea name="certificado_crt" value={formData.certificado_crt} onChange={(e: any) => handleChange(e)} className="w-full h-32 p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"} />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Clave Privada KEY (Texto Completo)</Label>
                            <textarea name="clave_privada" value={formData.clave_privada} onChange={(e: any) => handleChange(e)} className="w-full h-32 p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"} />
                        </div>
                    </CardContent>
                </Card>

                <Button type="submit" disabled={isPending} className="w-full sm:hidden bg-slate-900 text-white h-12">
                    {isPending ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Guardar Cambios"}
                </Button>
            </form>
        </div>
    );
}