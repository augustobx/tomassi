"use server";

import prisma from "@/lib/prisma";
import { productoSchema, ProductoFormValues } from "@/lib/validations";
import { revalidatePath } from "next/cache";

export async function getNextCodigoArticulo() {
  const lastProducto = await prisma.producto.findFirst({
    orderBy: {
      id: "desc",
    },
  });

  if (!lastProducto || !lastProducto.codigo_articulo) {
    return "000001";
  }

  const lastCodeStr = lastProducto.codigo_articulo.replace(/\D/g, "");
  if (!lastCodeStr) return "000001";

  const nextCode = parseInt(lastCodeStr, 10) + 1;
  return nextCode.toString().padStart(6, "0");
}

export async function checkCodigoUnico(
  campo: "codigo_articulo" | "codigo_barras",
  valor: string,
  excludeId?: number
) {
  // "0" is the default barcode, allow duplicates
  if (campo === "codigo_barras" && (!valor || valor === "0")) return true;

  const whereClause: any = {
    [campo]: valor,
  };

  if (excludeId) {
    whereClause.id = {
      not: excludeId,
    };
  }

  const existing = await prisma.producto.findFirst({
    where: whereClause,
  });

  return !existing;
}

export async function crearProducto(data: ProductoFormValues) {
  try {
    const validatedData = productoSchema.parse(data);

    const isCodigoArticuloUnique = await checkCodigoUnico("codigo_articulo", validatedData.codigo_articulo);
    if (!isCodigoArticuloUnique) {
      return { success: false, error: "El código de artículo ya existe." };
    }

    if (validatedData.codigo_barras && validatedData.codigo_barras !== "0") {
      const isCodigoBarrasUnique = await checkCodigoUnico("codigo_barras", validatedData.codigo_barras);
      if (!isCodigoBarrasUnique) {
        return { success: false, error: "El código de barras ya existe." };
      }
    }

    const activeListas = validatedData.listas_precios.filter(l => l.isActive);
    const todosLosDepositos = await prisma.deposito.findMany({ select: { id: true } });

    const producto = await prisma.$transaction(async (tx) => {
      const prod = await tx.producto.create({
        data: {
          codigo_articulo: validatedData.codigo_articulo,
          codigo_barras: validatedData.codigo_barras || "0",
          fecha_ingreso: validatedData.fecha_ingreso,
          nombre_producto: validatedData.nombre_producto,
          proveedorId: validatedData.proveedorId,
          marcaId: validatedData.marcaId || null,
          categoriaId: validatedData.categoriaId || null,
          alicuota_iva: validatedData.alicuota_iva,
          precio_costo: validatedData.precio_costo,
          descuento_proveedor: validatedData.descuento_proveedor,
          stock_recomendado: validatedData.stock_recomendado,
          tipo_medicion: validatedData.tipo_medicion,
          moneda: validatedData.moneda,
          listas_precios: activeListas.length > 0 ? {
            create: activeListas.map((lista) => ({
              listaPrecioId: lista.listaPrecioId,
              margen_personalizado: lista.margen_personalizado ?? null,
            })),
          } : undefined,
          stocks: {
            create: todosLosDepositos.map(d => {
              const stockUi = validatedData.stocks?.find((s) => s.depositoId === d.id);
              return {
                depositoId: d.id,
                cantidad: stockUi ? stockUi.cantidad : 0
              };
            })
          }
        },
      });

      // Crear movimientos de stock si la cantidad inicial es mayor a 0
      for (const d of todosLosDepositos) {
        const stockUi = validatedData.stocks?.find((s) => s.depositoId === d.id);
        if (stockUi && stockUi.cantidad !== 0) {
           await tx.movimientoStock.create({
             data: {
               productoId: prod.id,
               depositoDestinoId: d.id,
               cantidad: Math.abs(stockUi.cantidad),
               tipo: stockUi.cantidad > 0 ? "ENTRADA" : "SALIDA",
               motivo: "Stock inicial s/ Sistema"
             }
           });
        }
      }

      return prod;
    });

    revalidatePath("/inventario");
    return { success: true, data: producto };
  } catch (error: any) {
    console.error("Error al crear producto:", error);
    return { success: false, error: error.message || "Error al crear producto." };
  }
}

