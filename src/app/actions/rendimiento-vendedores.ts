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

        if (filtros.fechaDesde && filtros.fechaHasta) {
            whereVentas.fecha_emision = { gte: new Date(filtros.fechaDesde + "T00:00:00.000Z"), lte: new Date(filtros.fechaHasta + "T23:59:59.999Z") };
        }
        if (filtros.vendedorId !== "TODOS") whereVentas.usuarioId = Number(filtros.vendedorId);
        else whereVentas.usuarioId = { not: null };
        if (filtros.clienteId !== "TODOS") whereVentas.clienteId = Number(filtros.clienteId);

        // 1. Obtener Ventas, Configuración Global y Recibos
        const [ventas, config, recibos, vendedores, clientes] = await Promise.all([
            prisma.venta.findMany({
                where: whereVentas,
                include: {
                    cliente: { select: { id: true, nombre_razon_social: true, limite_desc_cliente: true } },
                    usuario: { select: { id: true, nombre: true, rol: true, comision_personalizada: true, limite_desc_vendedor: true } },
                    detalles: { include: { producto: { include: { categoria: { select: { limite_desc_categoria: true } } } } } }
                },
                orderBy: { fecha_emision: 'desc' }
            }),
            prisma.empresaConfig.findFirst(),
            prisma.movimientoCuentaCorriente.findMany({
                where: { tipo: "ABONO", ...(filtros.vendedorId !== "TODOS" ? { usuarioId: Number(filtros.vendedorId) } : {}) },
                include: { cliente: { select: { id: true, nombre_razon_social: true } }, usuario: { select: { id: true, nombre: true } } }
            }),
            prisma.usuario.findMany({ where: { activo: true }, select: { id: true, nombre: true, rol: true }, orderBy: { nombre: 'asc' } }),
            prisma.cliente.findMany({ select: { id: true, nombre_razon_social: true }, orderBy: { nombre_razon_social: 'asc' } })
        ]);

        // Variables maestras
        const comisionGlobal = (config?.comision_base_global || 5) / 100;
        const penalizacionGlobal = (config?.penalizacion_global || 2) / 100;
        const limiteGlobal = config?.limite_desc_global || 10;

        // 2. Procesamiento Al Vuelo
        const ventasProcesadas = ventas.map(v => {
            const dtoGlobalPorcentaje = v.subtotal > 0 ? (v.descuento_global / v.subtotal) * 100 : 0;

            const comisionVendedor = v.usuario?.comision_personalizada !== null && v.usuario?.comision_personalizada !== undefined
                ? (v.usuario.comision_personalizada / 100)
                : comisionGlobal;

            let limiteAplicable = limiteGlobal;
            if (v.cliente?.limite_desc_cliente !== null && v.cliente?.limite_desc_cliente !== undefined) {
                limiteAplicable = v.cliente.limite_desc_cliente;
            } else if (v.usuario?.limite_desc_vendedor !== null && v.usuario?.limite_desc_vendedor !== undefined) {
                limiteAplicable = v.usuario.limite_desc_vendedor;
            }

            let esPenalizado = false;
            let excedenteGlobal = 0;

            // Verificación 1: Descuento Global
            if (dtoGlobalPorcentaje > limiteAplicable) {
                esPenalizado = true;
                excedenteGlobal = dtoGlobalPorcentaje - limiteAplicable;
            }

            // Verificación 2: Descuentos Individuales
            const detallesProcesados = v.detalles.map(det => {
                const limiteCat = det.producto?.categoria?.limite_desc_categoria;
                const limiteItem = (limiteCat !== null && limiteCat !== undefined) ? limiteCat : limiteAplicable;
                const excedeItem = det.descuento_individual > limiteItem;
                const excedenteItem = excedeItem ? det.descuento_individual - limiteItem : 0;

                if (excedeItem) esPenalizado = true;

                return {
                    ...det,
                    limiteAplicado: limiteItem,
                    excedente: excedenteItem
                };
            });

            const comisionFinal = esPenalizado ? Math.max(0, comisionVendedor - penalizacionGlobal) : comisionVendedor;
            const comisionMonto = v.total * comisionFinal;

            return {
                ...v,
                detalles: detallesProcesados,
                dtoPorcentaje: dtoGlobalPorcentaje,
                limiteAplicado: limiteAplicable,
                excedenteGlobal: excedenteGlobal,
                porcentajeComisionAplicado: (comisionFinal * 100),
                esPenalizado,
                comisionGenerada: comisionMonto,
                penalizacionMonto: esPenalizado ? (v.total * penalizacionGlobal) : 0
            };
        });

        return { success: true, ventas: ventasProcesadas, recibos, vendedores, clientes, globalVars: { comisionGlobal, penalizacionGlobal, limiteGlobal } };

    } catch (error) {
        return { success: false, error: "Fallo al procesar el rendimiento." };
    }
}