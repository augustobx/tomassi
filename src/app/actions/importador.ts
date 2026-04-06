"use server";

import prisma from "@/lib/prisma";
import * as xlsx from "xlsx";
import { revalidatePath } from "next/cache";

export async function importarProductosExcel(formData: FormData) {
    try {
        const file = formData.get("file") as File;
        const depositoId = Number(formData.get("depositoId"));
        const listasIds: number[] = formData.get("listasIds") ? JSON.parse(formData.get("listasIds") as string) : [];

        if (!file || !depositoId) {
            return { success: false, error: "Falta proporcionar el archivo o el depósito de destino." };
        }

        // Leer ArrayBuffer del archivo
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parsear Excel
        const workbook = xlsx.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convertir a JSON crudo sin saltarse celdas vacías (header: 1 asegura formato array de arrays)
        const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) {
            return { success: false, error: "El archivo parece estar vacío o no tiene registros." };
        }

        let fallas = 0;
        let procesados = 0;
        let saltados = 0;

        // Iterar desde la fila 2 (índice 1) ignorando los títulos en índice 0
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            // Si la fila está vacía, la ignoramos.
            if (!row || row.length === 0 || !row[0]) {
                saltados++;
                continue;
            }

            const rawCodigo = String(row[0] || "").trim();
            const rawNombre = String(row[1] || "").trim();
            const rawPrecio = parseFloat(String(row[2] || "0").replace(",", "."));
            const rawStock = parseFloat(String(row[3] || "0").replace(",", "."));
            const rawMarcaName = String(row[4] || "GENÉRICO").trim().toUpperCase();
            const rawCategoriaName = String(row[5] || "SIN CATEGORÍA").trim().toUpperCase();
            // Columna G (Índice 6) se ignora
            const rawProveedorName = String(row[7] || "PROVEEDOR GENÉRICO").trim().toUpperCase();

            // Validación mínima de la fila
            if (!rawCodigo || !rawNombre || isNaN(rawPrecio)) {
                fallas++;
                continue;
            }

            try {
                // 1. CASCADA: PROVEEDOR -> MARCA -> CATEGORÍA
                // a) Buscamos o creamos el Proveedor
                let proveedorObj = await prisma.proveedor.findUnique({ where: { nombre: rawProveedorName } });
                if (!proveedorObj) {
                    proveedorObj = await prisma.proveedor.create({ data: { nombre: rawProveedorName } });
                }

                // b) Buscamos o creamos la Marca atada a ese Proveedor
                let marcaObj = await prisma.marca.findUnique({
                    where: { nombre_proveedorId: { nombre: rawMarcaName, proveedorId: proveedorObj.id } }
                });
                if (!marcaObj) {
                    marcaObj = await prisma.marca.create({
                        data: { nombre: rawMarcaName, proveedorId: proveedorObj.id }
                    });
                }

                // c) Buscamos o creamos la Categoría (general o atada a la marca si tu DB permite)
                // Buscamos primero por nombre. Si queremos atarlo estricto a la marca podemos filtrar
                let categoriaObj = await prisma.categoria.findFirst({
                    where: { nombre: rawCategoriaName, marcaId: marcaObj.id }
                });
                if (!categoriaObj) {
                    categoriaObj = await prisma.categoria.create({
                        data: { nombre: rawCategoriaName, marcaId: marcaObj.id }
                    });
                }

                // 2. CREACIÓN O UPSERT DEL PRODUCTO MAESTRO
                const producto = await prisma.producto.upsert({
                    where: { codigo_articulo: rawCodigo },
                    update: {
                        nombre_producto: rawNombre,
                        precio_costo: rawPrecio,
                        proveedorId: proveedorObj.id,
                        marcaId: marcaObj.id,
                        categoriaId: categoriaObj.id,
                    },
                    create: {
                        codigo_articulo: rawCodigo,
                        codigo_barras: "0",
                        nombre_producto: rawNombre,
                        precio_costo: rawPrecio,
                        alicuota_iva: 21,
                        tipo_medicion: "UNIDAD",
                        moneda: "ARS",
                        proveedorId: proveedorObj.id,
                        marcaId: marcaObj.id,
                        categoriaId: categoriaObj.id,
                    }
                });

                // 3. ACTUALIZACIÓN ESTRICTA DEL STOCK DE ESE PRODUCTO EN EL DEPÓSITO INDICADO
                // El stock se inserta si no existe, o se actualiza si ya existe (el UPSERT asegura que la relación exista física)
                const stockAnteriorObj = await prisma.stockUbicacion.findUnique({
                    where: { productoId_depositoId: { productoId: producto.id, depositoId: depositoId } }
                });
                
                const stockAInsertar = isNaN(rawStock) ? 0 : rawStock;

                await prisma.stockUbicacion.upsert({
                    where: {
                        productoId_depositoId: { productoId: producto.id, depositoId: depositoId }
                    },
                    update: { cantidad: stockAInsertar },
                    create: {
                        productoId: producto.id,
                        depositoId: depositoId,
                        cantidad: stockAInsertar
                    }
                });

                // Registrar el movimiento de stock si hubo un cambio (o inicialización)
                if (!stockAnteriorObj || stockAnteriorObj.cantidad !== stockAInsertar) {
                     await prisma.movimientoStock.create({
                         data: {
                             productoId: producto.id,
                             depositoOrigenId: depositoId,
                             tipo: "AJUSTE",
                             cantidad: stockAInsertar - (stockAnteriorObj?.cantidad || 0),
                             motivo: "Importación Masiva Excel"
                         }
                     });
                }

                // 4. ASIGNACIÓN A LISTAS DE PRECIOS SELECCIONADAS
                // Por cada lista, hacemos un upsert para garantizar persistencia sin colisiones.
                for (const listaId of listasIds) {
                    await prisma.productoListaPrecio.upsert({
                        where: {
                            productoId_listaPrecioId: { productoId: producto.id, listaPrecioId: listaId }
                        },
                        update: {}, // Mantenemos el margen_personalizado si ya existía
                        create: {
                            productoId: producto.id,
                            listaPrecioId: listaId
                        }
                    });
                }

                procesados++;
            } catch (filaError) {
                console.error(`Error procesando fila ${i}:`, filaError);
                fallas++;
            }
        }

        revalidatePath("/inventario");
        return { 
            success: true, 
            mensaje: `Importación finalizada: ${procesados} procesados correctamente, ${fallas} filas fallidas, ${saltados} filas vacías ignoradas.` 
        };

    } catch (e: any) {
        console.error("Error grosero importando productos:", e);
        return { success: false, error: e.message || "Fallo catastrófico procesando el archivo de productos." };
    }
}

