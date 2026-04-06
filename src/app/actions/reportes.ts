"use server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getReporteMaestro(filtros: { fecha_desde?: string; fecha_hasta?: string }) {
    try {
        // 1. FILTRO DE FECHAS PARA VENTAS
        let dateFilter: any = {};
        if (filtros.fecha_desde || filtros.fecha_hasta) {
            dateFilter.fecha_emision = {};
            if (filtros.fecha_desde) dateFilter.fecha_emision.gte = new Date(`${filtros.fecha_desde}T00:00:00.000Z`);
            if (filtros.fecha_hasta) dateFilter.fecha_emision.lte = new Date(`${filtros.fecha_hasta}T23:59:59.999Z`);
        }

        // TRAER TODAS LAS VENTAS DEL PERÍODO
        const ventas = await prisma.venta.findMany({
            where: dateFilter,
            include: {
                cliente: true,
                detalles: { include: { producto: true } }
            }
        });

        // 2. FILTRO DE FECHAS PARA CAJAS
        let cajaFilter: any = {};
        if (filtros.fecha_desde || filtros.fecha_hasta) {
            cajaFilter.fecha_apertura = {};
            if (filtros.fecha_desde) cajaFilter.fecha_apertura.gte = new Date(`${filtros.fecha_desde}T00:00:00.000Z`);
            if (filtros.fecha_hasta) cajaFilter.fecha_apertura.lte = new Date(`${filtros.fecha_hasta}T23:59:59.999Z`);
        }

        // TRAER CAJAS DEL PERÍODO
        const cajas = await prisma.cajaDiaria.findMany({
            where: cajaFilter,
            include: { movimientos: true }
        });

        // 3. FILTRO DE FECHAS PARA INFLACIÓN (HISTORIAL DE PRECIOS)
        let historialFilter: any = {};
        if (filtros.fecha_desde || filtros.fecha_hasta) {
            historialFilter.fecha = {};
            if (filtros.fecha_desde) historialFilter.fecha.gte = new Date(`${filtros.fecha_desde}T00:00:00.000Z`);
            if (filtros.fecha_hasta) historialFilter.fecha.lte = new Date(`${filtros.fecha_hasta}T23:59:59.999Z`);
        }

        // TRAER EL HISTORIAL DE INFLACIÓN
        const cambiosPrecio = await prisma.historialPrecio.findMany({
            where: historialFilter,
            include: { producto: { select: { nombre_producto: true, codigo_articulo: true } } },
            orderBy: { fecha: 'desc' }
        });

        // Calcular inflación promedio del período
        const aumentos = cambiosPrecio.filter(c => c.porcentaje_cambio > 0);
        const inflacionPromedio = aumentos.length > 0
            ? aumentos.reduce((acc, curr) => acc + curr.porcentaje_cambio, 0) / aumentos.length
            : 0;


        // --- PROCESAMIENTO MATEMÁTICO ---

        let totalIngresos = 0;
        let costoTotalMercaderia = 0;
        let totalDescuentos = 0;
        const ingresosPorMedio: Record<string, number> = {};

        const rankingProductos: Record<number, { nombre: string, cantidad: number, recaudado: number, rentabilidad: number }> = {};
        const rankingClientes: Record<number, { nombre: string, comprado: number, adeudado: number }> = {};

        ventas.forEach(v => {
            // Financiero General
            totalIngresos += v.total;
            totalDescuentos += v.descuento_global;
            ingresosPorMedio[v.metodo_pago] = (ingresosPorMedio[v.metodo_pago] || 0) + v.total;

            // Clientes
            if (!rankingClientes[v.clienteId]) {
                rankingClientes[v.clienteId] = { nombre: v.cliente.nombre_razon_social, comprado: 0, adeudado: 0 };
            }
            rankingClientes[v.clienteId].comprado += v.total;
            rankingClientes[v.clienteId].adeudado += v.saldo_pendiente;

            // Productos
            v.detalles.forEach(det => {
                const prodId = det.producto.id;
                const costoLinea = det.producto.precio_costo * det.cantidad;
                costoTotalMercaderia += costoLinea;

                const rentabilidadLinea = det.subtotal - costoLinea;

                if (!rankingProductos[prodId]) {
                    rankingProductos[prodId] = { nombre: det.producto.nombre_producto, cantidad: 0, recaudado: 0, rentabilidad: 0 };
                }
                rankingProductos[prodId].cantidad += det.cantidad;
                rankingProductos[prodId].recaudado += det.subtotal;
                rankingProductos[prodId].rentabilidad += rentabilidadLinea;
            });
        });

        // Egresos de Caja
        let totalGastosCaja = 0;
        cajas.forEach(c => {
            c.movimientos.forEach(m => {
                if (m.tipo === 'EGRESO_MANUAL') totalGastosCaja += m.monto;
            });
        });

        // Ordenar Rankings
        const topProductosVendidos = Object.values(rankingProductos).sort((a, b) => b.cantidad - a.cantidad).slice(0, 15);
        const topProductosRentables = Object.values(rankingProductos).sort((a, b) => b.rentabilidad - a.rentabilidad).slice(0, 15);

        // Para los "Menos Vendidos", buscamos en todo el inventario
        const todosLosProductos = await prisma.producto.findMany({ 
            select: { id: true, nombre_producto: true, stocks: { select: { cantidad: true } } } 
        });
        const productosMenosVendidos = todosLosProductos.map(p => {
            const stats = rankingProductos[p.id];
            return {
                nombre: p.nombre_producto,
                cantidad: stats ? stats.cantidad : 0,
                stock_clavado: p.stocks.reduce((acc, current) => acc + current.cantidad, 0)
            };
        }).sort((a, b) => a.cantidad - b.cantidad).slice(0, 15);

        const topClientes = Object.values(rankingClientes).sort((a, b) => b.comprado - a.comprado).slice(0, 15);
        const topDeudores = Object.values(rankingClientes).sort((a, b) => b.adeudado - a.adeudado).filter(c => c.adeudado > 0).slice(0, 15);

        return {
            success: true,
            data: {
                kpis: {
                    ventasTotales: ventas.length,
                    ingresosTotales: totalIngresos,
                    costoMercaderia: costoTotalMercaderia,
                    gananciaBruta: totalIngresos - costoTotalMercaderia,
                    margenPromedio: totalIngresos > 0 ? ((totalIngresos - costoTotalMercaderia) / totalIngresos) * 100 : 0,
                    ticketPromedio: ventas.length > 0 ? totalIngresos / ventas.length : 0,
                    totalDescuentosOtorgados: totalDescuentos,
                    totalGastosCaja,
                    inflacionPromedio
                },
                mediosDePago: ingresosPorMedio,
                historialPrecios: cambiosPrecio,
                rankings: {
                    topProductosVendidos,
                    topProductosRentables,
                    productosMenosVendidos,
                    topClientes,
                    topDeudores
                }
            }
        };

    } catch (error) {
        console.error("Error al procesar reportes:", error);
        return { success: false, error: "Error al procesar los datos analíticos." };
    }
}