import { getProductoById, getProveedores, getCategorias, getMarcas, getListasPrecioGlobales } from "@/app/actions/productos";
import { getDepositos } from "@/app/actions/configuracion";
import { ProductoForm } from "@/components/producto-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

export default async function EditProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const producto = await getProductoById(parseInt(id, 10));
  
  if (!producto) {
    notFound();
  }

  const proveedores = await getProveedores();
  const categorias = await getCategorias();
  const marcas = await getMarcas();
  const listasPrecio = await getListasPrecioGlobales();
  const depositos = await getDepositos();

  return (
    <div className="flex-1 space-y-6 flex flex-col mx-auto w-full max-w-6xl p-8 pt-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-card border rounded-2xl p-8 shadow-sm relative overflow-hidden">
         <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/2 pointer-events-none"></div>
         <div className="z-10 flex items-center gap-4">
          <Link href="/inventario">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full shadow-sm hover:bg-muted">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">Editar Producto</h2>
            <p className="text-muted-foreground mt-1 text-lg">Modifique los datos del producto o actualice sus listas de precios.</p>
          </div>
        </div>
      </div>
      <div className="max-w-[1200px]">
        <ProductoForm initialData={producto} providers={proveedores} categorias={categorias} marcas={marcas} listasGlobales={listasPrecio} depositos={depositos} />
      </div>
    </div>
  );
}
