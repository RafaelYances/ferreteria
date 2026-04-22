// ============================================
// FERRETERÍA - SISTEMA DE GESTIÓN v2.0
// MongoDB + Express + Node.js
// ============================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// ─── INICIALIZACIÓN ─────────────────────────────────────────────────────────
const app = express();

// Si existe en .env usa esa, si no, usa la frase de seguridad por defecto
const SECRET_KEY = process.env.SECRET_KEY || 'ferreteria_costa_colombiana_2025_segura';

// Aquí ponemos la dirección LARGA como respaldo (quitando los < >)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://ferreteria_db_user:xaPJHITWUMBi3rfd@ac-5sc1zla-shard-00-00.lw48x4q.mongodb.net:27017,ac-5sc1zla-shard-00-01.lw48x4q.mongodb.net:27017,ac-5sc1zla-shard-00-02.lw48x4q.mongodb.net:27017/?ssl=true&replicaSet=atlas-x4rrj3-shard-0&authSource=admin&appName=Cluster0';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── CONECTAR A MONGODB ─────────────────────────────────────────────────────
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✓ Conectado a MongoDB');
  initializeDatabase();
}).catch(err => {
  console.error('Error BD:', err.message);
  process.exit(1);
});

// ─── MODELOS DE MONGOOSE ────────────────────────────────────────────────────

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rol: { type: String, enum: ['admin', 'vendedor', 'almacenero'], default: 'vendedor' },
  activo: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const categoriaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  descripcion: String,
  activo: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const proveedorSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  telefono: String,
  whatsapp: String,
  email: String,
  contacto: String,
  direccion: String,
  ciudad: String,
  activo: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const productoSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true },
  nombre: { type: String, required: true },
  descripcion: String,
  categoria: { type: mongoose.Schema.Types.ObjectId, ref: 'Categoria' },
  unidad_medida: { type: String, default: 'Unidad' },
  precio_compra: { type: Number, default: 0 },
  precio_venta: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  stock_minimo: { type: Number, default: 5 },
  proveedor: { type: mongoose.Schema.Types.ObjectId, ref: 'Proveedor' },
  activo: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

productoSchema.index({ codigo: 1 });
productoSchema.index({ nombre: 1 });

const ventaSchema = new mongoose.Schema({
  numero_venta: { type: String, required: true, unique: true },
  cliente: { type: String, default: 'No definido' },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  subtotal: { type: Number, default: 0 },
  descuento: { type: Number, default: 0 },
  total: { type: Number, required: true },
  metodo_pago: { type: String, default: 'efectivo' },
  estado: { type: String, default: 'completada' },
  notas: String,
  createdAt: { type: Date, default: Date.now }
});

ventaSchema.index({ createdAt: 1 });

