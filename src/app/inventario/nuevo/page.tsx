import { getProveedores, getCategorias, getMarcas, getListasPrecioGlobales } from "@/app/actions/productos";
import { getDepositos } from "@/app/actions/configuracion";
import { ProductoForm } from "@/components/producto-form";
import { ArrowLeft, PackagePlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NuevoProductoPage() {
  const proveedores = await getProveedores();
  const categorias = await getCategorias();
  const marcas = await getMarcas();
  const listasPrecio = await getListasPrecioGlobales();
  const depositos = await getDepositos();

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto min-h-[calc(100vh-6rem)] pb-12">
      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link href="/inventario">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-zinc-800">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 dark:bg-indigo-500/10 p-2 rounded-lg hidden sm:block">
              <PackagePlus className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Alta de Producto</h2>
              <p className="text-sm text-slate-500 mt-0.5">Cargue un nuevo producto al inventario y configure sus listas.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full">
        <ProductoForm providers={proveedores} categorias={categorias} marcas={marcas} listasGlobales={listasPrecio} depositos={depositos} />
      </div>
    </div>
  );
}