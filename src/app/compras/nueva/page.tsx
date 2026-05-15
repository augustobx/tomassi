import { CompraForm } from "./compra-form";
import { PackagePlus } from "lucide-react";
import prisma from "@/lib/prisma";

export default async function NuevaCompraPage() {
  const productos = await prisma.producto.findMany({
    where: {
      // solo activos o sin filtro si no hay flag de activo
    },
    select: {
      id: true,
      nombre_producto: true,
      codigo_articulo: true,
      precio_costo: true,
    },
    orderBy: {
      nombre_producto: "asc"
    }
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
          <PackagePlus className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Registrar Compra</h1>
          <p className="text-sm text-slate-500">
            Ingresa los detalles de la compra, costo base e impuestos para actualizar el costo del producto.
          </p>
        </div>
      </div>

      <CompraForm productos={productos} />
    </div>
  );
}
