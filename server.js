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
  tipo: { type: String, enum: ['ENTRADA', 'VENTA', 'AJUSTE', 'DEVOLUCIÓN'], required: true },
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
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RUTAS DE PRODUCTOS ─────────────────────────────────────────────────────

// Obtener todos los productos con búsqueda
app.get('/api/productos', authMiddleware, async (req, res) => {
  try {
    let query = Producto.find({ activo: true })
      .populate('categoria')
      .populate('proveedor');

    // Búsqueda por código o nombre
    const { search, categoria_id } = req.query;
    if (search) {
      query = query.regex('nombre', search, 'i').or([
        { codigo: { $regex: search, $options: 'i' } }
      ]);
    }
    if (categoria_id) {
      query = query.where('categoria').equals(categoria_id);
    }

    const productos = await query.sort({ nombre: 1 });
    res.json(productos);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Obtener un producto
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

// Crear producto
app.post('/api/productos', authMiddleware, async (req, res) => {
  try {
    const { codigo, nombre, descripcion, categoria_id, unidad_medida, precio_compra, precio_venta, stock, stock_minimo, proveedor_id } = req.body;

    const producto = new Producto({
      codigo,
      nombre,
      descripcion,
      categoria: categoria_id,
      unidad_medida,
      precio_compra,
      precio_venta,
      stock,
      stock_minimo,
      proveedor: proveedor_id
    });

    await producto.save();

    // Registrar movimiento de entrada
    await MovimientoInventario.create({
      producto: producto._id,
      tipo: 'ENTRADA',
      cantidad: stock || 0,
      referencia: 'Stock inicial',
      usuario: req.userId
    });

    res.json({ message: 'Producto creado', producto });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'El código de producto ya existe' });
    }
    res.status(400).json({ error: err.message });
  }
});