export async function actualizarProducto(id: number, data: ProductoFormValues) {
  try {
    const validatedData = productoSchema.parse(data);

    const isCodigoArticuloUnique = await checkCodigoUnico("codigo_articulo", validatedData.codigo_articulo, id);
    if (!isCodigoArticuloUnique) {
      return { success: false, error: "El código de artículo ya existe." };
    }

    if (validatedData.codigo_barras && validatedData.codigo_barras !== "0") {
      const isCodigoBarrasUnique = await checkCodigoUnico("codigo_barras", validatedData.codigo_barras, id);
      if (!isCodigoBarrasUnique) {
        return { success: false, error: "El código de barras ya existe." };
      }
    }

    const activeListas = validatedData.listas_precios.filter(l => l.isActive);

    const producto = await prisma.$transaction(async (tx) => {
      await tx.productoListaPrecio.deleteMany({
        where: { productoId: id },
      });

      return tx.producto.update({
        where: { id },
        data: {
          codigo_articulo: validatedData.codigo_articulo,
          codigo_barras: validatedData.codigo_barras || "0",
          fecha_ingreso: validatedData.fecha_ingreso,
          nombre_producto: validatedData.nombre_producto,
          proveedorId: validatedData.proveedorId,
          marcaId: validatedData.marcaId || null,
          categoriaId: validatedData.categoriaId || null,
          alicuota_iva: validatedData.alicuota_iva,
          precio_costo: validatedData.precio_costo,
          descuento_proveedor: validatedData.descuento_proveedor,
          stock_recomendado: validatedData.stock_recomendado,
          tipo_medicion: validatedData.tipo_medicion,
          moneda: validatedData.moneda,
          listas_precios: activeListas.length > 0 ? {
            create: activeListas.map((lista) => ({
              listaPrecioId: lista.listaPrecioId,
              margen_personalizado: lista.margen_personalizado ?? null,
            })),
          } : undefined,
        },
      });
    });

    revalidatePath("/inventario");
    return { success: true, data: producto };
  } catch (error: any) {
    console.error("Error al actualizar producto:", error);
    return { success: false, error: error.message || "Error al actualizar producto." };
  }
}

