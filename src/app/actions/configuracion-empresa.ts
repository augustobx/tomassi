"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

// Obtiene los datos de tu local para el encabezado
export async function getDatosEmpresa() {
    let config = await prisma.empresaConfig.findUnique({ where: { id: 1 } });
    if (!config) {
        config = await prisma.empresaConfig.create({ data: {} });
    }
    return config;
}

// Busca la venta exacta para imprimirla
export async function getVentaParaTicket(ventaId: number) {
    return await prisma.venta.findUnique({
        where: { id: ventaId },
        include: {
            cliente: true,
            detalles: { include: { producto: true } },
            pagos: true,
            usuario: true
        }
    });
}

// Guarda los datos de tu empresa desde la pantalla de configuración
export async function actualizarDatosEmpresa(formData: FormData) {
    try {
        const data = {
            razon_social: formData.get("razon_social") as string,
            nombre_fantasia: formData.get("nombre_fantasia") as string,
            cuit: formData.get("cuit") as string,
            inicio_actividad: formData.get("inicio_actividad") as string,
            condicion_iva: formData.get("condicion_iva") as string,
            direccion: formData.get("direccion") as string,
            telefono: formData.get("telefono") as string,
            redes_sociales: formData.get("redes_sociales") as string,
            logo_url: formData.get("logo_url") as string,
            punto_venta: parseInt(formData.get("punto_venta") as string) || 1,
            cuit_facturacion: formData.get("cuit_facturacion") as string,
            certificado_crt: formData.get("certificado_crt") as string,
            clave_privada: formData.get("clave_privada") as string,
            modo_produccion_afip: formData.get("modo_produccion_afip") === "true",
        };

        await prisma.empresaConfig.update({
            where: { id: 1 },
            data
        });

        revalidatePath("/configuracion");
        return { success: true };
    } catch (error) {
        return { success: false, error: "No se pudieron actualizar los datos de la empresa." };
    }
}