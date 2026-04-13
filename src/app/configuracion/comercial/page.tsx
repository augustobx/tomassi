"use client";

import { useState, useEffect, useTransition } from "react";
import { obtenerConfiguracionComercial, actualizarReglasGlobales, actualizarReglaUsuario } from "@/app/actions/configuracion-comercial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, Percent, AlertOctagon, TrendingDown, Users } from "lucide-react";

export default function ConfiguracionComercialPage() {
    const [isPending, startTransition] = useTransition();
    const [data, setData] = useState<any>(null);

    const [globales, setGlobales] = useState({ comision: 5, penalizacion: 2, limite: 10 });

    const cargarDatos = () => {
        obtenerConfiguracionComercial().then(res => {
            if (res.success) {
                setData(res);
                if (res.config) {
                    setGlobales({
                        comision: res.config.comision_base_global,
                        penalizacion: res.config.penalizacion_global,
                        limite: res.config.limite_desc_global
                    });
                }
            }
        });
    };

    useEffect(() => { cargarDatos(); }, []);

    const guardarGlobales = () => {
        startTransition(async () => {
            const res = await actualizarReglasGlobales(globales);
            if (res.success) toast.success("Reglas globales actualizadas.");
            else toast.error(res.error);
        });
    };

    const guardarUsuario = async (u: any) => {
        const res = await actualizarReglaUsuario(u.id, u.comision_personalizada, u.limite_desc_vendedor);
        if (res.success) toast.success(`Reglas guardadas para ${u.nombre}`);
        else toast.error("Error al guardar");
    };

    if (!data) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Cargando panel comercial...</div>;

    return (
        <div className="max-w-[1000px] mx-auto p-6 space-y-6">
            <h2 className="text-2xl font-black text-slate-900">Configuración Comercial y Comisiones</h2>

            <Card className="border-indigo-100 shadow-sm">
                <CardHeader className="bg-indigo-50/50 border-b border-indigo-100 pb-4">
                    <CardTitle className="text-lg flex items-center gap-2 text-indigo-900"><Percent className="h-5 w-5" /> Reglas Globales por Defecto</CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comisión Base (%)</label>
                        <Input type="number" value={globales.comision} onChange={e => setGlobales({ ...globales, comision: Number(e.target.value) })} className="mt-2 font-black text-lg bg-slate-50" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-1"><AlertOctagon className="h-3 w-3" /> Límite Dto Permitido (%)</label>
                        <Input type="number" value={globales.limite} onChange={e => setGlobales({ ...globales, limite: Number(e.target.value) })} className="mt-2 font-black text-lg bg-slate-50" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-orange-500 uppercase tracking-wider flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Penalización a Restar (%)</label>
                        <Input type="number" value={globales.penalizacion} onChange={e => setGlobales({ ...globales, penalizacion: Number(e.target.value) })} className="mt-2 font-black text-lg bg-slate-50" />
                    </div>
                    <div className="md:col-span-3 flex justify-end">
                        <Button onClick={guardarGlobales} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 font-bold"><Save className="mr-2 h-4 w-4" /> Guardar Globales</Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-800"><Users className="h-5 w-5" /> Excepciones por Vendedor</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                            <tr><th className="p-4">Vendedor</th><th className="p-4">Comisión Específica (%)</th><th className="p-4">Límite Dto Específico (%)</th><th className="p-4 text-center">Acción</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.vendedores.map((u: any, i: number) => (
                                <tr key={u.id} className="hover:bg-slate-50">
                                    <td className="p-4 font-bold text-slate-800">{u.nombre}</td>
                                    <td className="p-4"><Input type="number" placeholder="Usa la global..." className="h-9 w-32" value={u.comision_personalizada || ""} onChange={(e) => { const n = [...data.vendedores]; n[i].comision_personalizada = e.target.value ? Number(e.target.value) : null; setData({ ...data, vendedores: n }); }} /></td>
                                    <td className="p-4"><Input type="number" placeholder="Usa la global..." className="h-9 w-32 border-red-200" value={u.limite_desc_vendedor || ""} onChange={(e) => { const n = [...data.vendedores]; n[i].limite_desc_vendedor = e.target.value ? Number(e.target.value) : null; setData({ ...data, vendedores: n }); }} /></td>
                                    <td className="p-4 text-center"><Button variant="outline" size="sm" onClick={() => guardarUsuario(u)} className="font-bold">Guardar</Button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}