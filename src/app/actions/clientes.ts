"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { emitirComprobanteAFIP, getDatosClientePorCUIT } from "./afip";

export async function buscarCuitEnAfip(cuitStr: string) {
    const cuitNum = Number(cuitStr.replace(/[^0-9]/g, ''));
    if (!cuitNum) return { success: false, error: "CUIT inválido" };
    return await getDatosClientePorCUIT(cuitNum);
}

export async function getClientes() {
    return await prisma.cliente.findMany({
        include: { lista_default: true, listas_permitidas: { include: { listaPrecio: true } } },
        orderBy: { nombre_razon_social: 'asc' }
    });
}

export async function crearCliente(formData: FormData) {
    try {
        const nombre_razon_social = formData.get("nombre_razon_social") as string;
        const dni_cuit = formData.get("dni_cuit") as string;
        const direccion = formData.get("direccion") as string;
        const telefono = formData.get("telefono") as string;
        const comentarios = formData.get("comentarios") as string;
        const lista_default_id = formData.get("lista_default_id") as string;
        const comprobante_default = formData.get("comprobante_default") as string;
        const condicion_iva = formData.get("condicion_iva") as string;

        const limite_credito_str = formData.get("limite_credito") as string;
        const dias_aviso_deuda_str = formData.get("dias_aviso_deuda") as string;
        const limite_credito = limite_credito_str && limite_credito_str.trim() !== "" ? parseFloat(limite_credito_str) : null;
        const dias_aviso_deuda = dias_aviso_deuda_str && dias_aviso_deuda_str.trim() !== "" ? parseInt(dias_aviso_deuda_str) : 30;

        const listas_permitidas_str = formData.getAll("listas_permitidas") as string[];
        const listas_permitidas = listas_permitidas_str.map(id => Number(id));

        if (lista_default_id && !listas_permitidas.includes(Number(lista_default_id))) {
            listas_permitidas.push(Number(lista_default_id));
        }

        if (!nombre_razon_social) return { success: false, error: "La Razón Social es obligatoria." };

        if (dni_cuit) {
            const existe = await prisma.cliente.findUnique({ where: { dni_cuit } });
            if (existe) return { success: false, error: "Este DNI o CUIT ya está registrado." };
        }

        const conexionesListas = listas_permitidas.map(id => ({
            listaPrecio: { connect: { id } }
        }));

        await prisma.cliente.create({
            data: {
                nombre_razon_social,
                dni_cuit: dni_cuit || null,
                direccion,
                telefono,
                comentarios,
                condicion_iva: condicion_iva || "Consumidor Final",
                comprobante_default: comprobante_default || "COMPROBANTE_X",
                lista_default_id: lista_default_id ? Number(lista_default_id) : null,
                limite_credito,
                dias_aviso_deuda,
                listas_permitidas: { create: conexionesListas }
            }
        });

        revalidatePath("/clientes");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "Ocurrió un error al guardar el cliente." };
    }
}

export async function getHistorialCliente(clienteId: number) {
    try {
        const ventas = await prisma.venta.findMany({ where: { clienteId }, include: { usuario: { select: { nombre: true } } } });
        const movimientos = await prisma.movimientoCuentaCorriente.findMany({ where: { clienteId }, include: { usuario: { select: { nombre: true } } } });

        const historial = [
            ...ventas.map(v => ({
                id_unico: `v_${v.id}`,
                id_real: v.id,
                numero_comprobante: v.numero_comprobante, // <--- ESTO ES LO NUEVO
                tipo: 'VENTA',
                fecha: v.fecha_emision,
                titulo: `Facturación: ${v.tipo_comprobante.replace('_', ' ')} 000${v.punto_venta}-${v.numero_comprobante}`,
                monto: v.total,
                estado: v.estado_pago,
                notas: v.notas_venta,
                cajero: v.usuario?.nombre || 'SISTEMA'
            })),
            ...movimientos.map(m => {
                const esDevolucion = m.notas?.toLowerCase().includes('nota de cr') || m.notas?.toLowerCase().includes('devoluc');
                const esUsoSaldo = m.metodo_pago === 'SALDO_A_FAVOR' && m.tipo === 'CARGO';

                let titulo = `Recibo de Pago (${m.metodo_pago.replace('_', ' ')})`;
                if (esDevolucion) titulo = "NOTA DE CRÉDITO / DEVOLUCIÓN A FAVOR";
                if (esUsoSaldo) titulo = "USO DE SALDO A FAVOR";

                return {
                    id_unico: `m_${m.id}`,
                    id_real: m.id,
                    tipo: m.tipo === 'CARGO' ? 'CARGO_CC' : (esDevolucion ? 'DEVOLUCION' : 'PAGO'),
                    fecha: m.fecha,
                    titulo: titulo,
                    monto: m.monto,
                    estado: 'COMPLETADO',
                    notas: m.notas,
                    cajero: m.usuario?.nombre || 'SISTEMA'
                };
            })
        ];

        historial.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        return { success: true, data: historial };
    } catch (error) {
        return { success: false, error: "Error al cargar el historial del cliente." };
    }
}

