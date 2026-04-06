import { getProductos } from "@/app/actions/productos";
import { getDepositos } from "@/app/actions/configuracion";
import { getUltimasTransferencias } from "@/app/actions/transferencias";
import { TransferenciasClient } from "./transferencias-client";
import { Replace } from "lucide-react";

export default async function TransferenciasPage() {
    // Get all products that have stock to be able to transfer
    const productosRow = await getProductos();
    
    // We only need products that exist and have stock physically somewhere to origin transfer
    const productosMap = productosRow.map(p => ({
        id: p.id,
        nombre_producto: p.nombre_producto,
        codigo_articulo: p.codigo_articulo,
        stocks: p.stocks
    }));

    const depositos = await getDepositos();
    const historial = await getUltimasTransferencias();

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto min-h-[calc(100vh-6rem)] pb-12">
            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl shrink-0">
                        <Replace className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Movimientos y Transferencias</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Mueva mercadería entre depósitos físicos y audite el historial.</p>
                    </div>
                </div>
            </div>

            <TransferenciasClient 
                productos={productosMap} 
                depositos={depositos} 
                historial={historial as any} 
            />
        </div>
    );
}
