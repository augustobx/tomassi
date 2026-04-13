"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function obtenerConfiguracionComercial() {
    const config = await prisma.empresaConfig.findFirst();
    const vendedores = await prisma.usuario.findMany({ where: { activo: true }, select: { id: true, nombre: true, rol: true, comision_personalizada: true, limite_desc_vendedor: true } });
    const clientes = await prisma.cliente.findMany({ select: { id: true, nombre_razon_social: true, limite_desc_cliente: true } });
    const categorias = await prisma.categoria.findMany({ select: { id: true, nombre: true, limite_desc_categoria: true } });

    return { success: true, config, vendedores, clientes, categorias };
}

export async function actualizarReglasGlobales(data: { comision: number, penalizacion: number, limite: number }) {
    try {
        await prisma.empresaConfig.update({
            where: { id: 1 },
            data: {
                comision_base_global: data.comision,
                penalizacion_global: data.penalizacion,
                limite_desc_global: data.limite
            }
        });
        revalidatePath('/configuracion/comercial');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Error al guardar reglas globales" };
    }
}

export async function actualizarReglaUsuario(id: number, comision: number | null, limite: number | null) {
    try {
        await prisma.usuario.update({ where: { id }, data: { comision_personalizada: comision, limite_desc_vendedor: limite } });
        return { success: true };
    } catch (e) { return { success: false, error: "Error al actualizar vendedor" }; }
}