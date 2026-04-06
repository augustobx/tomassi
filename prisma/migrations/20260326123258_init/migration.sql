-- CreateTable
CREATE TABLE `Proveedor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Proveedor_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Producto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo_articulo` VARCHAR(191) NOT NULL,
    `codigo_barras` VARCHAR(191) NOT NULL,
    `fecha_ingreso` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `nombre_producto` VARCHAR(191) NOT NULL,
    `proveedorId` INTEGER NOT NULL,
    `alicuota_iva` DOUBLE NOT NULL DEFAULT 21,
    `precio_costo` DOUBLE NOT NULL,
    `descuento_proveedor` DOUBLE NOT NULL DEFAULT 0,
    `stock_actual` INTEGER NOT NULL,
    `stock_recomendado` INTEGER NOT NULL DEFAULT 0,
    `tipo_medicion` ENUM('UNIDAD', 'KILO', 'METROS') NOT NULL DEFAULT 'UNIDAD',
    `moneda` ENUM('ARS', 'USD') NOT NULL DEFAULT 'ARS',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Producto_codigo_articulo_key`(`codigo_articulo`),
    UNIQUE INDEX `Producto_codigo_barras_key`(`codigo_barras`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ListaPrecio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_lista` VARCHAR(191) NOT NULL,
    `porcentaje_marcacion` DOUBLE NOT NULL,
    `precio_final` DOUBLE NOT NULL,
    `productoId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Producto` ADD CONSTRAINT `Producto_proveedorId_fkey` FOREIGN KEY (`proveedorId`) REFERENCES `Proveedor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ListaPrecio` ADD CONSTRAINT `ListaPrecio_productoId_fkey` FOREIGN KEY (`productoId`) REFERENCES `Producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