export async function actualizarCliente(id: number, formData: FormData) {
    try {
        const nombre_razon_social = formData.get("nombre_razon_social") as string;
        const dni_cuit = formData.get("dni_cuit") as string;
        const direccion = formData.get("direccion") as string;
        const telefono = formData.get("telefono") as string;
        const comentarios = formData.get("comentarios") as string;
        const lista_default_id = formData.get("lista_default_id") as string;
        const comprobante_default = formData.get("comprobante_default") as string;
        const condicion_iva = formData.get("condicion_iva") as string;

        const limite_credito_str = formData.get("limite_credito") as string;
        const dias_aviso_deuda_str = formData.get("dias_aviso_deuda") as string;
        const limite_credito = limite_credito_str && limite_credito_str.trim() !== "" ? parseFloat(limite_credito_str) : null;
        const dias_aviso_deuda = dias_aviso_deuda_str && dias_aviso_deuda_str.trim() !== "" ? parseInt(dias_aviso_deuda_str) : 30;

        if (!nombre_razon_social) return { success: false, error: "La Razón Social es obligatoria." };

        if (dni_cuit) {
            const existe = await prisma.cliente.findFirst({ where: { dni_cuit, id: { not: id } } });
            if (existe) return { success: false, error: "Este DNI/CUIT ya pertenece a otro cliente." };
        }

        await prisma.cliente.update({
            where: { id },
            data: {
                nombre_razon_social,
                dni_cuit: dni_cuit || null,
                direccion,
                telefono,
                comentarios,
                condicion_iva: condicion_iva || "Consumidor Final",
                comprobante_default: comprobante_default || "COMPROBANTE_X",
                lista_default_id: lista_default_id ? Number(lista_default_id) : null,
                limite_credito,
                dias_aviso_deuda,
            }
        });

        revalidatePath("/clientes");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "Ocurrió un error al actualizar el cliente." };
    }
}

export async function eliminarCliente(id: number) {
    try {
        await prisma.cliente.delete({ where: { id } });
        revalidatePath("/clientes");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "No se puede eliminar. Es probable que este cliente tenga ventas o deudas registradas." };
    }
}

// ==========================================
// RESUMEN Y CUENTA CORRIENTE
// ==========================================

export async function getResumenFinancieroCliente(id: number) {
    try {
        // 1. Deuda Total (Suma de los saldos pendientes de cada Venta no pagada del todo)
        const ventasDeuda = await prisma.venta.findMany({
            where: { clienteId: id, saldo_pendiente: { gt: 0 } },
            orderBy: { fecha_emision: 'asc' }
        });

        const deudaTotal = ventasDeuda.reduce((acc, v) => acc + v.saldo_pendiente, 0);
        const ventaMasAntigua = ventasDeuda.length > 0 ? ventasDeuda[0].fecha_emision : null;

        // 2. Movimientos para calcular el neto real
        const movimientos = await prisma.movimientoCuentaCorriente.findMany({
            where: { clienteId: id }
        });

        const totalCargos = movimientos.filter(m => m.tipo === 'CARGO').reduce((acc, m) => acc + m.monto, 0);
        const totalAbonos = movimientos.filter(m => m.tipo === 'ABONO').reduce((acc, m) => acc + m.monto, 0);

        const balanceNeto = totalAbonos - totalCargos;

        // Si el cliente pagó de más, el balanceNeto será positivo.
        // Si hay una discrepancia entre ventas no saldadas y movimientos (por el pasado sin CARGOS),
        // damos prioridad a ventasDeuda para deuda exigible, y al balance positivo para saldo a favor.
        const saldo_a_favor = balanceNeto > 0 ? balanceNeto : 0;

        return {
            success: true,
            deuda: deudaTotal,
            saldo_a_favor: saldo_a_favor,
            balance: saldo_a_favor > 0 ? saldo_a_favor : -deudaTotal,
            fecha_mas_antigua: ventaMasAntigua
        };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Error al generar resumen financiero" };
    }
}

