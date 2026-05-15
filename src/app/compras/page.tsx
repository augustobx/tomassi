import { getHistorialCompras } from "@/app/actions/compras";
import { PlusCircle, Search, Wallet } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ComprasPage() {
  const compras = await getHistorialCompras();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Wallet className="h-8 w-8 text-indigo-600" />
            Compras y Gastos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Historial de compras, control de costos e impuestos por producto.
          </p>
        </div>
        <Link href="/compras/nueva">
          <Button className="bg-indigo-600 hover:bg-indigo-700 font-bold gap-2">
            <PlusCircle className="h-5 w-5" /> Nueva Compra
          </Button>
        </Link>
      </div>

      <Card className="border-0 shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-white/50 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-800">
                Historial de Registros
              </CardTitle>
              <CardDescription>Lista detallada de compras ingresadas al sistema.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {compras.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Wallet className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-600">No hay compras registradas</p>
              <p className="text-sm">Haz clic en "Nueva Compra" para registrar tu primera operación.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold text-slate-600">Fecha</TableHead>
                    <TableHead className="font-bold text-slate-600">Producto</TableHead>
                    <TableHead className="font-bold text-slate-600">Costo Base</TableHead>
                    <TableHead className="font-bold text-slate-600">Impuestos</TableHead>
                    <TableHead className="font-bold text-slate-600 text-right">Costo Final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compras.map((compra) => (
                    <TableRow key={compra.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-medium text-slate-700">
                        {new Date(compra.fecha).toLocaleDateString("es-AR", { 
                          day: "2-digit", 
                          month: "2-digit", 
                          year: "numeric", 
                          hour: "2-digit", 
                          minute: "2-digit" 
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{compra.producto.nombre_producto}</span>
                          <span className="text-xs text-slate-500">Cod: {compra.producto.codigo_articulo}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 font-medium">
                        ${compra.costo_base.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {compra.impuestos.length > 0 ? (
                            compra.impuestos.map((imp) => (
                              <Badge key={imp.id} variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200">
                                {imp.nombre}: ${imp.monto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                {imp.porcentaje ? ` (${imp.porcentaje}%)` : ""}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">Sin impuestos</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                          ${compra.costo_final.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