// Actualizar producto
app.put('/api/productos/:id', authMiddleware, async (req, res) => {
  try {
    const { nombre, descripcion, categoria_id, unidad_medida, precio_compra, precio_venta, stock_minimo, proveedor_id } = req.body;

    const producto = await Producto.findByIdAndUpdate(
      req.params.id,
      {
        nombre,
        descripcion,
        categoria: categoria_id,
        unidad_medida,
        precio_compra,
        precio_venta,
        stock_minimo,
        proveedor: proveedor_id
      },
      { new: true }
    ).populate('categoria').populate('proveedor');

    res.json(producto);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Eliminar producto (soft delete)
app.delete('/api/productos/:id', authMiddleware, async (req, res) => {
  try {
    await Producto.findByIdAndUpdate(req.params.id, { activo: false });
    res.json({ message: 'Producto eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

console.log('✓ Parte 1 de rutas cargada');

// CONTINUACIÓN DE SERVER.JS - PARTE 2
// Copia esto después de las rutas de productos

// ─── RUTAS DE CATEGORÍAS ────────────────────────────────────────────────────

app.get('/api/categorias', authMiddleware, async (req, res) => {
  try {
    const categorias = await Categoria.find({ activo: true }).sort({ nombre: 1 });
    
    // Contar productos por categoría
    const categorias_with_count = await Promise.all(
      categorias.map(async (cat) => {
        const count = await Producto.countDocuments({ categoria: cat._id, activo: true });
        return {
          ...cat.toObject(),
          total_productos: count
        };
      })
    );

    res.json(categorias_with_count);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/categorias', authMiddleware, async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    const categoria = new Categoria({ nombre: nombre.trim(), descripcion });
    await categoria.save();
    res.json({ message: 'Categoría creada', categoria });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/categorias/:id', authMiddleware, async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    const categoria = await Categoria.findByIdAndUpdate(
      req.params.id,
      { nombre, descripcion },
      { new: true }
    );
    res.json(categoria);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/categorias/:id', authMiddleware, async (req, res) => {
  try {
    await Categoria.findByIdAndUpdate(req.params.id, { activo: false });
    res.json({ message: 'Categoría eliminada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── RUTAS DE PROVEEDORES ───────────────────────────────────────────────────

app.get('/api/proveedores', authMiddleware, async (req, res) => {
  try {
    const proveedores = await Proveedor.find({ activo: true }).sort({ nombre: 1 });
    res.json(proveedores);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/proveedores', authMiddleware, async (req, res) => {
  try {
    const { nombre, telefono, whatsapp, email, contacto, direccion, ciudad } = req.body;
    const proveedor = new Proveedor({
      nombre,
      telefono,
      whatsapp,
      email,
      contacto,
      direccion,
      ciudad
    });
    await proveedor.save();
    res.json({ message: 'Proveedor creado', proveedor });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/proveedores/:id', authMiddleware, async (req, res) => {
  try {
    const { nombre, telefono, whatsapp, email, contacto, direccion, ciudad } = req.body;
    const proveedor = await Proveedor.findByIdAndUpdate(
      req.params.id,
      { nombre, telefono, whatsapp, email, contacto, direccion, ciudad },
      { new: true }
    );
    res.json(proveedor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/proveedores/:id', authMiddleware, async (req, res) => {
  try {
    await Proveedor.findByIdAndUpdate(req.params.id, { activo: false });
    res.json({ message: 'Proveedor eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── RUTAS DE VENTAS ─────────────────────────────────────────────────────────

app.post('/api/ventas', authMiddleware, async (req, res) => {
  try {
    const { numero_venta, cliente, detalles, subtotal, descuento, total, metodo_pago, notas } = req.body;

    // Crear venta
    const venta = new Venta({
      numero_venta,
      cliente,
      usuario: req.userId,
      subtotal,
      descuento,
      total,
      metodo_pago,
      notas,
      estado: 'completada'
    });

    await venta.save();

    // Crear detalles y actualizar stock
    for (const detalle of detalles) {
      const detalleVenta = new DetalleVenta({
        venta: venta._id,
        producto: detalle.producto_id,
        nombre_producto: detalle.nombre_producto,
        cantidad: detalle.cantidad,
        precio_unitario: detalle.precio_unitario,
        subtotal: detalle.subtotal
      });
      await detalleVenta.save();

      // Actualizar stock
      await Producto.findByIdAndUpdate(
        detalle.producto_id,
        { $inc: { stock: -detalle.cantidad } }
      );

      // Registrar movimiento de inventario
      await MovimientoInventario.create({
        producto: detalle.producto_id,
        tipo: 'VENTA',
        cantidad: detalle.cantidad,
        referencia: numero_venta,
        usuario: req.userId
      });
    }

    res.json({ message: 'Venta registrada', venta });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/ventas', authMiddleware, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, estado } = req.query;
    
    let query = Venta.find()
      .populate('usuario', 'nombre')
      .sort({ createdAt: -1 });

    if (fecha_inicio || fecha_fin) {
      const dateFilter = {};
      if (fecha_inicio) dateFilter.$gte = new Date(fecha_inicio);
      if (fecha_fin) {
        const ff = new Date(fecha_fin);
        ff.setHours(23, 59, 59, 999);
        dateFilter.$lte = ff;
      }
      query = query.where('createdAt').gte(dateFilter.$gte || new Date(0));
      if (dateFilter.$lte) query = query.lte(dateFilter.$lte);
    }

    if (estado) {
      query = query.where('estado').equals(estado);
    }

    const ventas = await query.limit(100);
    res.json(ventas);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/ventas/:id', authMiddleware, async (req, res) => {
  try {
    const venta = await Venta.findById(req.params.id).populate('usuario', 'nombre');
    const detalles = await DetalleVenta.find({ venta: req.params.id }).populate('producto');
    
    res.json({ ...venta.toObject(), detalles });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/ventas/:id', authMiddleware, async (req, res) => {
  try {
    const venta = await Venta.findById(req.params.id);
    const detalles = await DetalleVenta.find({ venta: req.params.id });

    // Revertir stock
    for (const detalle of detalles) {
      await Producto.findByIdAndUpdate(
        detalle.producto,
        { $inc: { stock: detalle.cantidad } }
      );
    }

    // Marcar venta como anulada
    await Venta.findByIdAndUpdate(req.params.id, { estado: 'anulada' });
    res.json({ message: 'Venta anulada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── RUTAS DE MOVIMIENTOS DE INVENTARIO ──────────────────────────────────────

app.get('/api/movimientos', authMiddleware, async (req, res) => {
  try {
    const { producto_id, tipo } = req.query;
    
    let query = MovimientoInventario.find()
      .populate('producto', 'codigo nombre')
      .populate('usuario', 'nombre')
      .sort({ createdAt: -1 });

    if (producto_id) {
      query = query.where('producto').equals(producto_id);
    }
    if (tipo) {
      query = query.where('tipo').equals(tipo);
    }

    const movimientos = await query.limit(200);
    res.json(movimientos);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/movimientos', authMiddleware, async (req, res) => {
  try {
    const { producto_id, tipo, cantidad, referencia, notas } = req.body;

    // Validar stock para salidas
    if ((tipo === 'SALIDA' || tipo === 'AJUSTE_NEGATIVO')) {
      const prod = await Producto.findById(producto_id);
      if (!prod || prod.stock < cantidad) {
        return res.status(400).json({ 
          error: `Stock insuficiente. Disponible: ${prod?.stock || 0}` 
        });
      }
    }

    // Calcular cambio de stock
    const cambio = (tipo === 'ENTRADA' || tipo === 'AJUSTE_POSITIVO') ? cantidad : -cantidad;

    // Actualizar stock
    await Producto.findByIdAndUpdate(
      producto_id,
      { $inc: { stock: cambio } }
    );

    // Crear movimiento
    const movimiento = new MovimientoInventario({
      producto: producto_id,
      tipo,
      cantidad,
      referencia,
      notas,
      usuario: req.userId
    });

    await movimiento.save();

    // Obtener nuevo stock
    const prod = await Producto.findById(producto_id);

    res.json({ 
      message: 'Movimiento registrado',
      movimiento,
      nuevo_stock: prod.stock
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

console.log('✓ Parte 2 de rutas cargada');

// CONTINUACIÓN DE SERVER.JS - PARTE 3
// Copia esto después de las rutas de movimientos de inventario

// ─── RUTAS DE DASHBOARD ──────────────────────────────────────────────────────

// ─── RUTAS DE DASHBOARD CORREGIDAS ──────────────────────────────────────────

app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - 7);
    inicioSemana.setHours(0, 0, 0, 0);

    // Totales generales
    const totalProductos = await Producto.countDocuments({ activo: true });
    const totalStock = await Producto.aggregate([
      { $match: { activo: true } },
      { $group: { _id: null, total: { $sum: '$stock' } } }
    ]);

    // Ventas por período
    const ventasHoy = await Venta.aggregate([
      { $match: { createdAt: { $gte: hoy }, estado: { $ne: 'anulada' } } },
      { $group: { _id: null, cnt: { $sum: 1 }, total: { $sum: '$total' } } }
    ]);

    const ventasMes = await Venta.aggregate([
      { $match: { createdAt: { $gte: inicioMes }, estado: { $ne: 'anulada' } } },
      { $group: { _id: null, cnt: { $sum: 1 }, total: { $sum: '$total' } } }
    ]);

    // CORRECCIÓN 1: Productos bajo stock (Uso de $expr para comparar campos)
    const bajoStock = await Producto.countDocuments({ 
      activo: true,
      $expr: { $lte: ["$stock", "$stock_minimo"] }
    });

    // Productos más vendidos
    const topProductos = await DetalleVenta.aggregate([
      {
        $lookup: {
          from: 'productos',
          localField: 'producto',
          foreignField: '_id',
          as: 'prod'
        }
      },
      { $unwind: '$prod' },
      { $match: { 'prod.activo': true } },
      {
        $group: {
          _id: '$producto',
          nombre: { $first: '$nombre_producto' },
          vendidos: { $sum: '$cantidad' },
          ingresos: { $sum: '$subtotal' }
        }
      },
      { $sort: { vendidos: -1 } },
      { $limit: 8 }
    ]);

    // CORRECCIÓN 2: Alertas de stock bajo
    const alertas = await Producto.find({ 
      activo: true,
      $expr: { $lte: ["$stock", "$stock_minimo"] }
    }).select('codigo nombre stock stock_minimo').limit(10);

    // Ventas recientes
    const ventasRecientes = await Venta.find()
      .populate('usuario', 'nombre')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      total_productos: totalProductos,
      total_stock: totalStock[0]?.total || 0,
      ventas_hoy: { 
        cantidad: ventasHoy[0]?.cnt || 0, 
        total: ventasHoy[0]?.total || 0 
      },
      ventas_mes: { 
        cantidad: ventasMes[0]?.cnt || 0, 
        total: ventasMes[0]?.total || 0 
      },
      productos_bajo_stock: bajoStock,
      top_productos: topProductos,
      alertas_stock: alertas,
      ventas_recientes: ventasRecientes
    });
  } catch (err) {
    console.error("Error en Dashboard:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── RUTAS DE REPORTES ──────────────────────────────────────────────────────

app.get('/api/reportes/ventas-por-dia', authMiddleware, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const fi = fecha_inicio ? new Date(fecha_inicio) : new Date(Date.now() - 29 * 86400000);
    const ff = fecha_fin ? new Date(fecha_fin) : new Date();
    ff.setHours(23, 59, 59, 999);

    const reportes = await Venta.aggregate([
      {
        $match: {
          createdAt: { $gte: fi, $lte: ff },
          estado: { $ne: 'anulada' }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          num_ventas: { $sum: 1 },
          total: { $sum: '$total' }
        }
      },
      { $sort: { _id: -1 } }
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
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   🔧 FERRETERÍA - SISTEMA DE GESTIÓN v2.0   ║
║                                              ║
║   🚀 http://localhost:${PORT}${' '.repeat(PORT.toString().length === 4 ? 26 : 25)}║
║                                              ║
║   📧 Email:      admin@ferreteria.com        ║
║   🔐 Contraseña: admin123                    ║
║                                              ║
║   💾 Base de datos: MongoDB                  ║
╚══════════════════════════════════════════════╝
  `);
});