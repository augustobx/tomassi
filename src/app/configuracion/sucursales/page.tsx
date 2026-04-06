import { PrismaClient } from "@prisma/client";
import { Store, Warehouse } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { ABMSucursalesClient } from "./abm-sucursales-client";

const prisma = new PrismaClient();

export default async function SucursalesConfigPage() {
    const sucursales = await prisma.sucursal.findMany({
        include: { depositos: true },
        orderBy: { nombre: 'asc' }
    });

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto min-h-[calc(100vh-6rem)] pb-12">
            
            {/* HEADER */}
            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl shrink-0">
                        <Store className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Sucursales y Depósitos</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Gestión de puntos de venta y almacenes de stock.</p>
                    </div>
                </div>
            </div>

            <ABMSucursalesClient sucursales={sucursales} />
        </div>
    );
}
