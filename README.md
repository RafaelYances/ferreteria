# 🔧 Ferretería - Sistema de Gestión v2.0

Sistema web completo para la gestión de ferreterías, diseñado específicamente para pequeños negocios de la costa colombiana.

## ✨ Características

### Para Vendedores (Optimizado para velocidad)
- **Punto de Venta (POS)** rápido con búsqueda en tiempo real
- Validación de stock en tiempo real antes de vender
- Soporte para descuentos por venta
- **Métodos de pago:** Efectivo, Nequi, Transferencia
- Cálculo automático de cambio (efectivo)
- Ticket imprimible al finalizar venta
- Historial de ventas con filtro por fechas

### Gestión de Inventario
- Control de stock con alertas automáticas de mínimos
- Movimientos de inventario: Entradas, Salidas, Ajustes
- Vista completa del inventario con valor estimado
- Registro de movimientos por usuario

### Catálogo de Productos
- Categorías predefinidas para ferretería (herramientas, plomería, electricidad, pintura, etc.)
- Cálculo automático de margen de ganancia
- Múltiples unidades de medida (metro, kg, litro, rollo, etc.)
- Búsqueda por nombre y código

### Proveedores
- Directorio de proveedores con WhatsApp integrado
- Ciudad y datos de contacto

### Reportes
- Ventas por día con resumen del período
- Productos más vendidos
- Inventario completo con valor

### Administración
- Gestión de múltiples usuarios (Admin / Vendedor)
- Configuración de datos del negocio (aparece en tickets)

## 🚀 Instalación

### Requisitos
- Node.js 16 o superior
- npm

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor
npm start

# 3. Abrir en el navegador
http://localhost:3000
```

### Credenciales por defecto
- **Email:** admin@ferreteria.com
- **Contraseña:** admin123

> ⚠️ Cambia la contraseña después del primer inicio de sesión.

## 🏗️ Tecnología

| Componente | Tecnología |
|---|---|
| Backend | Node.js + Express |
| Base de datos | SQLite (sin configuración) |
| Frontend | HTML + CSS + JavaScript vanilla |
| Autenticación | JWT (12h de sesión) |

## 📁 Estructura

```
ferreteria-app/
├── server.js          # Servidor y API REST
├── package.json
├── ferreteria.db      # Base de datos (se crea automáticamente)
└── public/
    ├── index.html     # App principal (SPA)
    ├── styles.css     # Estilos
    └── app.js         # Lógica del frontend
```

## 🔐 Roles de Usuario

| Función | Vendedor | Admin |
|---|---|---|
| Registrar ventas | ✅ | ✅ |
| Ver historial | ✅ | ✅ |
| Ver productos | ✅ | ✅ |
| Agregar/editar productos | ✅ | ✅ |
| Eliminar productos | ❌ | ✅ |
| Anular ventas | ❌ | ✅ |
| Gestionar proveedores | ✅ | ✅ |
| Eliminar proveedores | ❌ | ✅ |
| Ver reportes | ✅ | ✅ |
| Administración y usuarios | ❌ | ✅ |

## 💾 Respaldo de datos

La base de datos es el archivo `ferreteria.db`. Para hacer respaldo, simplemente copia este archivo.

```bash
# Respaldo manual
cp ferreteria.db ferreteria_backup_$(date +%Y%m%d).db
```

## 📞 Soporte

Sistema desarrollado para ferreterías del municipio de la Costa Colombiana.
