import { getProductos, getProveedores, getListasPrecioGlobales } from "@/app/actions/productos";
import { getDepositos } from "@/app/actions/configuracion";
import { getClientSession } from "@/app/actions/auth";
import { StockTable } from "@/components/stock-table";
import { ProductoColumn } from "@/components/stock-table";
import { Package } from "lucide-react";

export default async function InventarioPage() {
  const productosRaw = await getProductos();
  const proveedoresRaw = await getProveedores();
  const listasGlobales = await getListasPrecioGlobales();
  const depositos = await getDepositos();
  const session = await getClientSession();

  const proveedores = proveedoresRaw.map((p: any) => p.nombre);

  const data: ProductoColumn[] = productosRaw.map((p: any) => ({
    id: p.id,
    codigo_articulo: p.codigo_articulo,
    codigo_barras: p.codigo_barras || "0",
    fecha_ingreso: p.fecha_ingreso,
    nombre_producto: p.nombre_producto,
    categoria: p.categoria?.nombre || "Sin Categoría",
    proveedor: p.proveedor?.nombre || "N/A",
    marca: p.marca?.nombre || "",
    stock_actual: p.stock_actual,
    stocks: p.stocks,
    stock_recomendado: p.stock_recomendado,
    tipo_medicion: p.tipo_medicion,
    moneda: p.moneda as "ARS" | "USD",
    precio_costo: p.precio_costo,
    alicuota_iva: p.alicuota_iva,
    descuento_proveedor: p.descuento_proveedor,
    aumento_proveedor: p.proveedor?.aumento_porcentaje || 0,
    aumento_marca: p.marca?.aumento_porcentaje || 0,
    aumento_categoria: p.categoria?.aumento_porcentaje || 0,
    listas_precios: p.listas_precios,
    updatedAt: p.updatedAt,
  }));

  return (
    <div className="flex flex-col gap-6 w-full min-h-[calc(100vh-6rem)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl">
            <Package className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Control de Inventario</h2>
            <p className="text-sm text-slate-500 mt-0.5">Administrá tu catálogo, actualizá precios y controlá el stock de tus productos.</p>
          </div>
        </div>
      </div>

      <StockTable data={data} proveedores={proveedores} listasGlobales={listasGlobales} depositos={depositos} usuarioId={(session as any)?.id as number} />
    </div>
  );
}