export async function importarClientesExcel(formData: FormData) {
    try {
        const file = formData.get("file") as File;
        if (!file) {
            return { success: false, error: "Falta proporcionar el archivo." };
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const workbook = xlsx.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) {
            return { success: false, error: "El archivo parece estar vacío o no tiene registros." };
        }

        let fallas = 0;
        let procesados = 0;
        let saltados = 0;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            if (!row || row.length === 0 || !row[0]) {
                saltados++;
                continue;
            }

            const rawNombre = String(row[0] || "").trim();
            const rawTipo = String(row[1] || "").trim().toLowerCase();
            const rawCUIT = String(row[2] || "").trim();
            const rawDNI = String(row[3] || "").trim();
            const rawDireccion = String(row[4] || "").trim();
            // Col F, G ignoradas (Índices 5, 6)
            const rawTelefono = String(row[7] || "").trim();

            let condicionIvaParseada = "Consumidor Final";
            if (rawTipo.includes("inscripto")) {
                condicionIvaParseada = "Responsable Inscripto";
            } else if (rawTipo.includes("exento")) {
                condicionIvaParseada = "Exento";
            } else if (rawTipo.includes("monotributo")) {
                condicionIvaParseada = "Monotributo";
            } else if (rawTipo.includes("final") || rawTipo === "cf") {
                condicionIvaParseada = "Consumidor Final";
            }

            if (!rawNombre) {
                fallas++;
                continue; // Mínimo exigido
            }

            // Lógica Crítica: CUIT pisa al DNI. Se guardan en 'dni_cuit'.
            let documentoFinal = rawCUIT !== "" ? rawCUIT : rawDNI;
            if (documentoFinal === "") {
                documentoFinal = null as any; 
                // Considerar si puede ser string vacío. En tu base es dni_cuit String? @unique.
                // Si es vacío, ¿podría colisionar en los Uniques nulos? En prisma unique nullable no colisiona, pero dejémoslo null
            }

            try {
                // Upsert cliente
                // Dado que DNI o CUIT puede no venir, si documentoFinal es null/undefined, no podemos hacer upsert por DNI
                // Haremos una búsqueda primero:
                let clienteObj = null;

                if (documentoFinal) {
                    clienteObj = await prisma.cliente.findUnique({
                        where: { dni_cuit: documentoFinal }
                    });
                } else {
                    // Si no tiene DNI, intentaremos hacer un chequeo suave por nombre a ver si existe, o solo crearlo.
                    // Para evitar colapsos, solo insertamos
                }

                if (clienteObj) {
                    await prisma.cliente.update({
                        where: { id: clienteObj.id },
                        data: {
                            nombre_razon_social: rawNombre,
                            direccion: rawDireccion,
                            telefono: rawTelefono,
                            condicion_iva: condicionIvaParseada
                        }
                    });
                } else {
                    await prisma.cliente.create({
                        data: {
                            nombre_razon_social: rawNombre,
                            dni_cuit: documentoFinal || null,
                            direccion: rawDireccion,
                            telefono: rawTelefono,
                            condicion_iva: condicionIvaParseada
                        }
                    });
                }
                
                procesados++;
            } catch (filaError) {
                console.error(`Error procesando fila de cliente ${i}:`, filaError);
                fallas++;
            }
        }

        revalidatePath("/clientes");
        return { 
            success: true, 
            mensaje: `Importación finalizada: ${procesados} procesados correctamente, ${fallas} filas fallidas, ${saltados} filas vacías ignoradas.` 
        };

    } catch (e: any) {
        console.error("Error grosero importando clientes:", e);
        return { success: false, error: e.message || "Fallo catastrófico procesando el archivo de clientes." };
    }
}