export async function getProductos() {
  try {
    const productos = await prisma.producto.findMany({
      include: {
        proveedor: true,
        marca: true,
        categoria: true,
        stocks: {
          include: { 
            deposito: {
              include: { sucursal: true }
            } 
          }
        },
        listas_precios: {
          include: {
            listaPrecio: true,
          }
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return productos.map(p => ({
      ...p,
      stock_actual: p.stocks.reduce((acc, current) => acc + current.cantidad, 0)
    }));
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
}

export async function getProductoById(id: number) {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id },
      include: {
        proveedor: true,
        marca: true,
        categoria: true,
        stocks: {
          include: { 
            deposito: {
              include: { sucursal: true }
            } 
          }
        },
        listas_precios: {
          include: {
            listaPrecio: true,
          }
        },
      },
    });

    if (!producto) return null;

    return {
      ...producto,
      stock_actual: producto.stocks.reduce((acc, current) => acc + current.cantidad, 0)
    };
  } catch (error) {
    console.error("Error fetching product:", error);
    return null;
  }
}

export async function getProveedores() {
  try {
    const proveedores = await prisma.proveedor.findMany({
      orderBy: {
        nombre: "asc",
      },
    });
    return proveedores;
  } catch (error) {
    console.error("Error fetching providers:", error);
    return [];
  }
}

export async function crearProveedor(nombre: string) {
  try {
    if (!nombre.trim()) {
      return { success: false, error: "El nombre es obligatorio" };
    }

    const existing = await prisma.proveedor.findUnique({
      where: { nombre: nombre.trim() },
    });

    if (existing) {
      return { success: false, error: "El proveedor ya existe" };
    }

    const proveedor = await prisma.proveedor.create({
      data: {
        nombre: nombre.trim(),
      },
    });

    revalidatePath("/inventario/nuevo");
    return { success: true, data: proveedor };
  } catch (error: any) {
    console.error("Error creating provider:", error);
    return { success: false, error: error.message || "Error al crear proveedor" };
  }
}

export async function getCategorias() {
  try {
    const categorias = await prisma.categoria.findMany({
      include: { marca: { include: { proveedor: true } } },
      orderBy: { nombre: "asc" },
    });
    return categorias;
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

export async function getMarcas() {
  try {
    const marcas = await prisma.marca.findMany({
      include: { proveedor: true },
      orderBy: { nombre: "asc" },
    });
    return marcas;
  } catch (error) {
    console.error("Error fetching brands:", error);
    return [];
  }
}

export async function getMarcasPorProveedor(proveedorId: number) {
  try {
    const marcas = await prisma.marca.findMany({
      where: { proveedorId },
      orderBy: { nombre: "asc" },
    });
    return marcas;
  } catch (error) {
    console.error("Error fetching brands for provider:", error);
    return [];
  }
}

export async function getCategoriasPorMarca(marcaId: number) {
  try {
    const categorias = await prisma.categoria.findMany({
      where: { marcaId },
      orderBy: { nombre: "asc" },
    });
    return categorias;
  } catch (error) {
    console.error("Error fetching categories for brand:", error);
    return [];
  }
}

export async function crearMarca(data: { nombre: string; proveedorId: number }) {
  try {
    if (!data.nombre.trim()) return { success: false, error: "El nombre es obligatorio" };

    const existing = await prisma.marca.findFirst({
      where: { nombre: data.nombre.trim(), proveedorId: data.proveedorId },
    });
    if (existing) return { success: false, error: "Esta marca ya existe para este proveedor" };

    const marca = await prisma.marca.create({
      data: { nombre: data.nombre.trim(), proveedorId: data.proveedorId },
    });
    revalidatePath("/inventario/nuevo");
    return { success: true, data: marca };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear marca" };
  }
}

export async function getListasPrecioGlobales() {
  try {
    const listas = await prisma.listaPrecio.findMany({
      orderBy: { id: "asc" },
    });
    return listas;
  } catch (error) {
    console.error("Error fetching price lists:", error);
    return [];
  }
}

export async function crearCategoria(nombre: string, marcaId: number, aumento_porcentaje: number = 0) {
  try {
    if (!nombre.trim()) return { success: false, error: "El nombre es obligatorio" };
    if (!marcaId) return { success: false, error: "La marca padre es obligatoria" };

    const categoria = await prisma.categoria.create({
      data: {
        nombre: nombre.trim(),
        marcaId: marcaId,
        aumento_porcentaje: aumento_porcentaje,
      }
    });
    revalidatePath("/inventario/nuevo");
    revalidatePath("/categorias");
    return { success: true, data: categoria };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear categoría" };
  }
}

export async function crearListaPrecioGlobal(data: { nombre: string, margen_defecto: number }) {
  try {
    if (!data.nombre.trim()) return { success: false, error: "El nombre es obligatorio" };

    const existing = await prisma.listaPrecio.findUnique({ where: { nombre: data.nombre.trim() } });
    if (existing) return { success: false, error: "La lista de precios ya existe" };

    const lista = await prisma.listaPrecio.create({
      data: {
        nombre: data.nombre.trim(),
        margen_defecto: data.margen_defecto
      }
    });
    revalidatePath("/inventario/nuevo");
    return { success: true, data: lista };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear lista de precio" };
  }
}


// ==========================================
// EDICIÓN RÁPIDA DE STOCK Y PRECIO (CON HISTORIAL)
// ==========================================
export async function actualizarStockRapido(
  id: number,
  cantidad_sumar: number,
  stock_recomendado: number,
  precio_costo_nuevo: number,
  depositoId: number,
  usuarioId?: number
) {
  try {
    await prisma.$transaction(async (tx) => {
      const prodAnterior = await tx.producto.findUnique({ where: { id } });
      if (!prodAnterior) throw new Error("Producto no encontrado");

      // Buscar si el producto ya existe en esa sucursal/depósito
      let stockUbi = await tx.stockUbicacion.findUnique({
        where: { productoId_depositoId: { productoId: id, depositoId } }
      });

      if (!stockUbi) {
        stockUbi = await tx.stockUbicacion.create({
          data: { productoId: id, depositoId, cantidad: 0 }
        });
      }

      const stockActualLoc = stockUbi.cantidad;
      const stock_nuevo_loc = stockActualLoc + cantidad_sumar;

      let tipoMovimiento = "AJUSTE";
      if (cantidad_sumar !== 0 && precio_costo_nuevo !== prodAnterior.precio_costo) tipoMovimiento = "AMBOS";
      else if (cantidad_sumar !== 0) tipoMovimiento = "INGRESO_STOCK";
      else if (precio_costo_nuevo !== prodAnterior.precio_costo) tipoMovimiento = "CAMBIO_PRECIO";

      // Actualizar recomendación y costo global
      await tx.producto.update({
        where: { id },
        data: {
          stock_recomendado,
          precio_costo: precio_costo_nuevo
        }
      });

      // Si hay cambio de stock, registrar en Pivot y Movimientos
      if (cantidad_sumar !== 0) {
        await tx.stockUbicacion.update({
          where: { productoId_depositoId: { productoId: id, depositoId } },
          data: { cantidad: stock_nuevo_loc }
        });

        await tx.movimientoStock.create({
          data: {
            productoId: id,
            depositoDestinoId: depositoId,
            cantidad: cantidad_sumar,
            tipo: "AJUSTE",
            usuarioId: usuarioId || null
          }
        });
      }

      // Mantener Historial de Inventario Clásico
      if (tipoMovimiento !== "AJUSTE") {
        await tx.historialInventario.create({
          data: {
            productoId: id,
            tipo_registro: tipoMovimiento,
            stock_anterior: stockActualLoc,
            stock_nuevo: stock_nuevo_loc,
            cantidad_agregada: cantidad_sumar,
            precio_anterior: prodAnterior.precio_costo,
            precio_nuevo: precio_costo_nuevo,
            usuarioId: usuarioId || null
          }
        });
      }
    });

    revalidatePath("/inventario");
    revalidatePath("/ventas");

    return { success: true };
  } catch (error: any) {
    console.error("Error en ajuste rápido:", error);
    return { success: false, error: "Error al actualizar el producto." };
  }
}

// ==========================================
// MÉTRICAS E HISTORIAL DE INVENTARIO
// ==========================================
export async function getHistorialProducto(productoId: number) {
  try {
    const historial = await prisma.historialInventario.findMany({
      where: { productoId },
      include: { usuario: true },
      orderBy: { fecha: 'desc' }
    });
    return { success: true, data: historial };
  } catch (error) {
    console.error("Error al buscar historial del producto:", error);
    return { success: false, error: "Error al cargar las métricas." };
  }
}

// ==========================================
// EDICIÓN Y BORRADO DE CATEGORÍAS
// ==========================================
export async function actualizarCategoria(id: number, nombre: string, marcaId: number, aumento_porcentaje: number = 0) {
  try {
    if (!nombre.trim()) return { success: false, error: "El nombre es obligatorio" };
    if (!marcaId) return { success: false, error: "La marca padre es obligatoria" };

    const data: any = { 
      nombre: nombre.trim(),
      marcaId: marcaId,
      aumento_porcentaje: aumento_porcentaje
    };

    await prisma.categoria.update({ where: { id }, data });
    revalidatePath("/categorias");
    revalidatePath("/inventario/nuevo");
    revalidatePath("/inventario");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Error al actualizar la categoría." };
  }
}

export async function eliminarCategoria(id: number) {
  try {
    await prisma.categoria.delete({ where: { id } });
    revalidatePath("/categorias");
    revalidatePath("/inventario");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "No se puede eliminar esta categoría porque hay productos que la están usando." };
  }
}

// ==========================================
// EDICIÓN Y BORRADO DE LISTAS DE PRECIO
// ==========================================
export async function actualizarListaPrecioGlobal(id: number, data: { nombre: string, margen_defecto: number }) {
  try {
    if (!data.nombre.trim()) return { success: false, error: "El nombre es obligatorio" };
    await prisma.listaPrecio.update({
      where: { id },
      data: { nombre: data.nombre.trim(), margen_defecto: data.margen_defecto }
    });
    revalidatePath("/listas-precio");
    revalidatePath("/inventario");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Error al actualizar la lista." };
  }
}

export async function eliminarListaPrecioGlobal(id: number) {
  try {
    await prisma.listaPrecio.delete({ where: { id } });
    revalidatePath("/listas-precio");
    revalidatePath("/inventario");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "No se puede eliminar esta lista porque está asignada a clientes o productos." };
  }
}