export async function cobrarCuentaCorriente(clienteId: number, pagos: { metodo_pago: string, monto: number }[], notas: string) {
    try {
        const montoTotalAbonado = pagos.reduce((acc, p) => acc + p.monto, 0);
        if (montoTotalAbonado <= 0) return { success: false, error: "El monto no puede ser cero" };

        let restanteAbono = montoTotalAbonado;

        await prisma.$transaction(async (tx) => {
            const cajaAbierta = await tx.cajaDiaria.findFirst({ where: { estado: 'ABIERTA' } });
            if (!cajaAbierta) throw new Error("No hay caja abierta para recibir el pago");

            // 1. Registrar ABONO en la CC del Cliente por cada método de pago
            for (const pago of pagos) {
                await tx.movimientoCuentaCorriente.create({
                    data: {
                        clienteId,
                        tipo: 'ABONO',
                        metodo_pago: pago.metodo_pago as any,
                        monto: pago.monto,
                        notas: notas ? `Abono (${pago.metodo_pago}) - ${notas}` : `Abono de Deuda (${pago.metodo_pago})`
                    }
                });

                // Registrar en la CAJA (Solo si ingresó capital real)
                if (pago.metodo_pago !== 'SALDO_A_FAVOR' && pago.metodo_pago !== 'CUENTA_CORRIENTE') {
                    await tx.movimientoCaja.create({
                        data: {
                            cajaId: cajaAbierta.id,
                            tipo: 'COBRO_CC',
                            metodo_pago: pago.metodo_pago as any,
                            monto: pago.monto,
                            descripcion: `Cobro Cta.Cte. Cliente #${clienteId} (${pago.metodo_pago})` + (notas ? ` - ${notas}` : ""),
                        }
                    });
                }
            }

            // 2. Distribuir el pago entre las ventas adeudadas, de la más vieja a la más nueva
            const ventasPendientes = await tx.venta.findMany({
                where: { clienteId, saldo_pendiente: { gt: 0 } },
                orderBy: { fecha_emision: 'asc' }
            });

            for (const v of ventasPendientes) {
                if (restanteAbono <= 0) break;

                const aPagar = Math.min(v.saldo_pendiente, restanteAbono);
                restanteAbono -= aPagar;

                const nuevoSaldo = v.saldo_pendiente - aPagar;

                await tx.venta.update({
                    where: { id: v.id },
                    data: {
                        saldo_pendiente: nuevoSaldo,
                        estado_pago: nuevoSaldo <= 0.01 ? 'PAGADO' : 'PARCIAL'
                    }
                });
            }
        });

        revalidatePath("/clientes");
        revalidatePath("/ventas");
        revalidatePath("/caja");

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || "Error al cobrar cuenta corriente" };
    }
}


// src/app/actions/clientes.ts (Agregar al final)
export async function registrarClientePWA(data: { nombre: string, cuit?: string, direccion?: string, telefono?: string }) {
    try {
        const nuevo = await prisma.cliente.create({
            data: {
                nombre_razon_social: data.nombre,
                dni_cuit: data.cuit && data.cuit.trim() !== "" ? data.cuit : null,
                direccion: data.direccion,
                telefono: data.telefono,
                condicion_iva: "CONSUMIDOR_FINAL",
                comprobante_default: "COMPROBANTE_X",
                lista_default_id: 1 // Por defecto a la lista general
            }
        });
        revalidatePath("/clientes");
        return { success: true, cliente: nuevo };
    } catch (error: any) {
        if (error.code === 'P2002') return { success: false, error: "El CUIT/DNI ya existe." };
        return { success: false, error: "Error al crear cliente." };
    }
}