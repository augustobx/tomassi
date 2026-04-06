import { z } from "zod";

export const productoListaPrecioSchema = z.object({
  listaPrecioId: z.coerce.number(),
  margen_personalizado: z.coerce.number().nullable().optional(),
  isActive: z.boolean().default(false),
  // UI helpers
  nombre_lista: z.string().optional(),
  margen_defecto: z.coerce.number().optional()
});

export const productoSchema = z.object({
  codigo_articulo: z.string().min(1, "El código es obligatorio"),
  codigo_barras: z.string().default("0"),
  fecha_ingreso: z.coerce.date(),
  nombre_producto: z.string().min(1, "El nombre del producto es obligatorio"),
  proveedorId: z.coerce.number().min(1, "Debe seleccionar un proveedor"),
  marcaId: z.coerce.number().nullable().optional(),
  categoriaId: z.coerce.number().nullable().optional(),
  alicuota_iva: z.coerce.number().min(0, "Debe ser al menos 0"),
  precio_costo: z.coerce.number().min(0, "Debe ser al menos 0"),
  descuento_proveedor: z.coerce.number().min(0, "Debe ser al menos 0"),

  stock_recomendado: z.coerce.number().min(0, "Debe ser al menos 0"),
  tipo_medicion: z.enum(["UNIDAD", "KILO", "LITRO", "METROS", "CAJA", "PACK"]),
  moneda: z.enum(["ARS", "USD"]),
  listas_precios: z.array(productoListaPrecioSchema),
  stocks: z.array(z.object({
    depositoId: z.coerce.number(),
    cantidad: z.coerce.number().min(0, "La cantidad no puede ser negativa")
  })).optional().default([]),
});

export type ProductoFormValues = z.infer<typeof productoSchema>;
export type ProductoListaPrecioFormValues = z.infer<typeof productoListaPrecioSchema>;
