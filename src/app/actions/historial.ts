"use server";

import prisma from "@/lib/prisma";

export async function getHistorialVentas(filtros?: {
    termino?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    tipo_comprobante?: string;
}) {
    try {
        let whereClause: any = {};

        if (filtros?.fecha_desde || filtros?.fecha_hasta) {
            whereClause.fecha_emision = {};
            if (filtros?.fecha_desde) whereClause.fecha_emision.gte = new Date(`${filtros?.fecha_desde}T00:00:00.000Z`);
            if (filtros?.fecha_hasta) whereClause.fecha_emision.lte = new Date(`${filtros?.fecha_hasta}T23:59:59.999Z`);
        }

        if (filtros?.tipo_comprobante && filtros.tipo_comprobante !== "TODOS") {
            whereClause.tipo_comprobante = filtros.tipo_comprobante;
        }

        if (filtros?.termino && filtros.termino.length > 0) {
            const terminoNum = Number(filtros.termino);

            whereClause.OR = [
                { cliente: { nombre_razon_social: { contains: filtros.termino } } },
                { cliente: { dni_cuit: { contains: filtros.termino } } },
            ];

            if (!isNaN(terminoNum)) {
                whereClause.OR.push({ numero_comprobante: terminoNum });
            }
        }

        const ventas = await prisma.venta.findMany({
            where: whereClause,
            include: {
                cliente: true,
                listaPrecio: true,
                pagos: true,
                detalles: {
                    include: {
                        producto: true
                    }
                },
                usuario: { select: { nombre: true, rol: true } }
            },
            orderBy: { fecha_emision: 'desc' },
            take: 100
        });

        return { success: true, data: ventas };
    } catch (error) {
        console.error("Error al cargar historial:", error);
        return { success: false, error: "Error al cargar el historial de ventas." };
    }
}