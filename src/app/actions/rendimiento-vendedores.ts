"use server";

import prisma from "@/lib/prisma";

export async function obtenerRendimiento(filtros: {
    fechaDesde: string;
    fechaHasta: string;
    vendedorId: number | "TODOS";
    clienteId: number | "TODOS";
}) {
    try {
        const whereVentas: any = {};

        // Filtro de Fechas
        if (filtros.fechaDesde && filtros.fechaHasta) {
            whereVentas.fecha_emision = {
                gte: new Date(filtros.fechaDesde + "T00:00:00.000Z"),
                lte: new Date(filtros.fechaHasta + "T23:59:59.999Z")
            };
        }

        // Filtro de Vendedor
        if (filtros.vendedorId !== "TODOS") {
            whereVentas.usuarioId = Number(filtros.vendedorId);
        } else {
            whereVentas.usuarioId = { not: null }; // Solo ventas con un responsable asignado
        }

        // Filtro de Cliente
        if (filtros.clienteId !== "TODOS") {
            whereVentas.clienteId = Number(filtros.clienteId);
        }

        // 1. Obtener todas las operaciones de venta
        const ventas = await prisma.venta.findMany({
            where: whereVentas,
            include: {
                cliente: { select: { id: true, nombre_razon_social: true } },
                usuario: { select: { id: true, nombre: true, rol: true } },
            },
            orderBy: { fecha_emision: 'desc' }
        });

        // 2. Obtener cobros en cuenta corriente (Recibos) del mismo vendedor
        const whereCobros: any = { tipo: "ABONO" };
        if (filtros.fechaDesde && filtros.fechaHasta) {
            whereCobros.fecha = {
                gte: new Date(filtros.fechaDesde + "T00:00:00.000Z"),
                lte: new Date(filtros.fechaHasta + "T23:59:59.999Z")
            };
        }
        if (filtros.vendedorId !== "TODOS") {
            whereCobros.usuarioId = Number(filtros.vendedorId);
        }
        if (filtros.clienteId !== "TODOS") {
            whereCobros.clienteId = Number(filtros.clienteId);
        }

        const recibos = await prisma.movimientoCuentaCorriente.findMany({
            where: whereCobros,
            include: {
                cliente: { select: { id: true, nombre_razon_social: true } },
                usuario: { select: { id: true, nombre: true } }
            },
            orderBy: { fecha: 'desc' }
        });

        // 3. Obtener listas para los selects
        const vendedores = await prisma.usuario.findMany({
            where: { activo: true },
            select: { id: true, nombre: true, rol: true },
            orderBy: { nombre: 'asc' }
        });

        const clientes = await prisma.cliente.findMany({
            select: { id: true, nombre_razon_social: true },
            orderBy: { nombre_razon_social: 'asc' }
        });

        return { success: true, ventas, recibos, vendedores, clientes };

    } catch (error) {
        console.error("Error al obtener rendimiento:", error);
        return { success: false, error: "Fallo al procesar el rendimiento desde la base de datos." };
    }
}