const detalleVentaSchema = new mongoose.Schema({
  venta: { type: mongoose.Schema.Types.ObjectId, ref: 'Venta', required: true },
  producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
  nombre_producto: String,
  cantidad: { type: Number, required: true },
  precio_unitario: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

const movimientoInventarioSchema = new mongoose.Schema({
  producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true },
  tipo: { type: String, enum: ['ENTRADA', 'VENTA', 'AJUSTE'], required: true },
  cantidad: { type: Number, required: true },
  referencia: String,
  notas: String,
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  createdAt: { type: Date, default: Date.now }
});

movimientoInventarioSchema.index({ producto: 1 });

const configSchema = new mongoose.Schema({
  clave: { type: String, required: true, unique: true },
  valor: String,
  updatedAt: { type: Date, default: Date.now }
});

// Crear modelos
const Usuario = mongoose.model('Usuario', usuarioSchema);
const Categoria = mongoose.model('Categoria', categoriaSchema);
const Proveedor = mongoose.model('Proveedor', proveedorSchema);
const Producto = mongoose.model('Producto', productoSchema);
const Venta = mongoose.model('Venta', ventaSchema);
const DetalleVenta = mongoose.model('DetalleVenta', detalleVentaSchema);
const MovimientoInventario = mongoose.model('MovimientoInventario', movimientoInventarioSchema);
const Config = mongoose.model('Config', configSchema);

// ─── FUNCIONES DE INICIALIZACIÓN ────────────────────────────────────────────
async function initializeDatabase() {
  try {
    // Crear categorías predefinidas si no existen
    const categorias = [
      { nombre: 'Herramientas Manuales', descripcion: 'Martillos, destornilladores, llaves' },
      { nombre: 'Herramientas Eléctricas', descripcion: 'Taladros, pulidoras, sierras' },
      { nombre: 'Materiales Construcción', descripcion: 'Cemento, arena, grava, bloques' },
      { nombre: 'Fontanería / Plomería', descripcion: 'Tuberías, válvulas, conectores' },
      { nombre: 'Electricidad', descripcion: 'Cables, interruptores, tomacorrientes' },
      { nombre: 'Pintura', descripcion: 'Pinturas, brochas, rodillos, solventes' },
      { nombre: 'Fijaciones', descripcion: 'Tornillos, puntillas, tuercas, taquetes' },
      { nombre: 'Ferretería General', descripcion: 'Cerraduras, bisagras, cadenas' },
      { nombre: 'Seguridad Industrial', descripcion: 'Guantes, cascos, gafas, tapa-oídos' },
      { nombre: 'Jardinería', descripcion: 'Mangueras, herramientas de jardín' },
    ];

    for (const cat of categorias) {
      await Categoria.findOneAndUpdate(
        { nombre: cat.nombre },
        cat,
        { upsert: true }
      );
    }

    // Crear admin por defecto si no existe
    const adminExists = await Usuario.findOne({ email: 'admin@ferreteria.com' });
    if (!adminExists) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await Usuario.create({
        nombre: 'Administrador',
        email: 'admin@ferreteria.com',
        password: hashedPassword,
        rol: 'admin',
        activo: true
      });
      console.log('✓ Admin creado: admin@ferreteria.com / admin123');
    }

    // Crear configuración por defecto
    const configData = [
      { clave: 'nombre_negocio', valor: 'Ferretería' },
      { clave: 'ciudad', valor: 'San Bernardo del Viento, Córdoba' },
      { clave: 'telefono', valor: '3205714864' },
      { clave: 'nit', valor: '11038335' }
    ];

    for (const conf of configData) {
      await Config.findOneAndUpdate(
        { clave: conf.clave },
        conf,
        { upsert: true }
      );
    }

    console.log('✓ Base de datos inicializada');
  } catch (err) {
    console.error('Error inicializando BD:', err);
  }
}

// ─── MIDDLEWARE DE AUTENTICACIÓN ────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.userId = decoded.id;
    req.userRol = decoded.rol;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.userRol !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para administradores' });
  }
  next();
};

// ─── RUTAS DE AUTENTICACIÓN ─────────────────────────────────────────────────

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Usuario.findOne({ email, activo: true });

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user._id, rol: user.rol },
      SECRET_KEY,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { _id: user._id, nombre: user.nombre, email: user.email, rol: user.rol }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RUTAS DE PRODUCTOS ──────────────────────────────────────────────────────

app.get('/api/productos', authMiddleware, async (req, res) => {
  try {
    const productos = await Producto.find({ activo: true })
      .populate('categoria', 'nombre')
      .populate('proveedor', 'nombre')
      .select('codigo nombre descripcion categoria unidad_medida precio_compra precio_venta stock stock_minimo proveedor');
    res.json(productos);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/productos/:id', authMiddleware, async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id)
      .populate('categoria')
      .populate('proveedor');
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/productos', authMiddleware, async (req, res) => {
  try {
    const { codigo, nombre, precio_venta, categoria, proveedor, stock } = req.body;
    
    if (!codigo || !nombre || !precio_venta) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

    const producto = new Producto({
      ...req.body,
      stock: stock || 0
    });
    
    await producto.save();
    res.json(producto);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Código de producto duplicado' });
    }
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/productos/:id', authMiddleware, async (req, res) => {
  try {
    const producto = await Producto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('categoria').populate('proveedor');
    
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── RUTAS DE CATEGORÍAS ─────────────────────────────────────────────────────

app.get('/api/categorias', authMiddleware, async (req, res) => {
  try {
    const categorias = await Categoria.find({ activo: true });
    res.json(categorias);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/categorias', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

    const categoria = new Categoria(req.body);
    await categoria.save();
    res.json(categoria);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Categoría duplicada' });
    }
    res.status(400).json({ error: err.message });
  }
});

// ─── RUTAS DE PROVEEDORES ────────────────────────────────────────────────────

app.get('/api/proveedores', authMiddleware, async (req, res) => {
  try {
    const proveedores = await Proveedor.find({ activo: true });
    res.json(proveedores);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/proveedores', authMiddleware, async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

    const proveedor = new Proveedor(req.body);
    await proveedor.save();
    res.json(proveedor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/proveedores/:id', authMiddleware, async (req, res) => {
  try {
    const proveedor = await Proveedor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(proveedor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── RUTAS DE VENTAS ─────────────────────────────────────────────────────────

app.post('/api/ventas', authMiddleware, async (req, res) => {
  try {
    const { cliente, subtotal, descuento, total, metodo_pago, detalles } = req.body;
    
    // Generar número de venta
    const lastVenta = await Venta.findOne().sort({ createdAt: -1 });
    const numero_venta = lastVenta 
      ? 'V' + (parseInt(lastVenta.numero_venta.substring(1)) + 1).toString().padStart(6, '0')
      : 'V000001';

    const venta = new Venta({
      numero_venta,
      cliente: cliente || 'Mostrador',
      usuario: req.userId,
      subtotal,
      descuento,
      total,
      metodo_pago
    });

    await venta.save();

    // Guardar detalles y actualizar stock
    for (const det of detalles) {
      const detalle = new DetalleVenta({
        venta: venta._id,
        producto: det.producto_id,
        nombre_producto: det.nombre_producto,
        cantidad: det.cantidad,
        precio_unitario: det.precio_unitario,
        subtotal: det.subtotal
      });
      await detalle.save();

      // Restar del stock
      await Producto.findByIdAndUpdate(
        det.producto_id,
        { $inc: { stock: -det.cantidad } }
      );

      // Registrar movimiento
      await MovimientoInventario.create({
        producto: det.producto_id,
        tipo: 'VENTA',
        cantidad: det.cantidad,
        referencia: numero_venta,
        usuario: req.userId
      });
    }

    res.json(venta);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/ventas', authMiddleware, async (req, res) => {
  try {
    const ventas = await Venta.find()
      .populate('usuario', 'nombre')
      .sort({ createdAt: -1 });
    res.json(ventas);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/ventas/:id', authMiddleware, async (req, res) => {
  try {
    const venta = await Venta.findById(req.params.id)
      .populate('usuario', 'nombre');
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    
    const detalles = await DetalleVenta.find({ venta: req.params.id });
    res.json({ ...venta.toObject(), detalles });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── RUTAS DE MOVIMIENTOS ────────────────────────────────────────────────────

app.post('/api/movimientos', authMiddleware, async (req, res) => {
  try {
    const { producto_id, tipo, cantidad, referencia, notas } = req.body;
    
    if (!producto_id || !tipo || !cantidad) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

    const movimiento = new MovimientoInventario({
      producto: producto_id,
      tipo,
      cantidad,
      referencia,
      notas,
      usuario: req.userId
    });

    await movimiento.save();

    // Actualizar stock según tipo
    if (tipo === 'ENTRADA') {
      await Producto.findByIdAndUpdate(producto_id, { $inc: { stock: cantidad } });
    } else if (tipo === 'AJUSTE') {
      await Producto.findByIdAndUpdate(producto_id, { $inc: { stock: cantidad } });
    }

    res.json(movimiento);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── RUTAS DE DASHBOARD ──────────────────────────────────────────────────────

app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

    const [
      total_productos,
      ventasHoy,
      ventasMes,
      productosBajoStock,
      ventasRecientes,
      topProductos,
      alertasStock
    ] = await Promise.all([
      Producto.countDocuments({ activo: true }),
      Venta.aggregate([
        { $match: { createdAt: { $gte: hoy, $lt: manana }, estado: { $ne: 'anulada' } } },
        { $group: { _id: null, total: { $sum: '$total' }, cantidad: { $sum: 1 } } }
      ]),
      Venta.aggregate([
        { $match: { createdAt: { $gte: inicioMes, $lte: finMes }, estado: { $ne: 'anulada' } } },
        { $group: { _id: null, total: { $sum: '$total' }, cantidad: { $sum: 1 } } }
      ]),
      Producto.countDocuments({ stock: { $lte: 5 }, activo: true }),
      Venta.find({ createdAt: { $gte: hoy, $lt: manana } }).sort({ createdAt: -1 }).limit(5),
      DetalleVenta.aggregate([
        { $lookup: { from: 'ventas', localField: 'venta', foreignField: '_id', as: 'venta' } },
        { $unwind: '$venta' },
        { $match: { 'venta.createdAt': { $gte: hoy, $lt: manana } } },
        { $group: { _id: '$producto', vendidos: { $sum: '$cantidad' } } },
        { $sort: { vendidos: -1 } },
        { $limit: 5 }
      ]),
      Producto.find({ stock: { $lte: 5 }, activo: true }).limit(5)
    ]);

    // Enriquecer top productos con datos de producto
    const topProductosEnriquecidos = await Promise.all(topProductos.map(async tp => {
      const prod = await Producto.findById(tp._id).select('nombre codigo stock');
      return { ...tp, nombre: prod?.nombre, codigo: prod?.codigo, stock: prod?.stock };
    }));

    res.json({
      total_productos,
      ventas_hoy: ventasHoy[0] || { total: 0, cantidad: 0 },
      ventas_mes: ventasMes[0] || { total: 0, cantidad: 0 },
      productos_bajo_stock: productosBajoStock,
      ventas_recientes: ventasRecientes,
      top_productos: topProductosEnriquecidos,
      alertas_stock: alertasStock
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── RUTAS DE REPORTES ───────────────────────────────────────────────────────

app.get('/api/reportes/ventas-dia', authMiddleware, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    
    const matchStage = { estado: { $ne: 'anulada' } };
    if (fecha_inicio || fecha_fin) {
      matchStage.createdAt = {};
      if (fecha_inicio) matchStage.createdAt.$gte = new Date(fecha_inicio);
      if (fecha_fin) {
        const ff = new Date(fecha_fin);
        ff.setHours(23, 59, 59, 999);
        matchStage.createdAt.$lte = ff;
      }
    }

    const reportes = await Venta.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          total: { $sum: '$total' },
          num_ventas: { $sum: 1 }
        }
      },
      { $sort: { '_id': -1 } },
      { $project: { dia: '$_id', total: 1, num_ventas: 1, _id: 0 } }
    ]);

    res.json(reportes);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reportes/productos-vendidos', authMiddleware, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    
    const matchStage = { estado: { $ne: 'anulada' } };
    if (fecha_inicio || fecha_fin) {
      matchStage.createdAt = {};
      if (fecha_inicio) matchStage.createdAt.$gte = new Date(fecha_inicio);
      if (fecha_fin) {
        const ff = new Date(fecha_fin);
        ff.setHours(23, 59, 59, 999);
        matchStage.createdAt.$lte = ff;
      }
    }

    const reportes = await DetalleVenta.aggregate([
      {
        $lookup: {
          from: 'ventas',
          localField: 'venta',
          foreignField: '_id',
          as: 'venta_info'
        }
      },
      { $unwind: '$venta_info' },
      { $match: { 'venta_info.estado': { $ne: 'anulada' } } },
      {
        $lookup: {
          from: 'productos',
          localField: 'producto',
          foreignField: '_id',
          as: 'prod'
        }
      },
      { $unwind: '$prod' },
      {
        $lookup: {
          from: 'categorias',
          localField: 'prod.categoria',
          foreignField: '_id',
          as: 'cat'
        }
      },
      {
        $group: {
          _id: '$producto',
          codigo: { $first: '$prod.codigo' },
          nombre: { $first: '$prod.nombre' },
          categoria: { $first: { $arrayElemAt: ['$cat.nombre', 0] } },
          total_vendido: { $sum: '$cantidad' },
          total_ingresos: { $sum: '$subtotal' },
          precio_promedio: { $avg: '$precio_unitario' }
        }
      },
      { $sort: { total_vendido: -1 } }
    ]);

    res.json(reportes);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reportes/inventario', authMiddleware, async (req, res) => {
  try {
    const reportes = await Producto.aggregate([
      { $match: { activo: true } },
      {
        $lookup: {
          from: 'categorias',
          localField: 'categoria',
          foreignField: '_id',
          as: 'cat'
        }
      },
      {
        $lookup: {
          from: 'proveedores',
          localField: 'proveedor',
          foreignField: '_id',
          as: 'prov'
        }
      },
      {
        $project: {
          codigo: 1,
          nombre: 1,
          categoria: { $arrayElemAt: ['$cat.nombre', 0] },
          stock: 1,
          stock_minimo: 1,
          precio_compra: 1,
          precio_venta: 1,
          proveedor: { $arrayElemAt: ['$prov.nombre', 0] },
          valor_inventario: { $multiply: ['$stock', '$precio_compra'] },
          estado_stock: {
            $cond: [
              { $eq: ['$stock', 0] },
              'Agotado',
              { $cond: [{ $lte: ['$stock', '$stock_minimo'] }, 'Bajo', 'Normal'] }
            ]
          }
        }
      },
      { $sort: { stock: 1 } }
    ]);

    res.json(reportes);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── RUTAS DE CONFIGURACIÓN ─────────────────────────────────────────────────

app.get('/api/config', authMiddleware, async (req, res) => {
  try {
    const configs = await Config.find();
    const config = {};
    configs.forEach(c => { config[c.clave] = c.valor; });
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/config', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nombre_negocio, ciudad, telefono, nit } = req.body;
    const updates = { nombre_negocio, ciudad, telefono, nit };
    
    for (const [clave, valor] of Object.entries(updates)) {
      if (valor !== undefined) {
        await Config.findOneAndUpdate(
          { clave },
          { valor },
          { upsert: true }
        );
      }
    }

    res.json({ mensaje: 'Configuración guardada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── RUTAS DE USUARIOS ──────────────────────────────────────────────────────

app.get('/api/usuarios', authMiddleware, adminOnly, async (req, res) => {
  try {
    const usuarios = await Usuario.find()
      .select('_id nombre email rol activo createdAt')
      .sort({ nombre: 1 });
    res.json(usuarios);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/usuarios', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña requeridos' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    const usuario = new Usuario({
      nombre,
      email,
      password: hashed,
      rol: rol || 'vendedor'
    });

    await usuario.save();
    res.json({ id: usuario._id, mensaje: 'Usuario creado' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    }
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/usuarios/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nombre, email, rol, activo } = req.body;
    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      { nombre, email, rol, activo },
      { new: true }
    ).select('_id nombre email rol activo createdAt');
    
    res.json(usuario);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/usuarios/:id/password', authMiddleware, async (req, res) => {
  try {
    const { password_actual, password_nuevo } = req.body;
    
    // Verificar que el usuario pueda cambiar su propia contraseña o sea admin
    if (req.userId != req.params.id && req.userRol !== 'admin') {
      return res.status(403).json({ error: 'Sin permiso' });
    }

    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Si no es admin, verificar contraseña actual
    if (req.userRol !== 'admin') {
      if (!bcrypt.compareSync(password_actual, usuario.password)) {
        return res.status(400).json({ error: 'Contraseña actual incorrecta' });
      }
    }

    const hashed = bcrypt.hashSync(password_nuevo, 10);
    await Usuario.findByIdAndUpdate(req.params.id, { password: hashed });

    res.json({ mensaje: 'Contraseña actualizada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/usuarios/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await Usuario.findByIdAndUpdate(req.params.id, { activo: false });
    res.json({ mensaje: 'Usuario desactivado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── INICIAR SERVIDOR ───────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor listo en puerto ${PORT}`);
});
