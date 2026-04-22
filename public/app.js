/* ══════════════════════════════════════════
   FERRETERÍA - Sistema de Gestión v2.0
   app.js - Lógica principal del frontend
   ══════════════════════════════════════════ */

const API = window.location.origin + '/api';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
let productosCache = [];
let categoriasCache = [];
let proveedoresCache = [];
let ventaItems = [];
let ventaDescuento = 0;
let ventaMetodoPago = 'efectivo';
let configNegocio = {};

// ── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener('load', async () => {
  if (token) {
    await iniciarApp();
  }
});

async function iniciarApp() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('main-container').style.display = 'flex';
  document.getElementById('userName').textContent = currentUser.nombre || 'Usuario';
  document.getElementById('userRol').textContent = currentUser.rol === 'admin' ? 'Administrador' : 'Vendedor';
  document.getElementById('userAvatar').textContent = (currentUser.nombre || 'U').charAt(0).toUpperCase();
  sincronizarAvatares();

  if (currentUser.rol === 'admin') {
    document.getElementById('nav-admin-li').style.display = 'block';
  }

  // Cargar config y caches en paralelo
  await Promise.all([
    cargarConfig(),
    cargarCategoriasCache(),
    cargarProveedoresCache(),
    cargarProductosCache()
  ]);

  loadPage('dashboard');
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Entrando...';
  errEl.style.display = 'none';

  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      await iniciarApp();
    } else {
      errEl.textContent = data.error || 'Credenciales incorrectas';
      errEl.style.display = 'flex';
      btn.disabled = false;
      btn.textContent = 'Iniciar Sesión';
    }
  } catch {
    errEl.textContent = '❌ Error de conexión. ¿Está el servidor activo?';
    errEl.style.display = 'flex';
    btn.disabled = false;
    btn.textContent = 'Iniciar Sesión';
  }
}

function handleLogout() {
  localStorage.clear();
  token = null;
  currentUser = {};
  location.reload();
}

// ── API HELPER ────────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(opts.headers || {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (res.status === 401) { handleLogout(); return null; }
  return res;
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success', dur = 3000) {
  const icons = { success: '✅', error: '❌', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || '💬'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), dur);
}

// ── MODALS ────────────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ── NAVIGATION ────────────────────────────────────────────────────────────────
function loadPage(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById(`nav-${page}`);
  if (navEl) navEl.classList.add('active');

  const pages = {
    dashboard: renderDashboard,
    ventas: renderVentas,
    historial: renderHistorial,
    productos: renderProductos,
    inventario: renderInventario,
    proveedores: renderProveedores,
    reportes: renderReportes,
    admin: renderAdmin
  };

  const fn = pages[page];
  if (fn) fn();
}

// ── CACHE LOADERS ─────────────────────────────────────────────────────────────
async function cargarProductosCache() {
  const res = await api('/productos');
  if (res && res.ok) productosCache = await res.json();
}

async function cargarCategoriasCache() {
  const res = await api('/categorias');
  if (res && res.ok) categoriasCache = await res.json();
}

async function cargarProveedoresCache() {
  const res = await api('/proveedores');
  if (res && res.ok) proveedoresCache = await res.json();
}

async function cargarConfig() {
  const res = await api('/config');
  if (res && res.ok) {
    configNegocio = await res.json();
    if (configNegocio.nombre_negocio) {
      document.getElementById('nombreNegocio').textContent = configNegocio.nombre_negocio;
      document.title = configNegocio.nombre_negocio + ' - Gestión';
    }
    if (configNegocio.ciudad) {
      document.getElementById('ciudadNegocio').textContent = configNegocio.ciudad;
    }
  }
}

function fmt(num) {
  return '$' + (Math.round(num || 0)).toLocaleString('es-CO');
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
async function renderDashboard() {
  const el = document.getElementById('page-content');
  el.innerHTML = `<div class="loading">⏳ Cargando panel...</div>`;

  const res = await api('/dashboard');
  if (!res || !res.ok) { el.innerHTML = `<div class="alert alert-danger">Error cargando dashboard</div>`; return; }
  const d = await res.json();

  el.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-chart-line"></i> Panel Principal</h2>
      <button class="btn btn-secondary" onclick="renderDashboard()"><i class="fa-solid fa-arrows-rotate"></i>Actualizar</button>
    </div>

    <!-- Acciones rápidas -->
    <div class="quick-actions">
      <button class="quick-btn" onclick="loadPage('ventas')">
        <span class="quick-btn-icon"><i class="fa-solid fa-cart-plus"></i></span>
        <span class="quick-btn-label">Nueva Venta</span>
      </button>
      <button class="quick-btn" onclick="openNuevoProducto()">
        <span class="quick-btn-icon"><i class="fa-solid fa-box-open"></i></span>
        <span class="quick-btn-label">Añadir Producto</span>
      </button>
      <button class="quick-btn" onclick="openModal('modalMovimiento')">
        <span class="quick-btn-icon"><i class="fa-solid fa-right-to-bracket fa-rotate-90"></i></span>
        <span class="quick-btn-label">Entrada Stock</span>
      </button>
      <button class="quick-btn" onclick="loadPage('reportes')">
        <span class="quick-btn-icon"><i class="fa-solid fa-file-lines"></i></span>
        <span class="quick-btn-label">Ver Reportes</span>
      </button>
    </div>

    <!-- Estadísticas -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--info-light);">📦</div>
        <div class="stat-info">
          <div class="stat-label">Total Productos</div>
          <div class="stat-value">${d.total_productos}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--success-light);"><i class="fa-solid fa-cart-plus"></i></div>
        <div class="stat-info">
          <div class="stat-label">Ventas Hoy</div>
          <div class="stat-value success">${fmt(d.ventas_hoy?.total)}</div>
          <div style="font-size:11px;color:var(--gray-500);">${d.ventas_hoy?.cantidad || 0} transacciones</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--primary-light);"><i class="fa-solid fa-wallet" style="color: rgb(0, 0, 0);"></i></div>
        <div class="stat-info">
          <div class="stat-label">Ventas del Mes</div>
          <div class="stat-value">${fmt(d.ventas_mes?.total)}</div>
          <div style="font-size:11px;color:var(--gray-500);">${d.ventas_mes?.cantidad || 0} transacciones</div>
        </div>
      </div>
      <div class="stat-card" style="cursor:pointer;" onclick="loadPage('inventario')">
        <div class="stat-icon" style="background:var(--danger-light);"><i class="fa-solid fa-triangle-exclamation" style="color: rgb(0, 0, 0);"></i></div>
        <div class="stat-info">
          <div class="stat-label">Bajo Stock</div>
          <div class="stat-value danger">${d.productos_bajo_stock}</div>
          <div style="font-size:11px;color:var(--gray-500);">productos críticos</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <!-- Ventas recientes -->
      <div class="table-container">
        <div class="table-header">
          <h3><i class="fa-regular fa-clock" style="color: rgb(0, 0, 0);"></i> Ventas Recientes</h3>
          <button class="btn btn-secondary btn-sm" onclick="loadPage('historial')">Ver todas</button>
        </div>
        <table>
          <thead><tr><th>Nro.</th><th>Cliente</th><th>Total</th><th>Pago</th></tr></thead>
          <tbody>
            ${d.ventas_recientes?.length ? d.ventas_recientes.map(v => `
              <tr>
                <td><span class="td-code">${v.numero_venta}</span></td>
                <td>${v.cliente}</td>
                <td><strong>${fmt(v.total)}</strong></td>
                <td><span class="badge badge-info">${v.metodo_pago || 'efectivo'}</span></td>
              </tr>
            `).join('') : `<tr><td colspan="4" class="loading">Sin ventas hoy</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- Alertas de stock -->
      <div class="card">
        <div class="card-header">
          <h3><i class="fa-solid fa-triangle-exclamation" style="color: rgb(0, 0, 0);"></i> Alertas de Stock</h3>
          <button class="btn btn-secondary btn-sm" onclick="loadPage('inventario')">Gestionar</button>
        </div>
        <div class="card-body">
          ${d.alertas_stock?.length ? `
            <div class="stock-alert-list">
              ${d.alertas_stock.map(p => `
                <div class="stock-alert-item ${p.stock < 2 ? '' : 'warning'}">
                  <div>
                    <div class="stock-alert-name">${p.nombre}</div>
                    <div class="stock-alert-code">${p.codigo}</div>
                  </div>
                  <div class="stock-alert-nums">
                    <strong style="color:${p.stock < 2 ? 'var(--danger)' : 'var(--warning)'};">${p.stock}</strong> uds<br>
                    <small>mín: ${p.stock_minimo}</small>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `<div class="empty-state"><span class="empty-icon"></span><p>Sin alertas de stock</p></div>`}
        </div>
      </div>
    </div>

    <!-- Top productos -->
    ${d.top_productos?.length ? `
      <div class="card" style="margin-top:16px;">
        <div class="card-header"><h3><i class="fa-solid fa-trophy" style="color: rgb(0, 0, 0);"></i> Productos Más Vendidos</h3></div>
        <div class="card-body">
          <div class="bar-chart">
            ${(() => {
              const max = Math.max(...d.top_productos.map(x => x.vendidos || 0));
              return d.top_productos.map(p => `
                <div class="bar-row">
                  <div class="bar-label" title="${p.nombre}">${p.nombre}</div>
                  <div class="bar-track">
                    <div class="bar-fill" style="width:${max > 0 ? (p.vendidos/max*100) : 0}%"></div>
                  </div>
                  <div class="bar-value">${p.vendidos} uds</div>
                </div>
              `).join('');
            })()}
          </div>
        </div>
      </div>
    ` : ''}
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// VENTAS / POS
// ══════════════════════════════════════════════════════════════════════════════
function renderVentas() {
  ventaItems = [];
  ventaDescuento = 0;
  ventaMetodoPago = 'efectivo';
  const el = document.getElementById('page-content');

  el.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-cart-plus"></i> Nueva Venta</h2>
      <span style="font-size:13px;color:var(--gray-500);">${new Date().toLocaleDateString('es-CO', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</span>
    </div>
    <div class="pos-layout">
      <!-- Panel izquierdo: búsqueda y lista -->
      <div class="pos-left">
        <div class="pos-search">
          <span class="search-icon"><i class="fa-solid fa-magnifying-glass" style="color: rgb(0, 0, 0);"></i></span>
          <input type="text" id="posSearch" class="form-control" 
            placeholder="Buscar por nombre o código... (mín 2 letras)"
            oninput="buscarProductoPOS(this.value)" autocomplete="off">
          <div id="posDropdown" class="search-dropdown"></div>
        </div>
        <div class="venta-items" id="ventaItemsEl">
          <div class="empty-state">
            <span class="empty-icon"><i class="fa-solid fa-cart-plus"></i></span>
            <p>Busca productos para añadir a la venta</p>
          </div>
        </div>
      </div>

      <!-- Panel derecho: resumen -->
      <div class="pos-right">
        <div class="pos-right-header">
          <h3><i class="fa-regular fa-credit-card" style="color: rgb(0, 0, 0);"></i> Resumen de Venta</h3>
        </div>

        <div style="padding:12px 16px;border-bottom:1px solid var(--gray-200);">
          <div class="form-group" style="margin-bottom:8px;">
            <label style="font-size:12px;">Cliente</label>
            <input class="form-control" id="ventaCliente" placeholder="Mostrador / Nombre cliente">
          </div>
        </div>

        <div class="pos-items-list" id="posResumenItems">
          <p style="color:var(--gray-400);font-size:13px;text-align:center;padding:20px 0;">Sin productos</p>
        </div>

        <div style="padding:12px 16px;border-top:1px solid var(--gray-200);">
          <div class="pos-resumen-row">
            <span>Subtotal:</span><span id="posSubtotal">${fmt(0)}</span>
          </div>
          <div class="pos-resumen-row">
            <span>Descuento:</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <input type="number" id="posDescuento" min="0" value="0" 
                style="width:80px;padding:4px 6px;border:1px solid var(--gray-300);border-radius:4px;font-size:13px;"
                oninput="actualizarDescuento(this.value)">
            </div>
          </div>
          <div class="pos-total">
            <span>TOTAL:</span><span id="posTotal">${fmt(0)}</span>
          </div>
        </div>

        <div style="padding:10px 16px;border-top:1px solid var(--gray-200);">
          <div style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:6px;">Método de pago:</div>
          <div class="payment-methods">
            <button class="pay-method-btn selected" onclick="seleccionarPago('efectivo', this)"><i class="fa-solid fa-money-bills" style="color: rgb(0, 0, 0);"></i> Efectivo</button>
            <button class="pay-method-btn" onclick="seleccionarPago('nequi', this)"><i class="fa-solid fa-n" style="color: rgb(0, 0, 0);"></i> Nequi</button>
            <button class="pay-method-btn" onclick="seleccionarPago('transferencia', this)"><i class="fa-solid fa-landmark" style="color: rgb(0, 0, 0);"></i> Transf.</button>
          </div>
          <div id="cambioContainer" style="display:none;background:var(--success-light);padding:8px 10px;border-radius:6px;font-size:13px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <span>Recibido:</span>
              <input type="number" id="efectivoRecibido" min="0" 
                style="width:100px;border:1.5px solid var(--success);background:#fff;text-align:right;font-weight:700;font-size:14px;padding:6px 8px;border-radius:4px;"
                oninput="calcularCambio(this.value)">
            </div>
            <div style="text-align:right;margin-top:6px;">
              <strong style="font-size:14px;">Cambio: <span id="cambioValor">${fmt(0)}</span></strong>
            </div>
          </div>
        </div>

        <div class="pos-footer">
          <button class="btn btn-primary btn-full btn-lg" id="btnCompletarVenta" 
            onclick="completarVenta()" disabled>
            <i class="fa-solid fa-square-check" style="color: rgb(0, 0, 0);"></i> Completar Venta
          </button>
          <button class="btn btn-secondary btn-full" onclick="limpiarVenta()">
            🗑️ Limpiar
          </button>
        </div>
      </div>
    </div>
  `;
  // Inicializar el método de pago por defecto
  setTimeout(() => {
    const btnEfectivo = document.querySelector('.pay-method-btn.selected');
    if (btnEfectivo) {
      seleccionarPago('efectivo', btnEfectivo);
    }
  }, 0);
}

function buscarProductoPOS(q) {
  const dropdown = document.getElementById('posDropdown');
  if (!q || q.length < 2) { dropdown.classList.remove('open'); return; }
  const ql = q.toLowerCase();
  const resultados = productosCache.filter(p =>
    p.nombre.toLowerCase().includes(ql) || p.codigo.toLowerCase().includes(ql)
  ).slice(0, 10);

  if (!resultados.length) {
    dropdown.innerHTML = `<div class="search-item"><span class="search-item-name">Sin resultados para "${q}"</span></div>`;
    dropdown.classList.add('open');
    return;
  }

  dropdown.innerHTML = resultados.map(p => `
    <div class="search-item" onclick="agregarItemVenta('${p._id}')">
      <div>
        <div class="search-item-name">${p.nombre}</div>
        <div class="search-item-sub">
          <span class="td-code">${p.codigo}</span> · 
          <span class="${p.stock <= 0 ? 'search-item-stock-low' : ''}">
            Stock: ${p.stock} ${p.unidad_medida || ''}
          </span>
          ${p.stock <= 0 ? ' · <strong style="color:var(--danger);">AGOTADO</strong>' : ''}
        </div>
      </div>
      <div class="search-item-price">${fmt(p.precio_venta)}</div>
    </div>
  `).join('');
  dropdown.classList.add('open');
}

function agregarItemVenta(productoId) {
  document.getElementById('posDropdown').classList.remove('open');
  document.getElementById('posSearch').value = '';

  const prod = productosCache.find(p => p._id === productoId);
  if (!prod) return;
  if (prod.stock <= 0) { toast('Producto sin stock disponible', 'error'); return; }

  const existe = ventaItems.find(i => i.producto_id === productoId);
  if (existe) {
    if (existe.cantidad >= prod.stock) { toast(`Stock máximo: ${prod.stock} unidades`, 'warning'); return; }
    existe.cantidad++;
  } else {
    ventaItems.push({
      producto_id: prod._id,
      nombre: prod.nombre,
      codigo: prod.codigo,
      precio_unitario: prod.precio_venta,
      cantidad: 1,
      stock_max: prod.stock
    });
  }
  actualizarUIVenta();
}

function actualizarUIVenta() {
  const el = document.getElementById('ventaItemsEl');
  const resEl = document.getElementById('posResumenItems');

  if (!ventaItems.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">🛒</span><p>Busca productos para añadir</p></div>`;
    resEl.innerHTML = `<p style="color:var(--gray-400);font-size:13px;text-align:center;padding:20px 0;">Sin productos</p>`;
    document.getElementById('posSubtotal').textContent = fmt(0);
    document.getElementById('posTotal').textContent = fmt(0);
    document.getElementById('btnCompletarVenta').disabled = true;
    return;
  }

  el.innerHTML = ventaItems.map((item, idx) => `
    <div class="venta-item">
      <div>
        <div class="venta-item-name">${item.nombre}</div>
        <div class="venta-item-code">${item.codigo} · ${fmt(item.precio_unitario)}/u</div>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="cambiarCantidad(${idx}, -1)">−</button>
        <input class="qty-input" type="number" min="1" max="${item.stock_max}" value="${item.cantidad}" 
          onchange="setCantidad(${idx}, this.value)">
        <button class="qty-btn" onclick="cambiarCantidad(${idx}, 1)">+</button>
      </div>
      <div class="venta-item-price">${fmt(item.precio_unitario * item.cantidad)}</div>
      <button class="btn-icon" onclick="quitarItem(${idx})" title="Quitar">✕</button>
    </div>
  `).join('');

  const subtotal = ventaItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const total = Math.max(0, subtotal - ventaDescuento);

  document.getElementById('posSubtotal').textContent = fmt(subtotal);
  document.getElementById('posTotal').textContent = fmt(total);

  resEl.innerHTML = ventaItems.map(i => `
    <div class="pos-resumen-row">
      <span>${i.nombre} (${i.cantidad}x)</span>
      <span>${fmt(i.precio_unitario * i.cantidad)}</span>
    </div>
  `).join('');

  document.getElementById('btnCompletarVenta').disabled = false;
  calcularCambio(document.getElementById('efectivoRecibido')?.value || 0);
}

function cambiarCantidad(idx, delta) {
  const item = ventaItems[idx];
  const nueva = item.cantidad + delta;
  if (nueva < 1) { quitarItem(idx); return; }
  if (nueva > item.stock_max) { toast(`Máximo disponible: ${item.stock_max}`, 'warning'); return; }
  item.cantidad = nueva;
  actualizarUIVenta();
}

function setCantidad(idx, val) {
  const v = parseInt(val) || 1;
  const item = ventaItems[idx];
  if (v > item.stock_max) { toast(`Máximo disponible: ${item.stock_max}`, 'warning'); item.cantidad = item.stock_max; }
  else if (v < 1) item.cantidad = 1;
  else item.cantidad = v;
  actualizarUIVenta();
}

function quitarItem(idx) {
  ventaItems.splice(idx, 1);
  actualizarUIVenta();
}

function limpiarVenta() {
  ventaItems = [];
  ventaDescuento = 0;
  ventaMetodoPago = 'efectivo';
  renderVentas();
}

function actualizarDescuento(val) {
  ventaDescuento = parseFloat(val) || 0;
  actualizarUIVenta();
}

function seleccionarPago(metodo, btn) {
  ventaMetodoPago = metodo;
  document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const cambioContainer = document.getElementById('cambioContainer');
  if (metodo === 'efectivo') {
    cambioContainer.style.display = 'block';
  } else {
    cambioContainer.style.display = 'none';
  }
}

function calcularCambio(recibido) {
  const subtotal = ventaItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const total = Math.max(0, subtotal - ventaDescuento);
  const cambio = (parseFloat(recibido) || 0) - total;
  const el = document.getElementById('cambioValor');
  if (el) {
    el.textContent = fmt(Math.max(0, cambio));
    el.style.color = cambio >= 0 ? 'var(--success)' : 'var(--danger)';
  }
}

async function completarVenta() {
  if (!ventaItems.length) return;
  const btn = document.getElementById('btnCompletarVenta');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Procesando...';

  const cliente = document.getElementById('ventaCliente').value.trim() || 'Mostrador';
  const detalles = ventaItems.map(i => ({
    producto_id: i.producto_id,
    nombre_producto: i.nombre,
    cantidad: i.cantidad,
    precio_unitario: i.precio_unitario,
    subtotal: i.cantidad * i.precio_unitario
  }));

  const subtotal = ventaItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const total = Math.max(0, subtotal - ventaDescuento);

  const venta = {
    cliente,
    subtotal,
    descuento: ventaDescuento,
    total,
    metodo_pago: ventaMetodoPago,
    detalles
  };

  const res = await api('/ventas', { method: 'POST', body: venta });
  if (!res || !res.ok) {
    const data = await res?.json().catch(() => ({}));
    toast(data.error || 'Error en la venta', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-square-check"></i> Completar Venta';
    return;
  }

  const ventaData = await res.json();
  
  // Actualizar caches
  await cargarProductosCache();
  
  // Mostrar ticket
  const ticket = `
    <div style="text-align:center;padding:16px;">
      <div style="font-size:18px;font-weight:700;margin-bottom:8px;">✅ VENTA COMPLETADA</div>
      <div style="font-size:13px;color:var(--gray-500);margin-bottom:16px;">
        ${new Date().toLocaleString('es-CO')}
      </div>
      <div style="border-top:1px dashed var(--gray-300);border-bottom:1px dashed var(--gray-300);padding:12px 0;margin:12px 0;font-size:12px;">
        <div style="margin:6px 0;"><strong>${configNegocio.nombre_negocio || 'Ferretería'}</strong></div>
        <div style="font-size:11px;color:var(--gray-500);">${configNegocio.ciudad || ''}</div>
        <div style="font-size:11px;color:var(--gray-500);">${configNegocio.telefono || ''}</div>
      </div>
      <div style="text-align:left;font-size:12px;margin:12px 0;">
        <div style="display:flex;justify-content:space-between;margin:4px 0;">
          <span>Número:</span>
          <strong>${ventaData.numero_venta}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin:4px 0;">
          <span>Cliente:</span>
          <strong>${cliente}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin:4px 0;">
          <span>Vendedor:</span>
          <strong>${currentUser.nombre || 'Sistema'}</strong>
        </div>
      </div>
      <div style="border-top:1px solid var(--gray-300);padding-top:12px;margin-top:12px;font-size:12px;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="border-bottom:1px solid var(--gray-300);">
              <th style="text-align:left;padding:4px 0;">Producto</th>
              <th style="text-align:center;padding:4px 0;">Qty</th>
              <th style="text-align:right;padding:4px 0;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${detalles.map(d => `
              <tr>
                <td style="text-align:left;padding:4px 0;">${d.nombre_producto}</td>
                <td style="text-align:center;padding:4px 0;">${d.cantidad}</td>
                <td style="text-align:right;padding:4px 0;">${fmt(d.subtotal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:12px;border-top:1px solid var(--gray-300);padding-top:12px;font-size:13px;">
        <div style="display:flex;justify-content:space-between;">
          <span>Subtotal:</span>
          <span>${fmt(subtotal)}</span>
        </div>
        ${ventaDescuento > 0 ? `
          <div style="display:flex;justify-content:space-between;color:var(--success);">
            <span>Descuento:</span>
            <span>-${fmt(ventaDescuento)}</span>
          </div>
        ` : ''}
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;margin-top:6px;">
          <span>TOTAL:</span>
          <span>${fmt(total)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:6px;color:var(--gray-600);">
          <span>Pago:</span>
          <span>${ventaMetodoPago.charAt(0).toUpperCase() + ventaMetodoPago.slice(1)}</span>
        </div>
      </div>
      <div style="margin-top:12px;font-size:10px;color:var(--gray-500);">
        <p>Gracias por su compra</p>
      </div>
    </div>
  `;

  const modalTicket = document.getElementById('modalTicket');
  document.getElementById('ticketContent').innerHTML = ticket;
  openModal('modalTicket');

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-square-check"></i> Completar Venta';
}

// ══════════════════════════════════════════════════════════════════════════════
// HISTORIAL DE VENTAS
// ══════════════════════════════════════════════════════════════════════════════
async function renderHistorial() {
  const el = document.getElementById('page-content');
  el.innerHTML = `<div class="loading">⏳ Cargando historial...</div>`;

  const res = await api('/ventas');
  if (!res || !res.ok) { el.innerHTML = `<div class="alert alert-danger">Error cargando ventas</div>`; return; }
  const ventas = await res.json();

  el.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-file-lines"></i> Historial de Ventas</h2>
      <button class="btn btn-secondary" onclick="renderHistorial()"><i class="fa-solid fa-arrows-rotate"></i> Actualizar</button>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Todas las Ventas</h3>
      </div>
      <div class="card-body">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Nro. Venta</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${ventas.length ? ventas.map(v => `
                <tr>
                  <td><span class="td-code">${v.numero_venta}</span></td>
                  <td>${v.cliente}</td>
                  <td>${v.usuario?.nombre || '-'}</td>
                  <td>${new Date(v.createdAt).toLocaleDateString('es-CO')}</td>
                  <td><strong>${fmt(v.total)}</strong></td>
                  <td><span class="badge badge-info">${v.metodo_pago || 'efectivo'}</span></td>
                  <td>
                    <button class="btn btn-sm btn-secondary" onclick="verDetalleVenta('${v._id}')">Ver</button>
                  </td>
                </tr>
              `).join('') : `<tr><td colspan="7"><div class="empty-state"><p>Sin ventas registradas</p></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

async function verDetalleVenta(ventaId) {
  const res = await api(`/ventas/${ventaId}`);
  if (!res || !res.ok) {
    toast('Error cargando detalles', 'error');
    return;
  }

  const venta = await res.json();
  const detallesHTML = `
    <div style="padding:16px;">
      <div style="margin-bottom:16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;">
          <div>
            <span style="color:var(--gray-600);">Venta:</span>
            <div style="font-weight:700;font-size:14px;">${venta.numero_venta}</div>
          </div>
          <div>
            <span style="color:var(--gray-600);">Fecha:</span>
            <div style="font-weight:700;font-size:14px;">${new Date(venta.createdAt).toLocaleDateString('es-CO')}</div>
          </div>
          <div>
            <span style="color:var(--gray-600);">Cliente:</span>
            <div style="font-weight:700;font-size:14px;">${venta.cliente}</div>
          </div>
          <div>
            <span style="color:var(--gray-600);">Vendedor:</span>
            <div style="font-weight:700;font-size:14px;">${venta.usuario?.nombre || '-'}</div>
          </div>
        </div>
      </div>

      <div style="border-top:1px solid var(--gray-200);padding-top:16px;">
        <h4 style="margin-bottom:8px;">Productos</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio Unit.</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${venta.detalles?.map(d => `
                <tr>
                  <td>${d.nombre_producto}</td>
                  <td style="text-align:center;">${d.cantidad}</td>
                  <td>${fmt(d.precio_unitario)}</td>
                  <td><strong>${fmt(d.subtotal)}</strong></td>
                </tr>
              `).join('') || '<tr><td colspan="4">Sin detalles</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div style="border-top:1px solid var(--gray-200);padding-top:16px;margin-top:16px;text-align:right;">
        <div style="margin:8px 0;font-size:13px;">
          <span style="margin-right:16px;">Subtotal: <strong>${fmt(venta.subtotal)}</strong></span>
        </div>
        ${venta.descuento > 0 ? `
          <div style="margin:8px 0;font-size:13px;color:var(--success);">
            <span style="margin-right:16px;">Descuento: <strong>-${fmt(venta.descuento)}</strong></span>
          </div>
        ` : ''}
        <div style="margin:8px 0;font-size:15px;font-weight:700;">
          <span style="margin-right:16px;">Total: <strong style="color:var(--success);">${fmt(venta.total)}</strong></span>
        </div>
        <div style="margin-top:12px;font-size:12px;color:var(--gray-600);">
          Método: <strong>${venta.metodo_pago || 'efectivo'}</strong>
        </div>
      </div>
    </div>
  `;

  document.getElementById('detalleVentaTitle').textContent = `Venta ${venta.numero_venta}`;
  document.getElementById('detalleVentaBody').innerHTML = detallesHTML;
  openModal('modalDetalleVenta');
}

// ══════════════════════════════════════════════════════════════════════════════
// PRODUCTOS
// ══════════════════════════════════════════════════════════════════════════════
async function renderProductos() {
  const el = document.getElementById('page-content');
  el.innerHTML = `<div class="loading">⏳ Cargando productos...</div>`;

  const res = await api('/productos');
  if (!res || !res.ok) { el.innerHTML = `<div class="alert alert-danger">Error cargando productos</div>`; return; }
  const productos = await res.json();

  el.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-box-open"></i> Productos</h2>
      <button class="btn btn-primary" onclick="openNuevoProducto()"><i class="fa-solid fa-plus"></i> Nuevo Producto</button>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Proveedor</th>
                <th>P. Compra</th>
                <th>P. Venta</th>
                <th>Stock</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${productos.length ? productos.map(p => `
                <tr>
                  <td><span class="td-code">${p.codigo}</span></td>
                  <td>${p.nombre}</td>
                  <td>${p.categoria?.nombre || '-'}</td>
                  <td>${p.proveedor?.nombre || '-'}</td>
                  <td>${fmt(p.precio_compra)}</td>
                  <td><strong>${fmt(p.precio_venta)}</strong></td>
                  <td>
                    <span class="badge ${p.stock <= p.stock_minimo ? 'badge-danger' : 'badge-success'}">
                      ${p.stock}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-sm btn-secondary" onclick="editarProducto('${p._id}')">Editar</button>
                  </td>
                </tr>
              `).join('') : `<tr><td colspan="8"><div class="empty-state"><p>Sin productos</p></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function openNuevoProducto() {
  document.getElementById('productoEditId').value = '';
  document.getElementById('pCodigo').value = '';
  document.getElementById('pNombre').value = '';
  document.getElementById('pDescripcion').value = '';
  document.getElementById('pUnidad').value = 'Unidad';
  document.getElementById('pCategoria').value = '';
  document.getElementById('pProveedor').value = '';
  document.getElementById('pPrecioCompra').value = '';
  document.getElementById('pPrecioVenta').value = '';
  document.getElementById('pStockMinimo').value = '5';
  document.getElementById('pStockInicial').value = '0';
  document.getElementById('stockInicialGroup').style.display = 'block';
  document.getElementById('pMargen').style.display = 'none';
  document.getElementById('modalProductoTitle').textContent = 'Nuevo Producto';

  // Cargar opciones de categorías y proveedores
  const catSelect = document.getElementById('pCategoria');
  const provSelect = document.getElementById('pProveedor');
  catSelect.innerHTML = '<option value="">Sin categoría</option>' + categoriasCache.map(c => `<option value="${c._id}">${c.nombre}</option>`).join('');
  provSelect.innerHTML = '<option value="">Sin proveedor</option>' + proveedoresCache.map(p => `<option value="${p._id}">${p.nombre}</option>`).join('');

  openModal('modalProducto');
}

async function editarProducto(productoId) {
  const prod = productosCache.find(p => p._id === productoId);
  if (!prod) return;

  document.getElementById('productoEditId').value = prod._id;
  document.getElementById('pCodigo').value = prod.codigo;
  document.getElementById('pNombre').value = prod.nombre;
  document.getElementById('pDescripcion').value = prod.descripcion || '';
  document.getElementById('pUnidad').value = prod.unidad_medida || 'Unidad';
  document.getElementById('pCategoria').value = prod.categoria?._id || prod.categoria || '';
  document.getElementById('pProveedor').value = prod.proveedor?._id || prod.proveedor || '';
  document.getElementById('pPrecioCompra').value = prod.precio_compra || '';
  document.getElementById('pPrecioVenta').value = prod.precio_venta || '';
  document.getElementById('pStockMinimo').value = prod.stock_minimo || '5';
  document.getElementById('stockInicialGroup').style.display = 'none';
  
  // Mostrar margen
  const margen = prod.precio_compra > 0 ? Math.round(((prod.precio_venta - prod.precio_compra) / prod.precio_compra) * 100) : 0;
  document.getElementById('pMargenValor').textContent = margen + '%';
  document.getElementById('pMargen').style.display = 'block';

  const catSelect = document.getElementById('pCategoria');
  const provSelect = document.getElementById('pProveedor');
  catSelect.innerHTML = '<option value="">Sin categoría</option>' + categoriasCache.map(c => `<option value="${c._id}" ${c._id === prod.categoria?._id ? 'selected' : ''}>${c.nombre}</option>`).join('');
  provSelect.innerHTML = '<option value="">Sin proveedor</option>' + proveedoresCache.map(p => `<option value="${p._id}" ${p._id === prod.proveedor?._id ? 'selected' : ''}>${p.nombre}</option>`).join('');

  document.getElementById('modalProductoTitle').textContent = 'Editar Producto';
  openModal('modalProducto');
}

async function guardarProducto() {
  const editId = document.getElementById('productoEditId').value;
  const codigo = document.getElementById('pCodigo').value.trim();
  const nombre = document.getElementById('pNombre').value.trim();
  const precio_venta = parseFloat(document.getElementById('pPrecioVenta').value) || 0;

  if (!codigo || !nombre || !precio_venta) {
    toast('Código, nombre y precio venta son requeridos', 'error');
    return;
  }

  const payload = {
    codigo,
    nombre,
    descripcion: document.getElementById('pDescripcion').value.trim(),
    unidad_medida: document.getElementById('pUnidad').value,
    categoria: document.getElementById('pCategoria').value || null,
    proveedor: document.getElementById('pProveedor').value || null,
    precio_compra: parseFloat(document.getElementById('pPrecioCompra').value) || 0,
    precio_venta,
    stock_minimo: parseInt(document.getElementById('pStockMinimo').value) || 5
  };

  if (!editId) {
    payload.stock = parseInt(document.getElementById('pStockInicial').value) || 0;
  }

  const url = editId ? `/productos/${editId}` : '/productos';
  const method = editId ? 'PUT' : 'POST';

  const res = await api(url, { method, body: payload });
  const data = await res.json();

  if (res.ok) {
    toast(editId ? 'Producto actualizado' : 'Producto creado', 'success');
    await cargarProductosCache();
    closeModal('modalProducto');
    renderProductos();
  } else {
    toast(data.error, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// INVENTARIO
// ══════════════════════════════════════════════════════════════════════════════
async function renderInventario() {
  const el = document.getElementById('page-content');
  el.innerHTML = `<div class="loading">⏳ Cargando inventario...</div>`;

  const res = await api('/reportes/inventario');
  if (!res || !res.ok) { el.innerHTML = `<div class="alert alert-danger">Error cargando inventario</div>`; return; }
  const productos = await res.json();

  el.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-square-poll-vertical"></i> Inventario</h2>
      <button class="btn btn-secondary" onclick="renderInventario()"><i class="fa-solid fa-arrows-rotate"></i> Actualizar</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--info-light);">📦</div>
        <div class="stat-info">
          <div class="stat-label">Total Productos</div>
          <div class="stat-value">${productos.length}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--success-light);"><i class="fa-solid fa-check-circle"></i></div>
        <div class="stat-info">
          <div class="stat-label">Stock Normal</div>
          <div class="stat-value">${productos.filter(p => p.estado_stock === 'Normal').length}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--warning-light);"><i class="fa-solid fa-exclamation-circle"></i></div>
        <div class="stat-info">
          <div class="stat-label">Stock Bajo</div>
          <div class="stat-value">${productos.filter(p => p.estado_stock === 'Bajo').length}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--danger-light);"><i class="fa-solid fa-times-circle"></i></div>
        <div class="stat-info">
          <div class="stat-label">Agotado</div>
          <div class="stat-value">${productos.filter(p => p.estado_stock === 'Agotado').length}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Stock</th>
                <th>Mín.</th>
                <th>Estado</th>
                <th>P. Compra</th>
                <th>Valor Inv.</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${productos.map(p => `
                <tr>
                  <td><span class="td-code">${p.codigo}</span></td>
                  <td>${p.nombre}</td>
                  <td style="text-align:center;font-weight:700;">${p.stock}</td>
                  <td style="text-align:center;">${p.stock_minimo}</td>
                  <td>
                    <span class="badge ${
                      p.estado_stock === 'Agotado' ? 'badge-danger' :
                      p.estado_stock === 'Bajo' ? 'badge-warning' :
                      'badge-success'
                    }">
                      ${p.estado_stock}
                    </span>
                  </td>
                  <td>${fmt(p.precio_compra)}</td>
                  <td><strong>${fmt(p.valor_inventario)}</strong></td>
                  <td>
                    <button class="btn btn-sm btn-secondary" onclick="abrirMovimiento('${p._id}')">Movimiento</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function abrirMovimiento(productoId) {
  const prod = productosCache.find(p => p._id === productoId);
  document.getElementById('movProductoId').value = productoId;
  document.getElementById('movProductoBuscar').value = prod?.nombre || '';
  document.getElementById('movProductoInfo').innerHTML = `
    <strong>${prod?.nombre}</strong><br>
    Código: ${prod?.codigo} | Stock actual: ${prod?.stock} ${prod?.unidad_medida || ''}
  `;
  document.getElementById('movProductoInfo').style.display = 'block';
  document.getElementById('movTipo').value = 'ENTRADA';
  document.getElementById('movCantidad').value = '1';
  document.getElementById('movReferencia').value = '';
  document.getElementById('movNotas').value = '';
  openModal('modalMovimiento');
}

function buscarProductoMov(q) {
  const dropdown = document.getElementById('movDropdown');
  if (!q || q.length < 2) { dropdown.classList.remove('open'); return; }
  const ql = q.toLowerCase();
  const resultados = productosCache.filter(p =>
    p.nombre.toLowerCase().includes(ql) || p.codigo.toLowerCase().includes(ql)
  ).slice(0, 8);

  if (!resultados.length) {
    dropdown.innerHTML = '';
    dropdown.classList.remove('open');
    return;
  }

  dropdown.innerHTML = resultados.map(p => `
    <div class="search-item" onclick="seleccionarProductoMov('${p._id}', '${p.nombre}', ${p.stock}, '${p.codigo}', '${p.unidad_medida || 'Unidad'}')">
      <div>
        <div class="search-item-name">${p.nombre}</div>
        <div class="search-item-sub"><span class="td-code">${p.codigo}</span></div>
      </div>
    </div>
  `).join('');
  dropdown.classList.add('open');
}

function seleccionarProductoMov(id, nombre, stock, codigo, unidad) {
  document.getElementById('movProductoId').value = id;
  document.getElementById('movProductoBuscar').value = nombre;
  document.getElementById('movProductoInfo').innerHTML = `
    <strong>${nombre}</strong><br>
    Código: ${codigo} | Stock actual: ${stock} ${unidad}
  `;
  document.getElementById('movProductoInfo').style.display = 'block';
  document.getElementById('movDropdown').classList.remove('open');
}

async function registrarMovimiento() {
  const productoId = document.getElementById('movProductoId').value;
  const tipo = document.getElementById('movTipo').value;
  const cantidad = parseInt(document.getElementById('movCantidad').value) || 0;
  const referencia = document.getElementById('movReferencia').value.trim();
  const notas = document.getElementById('movNotas').value.trim();

  if (!productoId || !cantidad) {
    toast('Selecciona producto y cantidad', 'error');
    return;
  }

  // Mapear tipos de interfaz a tipos de API
  const tiposMap = {
    'ENTRADA': 'ENTRADA',
    'SALIDA': 'VENTA',
    'AJUSTE_POSITIVO': 'AJUSTE',
    'AJUSTE_NEGATIVO': 'AJUSTE'
  };

  const payload = {
    producto_id: productoId,
    tipo: tiposMap[tipo],
    cantidad: tipo === 'AJUSTE_NEGATIVO' ? -cantidad : cantidad,
    referencia,
    notas
  };

  const res = await api('/movimientos', { method: 'POST', body: payload });
  const data = await res.json();

  if (res.ok) {
    toast('Movimiento registrado', 'success');
    await cargarProductosCache();
    closeModal('modalMovimiento');
    renderInventario();
  } else {
    toast(data.error, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PROVEEDORES
// ══════════════════════════════════════════════════════════════════════════════
async function renderProveedores() {
  const el = document.getElementById('page-content');
  el.innerHTML = `<div class="loading">⏳ Cargando proveedores...</div>`;

  const res = await api('/proveedores');
  if (!res || !res.ok) { el.innerHTML = `<div class="alert alert-danger">Error cargando proveedores</div>`; return; }
  const proveedores = await res.json();

  el.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-building"></i> Proveedores</h2>
      <button class="btn btn-primary" onclick="openNuevoProveedor()"><i class="fa-solid fa-plus"></i> Nuevo Proveedor</button>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>WhatsApp</th>
                <th>Ciudad</th>
                <th>Email</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${proveedores.length ? proveedores.map(p => `
                <tr>
                  <td><strong>${p.nombre}</strong></td>
                  <td>${p.contacto || '-'}</td>
                  <td>${p.telefono || '-'}</td>
                  <td>${p.whatsapp ? `<a href="https://wa.me/${p.whatsapp.replace(/\D/g, '')}" target="_blank">📱</a>` : '-'}</td>
                  <td>${p.ciudad || '-'}</td>
                  <td>${p.email || '-'}</td>
                  <td>
                    <button class="btn btn-sm btn-secondary" onclick="editarProveedor('${p._id}')">Editar</button>
                  </td>
                </tr>
              `).join('') : `<tr><td colspan="7"><div class="empty-state"><p>Sin proveedores</p></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function openNuevoProveedor() {
  document.getElementById('proveedorEditId').value = '';
  document.getElementById('provNombre').value = '';
  document.getElementById('provTelefono').value = '';
  document.getElementById('provWhatsapp').value = '';
  document.getElementById('provContacto').value = '';
  document.getElementById('provCiudad').value = '';
  document.getElementById('provDireccion').value = '';
  document.getElementById('provEmail').value = '';
  document.getElementById('modalProveedorTitle').textContent = 'Nuevo Proveedor';
  openModal('modalProveedor');
}

async function editarProveedor(proveedorId) {
  const prov = proveedoresCache.find(p => p._id === proveedorId);
  if (!prov) return;

  document.getElementById('proveedorEditId').value = prov._id;
  document.getElementById('provNombre').value = prov.nombre;
  document.getElementById('provTelefono').value = prov.telefono || '';
  document.getElementById('provWhatsapp').value = prov.whatsapp || '';
  document.getElementById('provContacto').value = prov.contacto || '';
  document.getElementById('provCiudad').value = prov.ciudad || '';
  document.getElementById('provDireccion').value = prov.direccion || '';
  document.getElementById('provEmail').value = prov.email || '';
  document.getElementById('modalProveedorTitle').textContent = 'Editar Proveedor';
  openModal('modalProveedor');
}

async function guardarProveedor() {
  const nombre = document.getElementById('provNombre').value.trim();
  if (!nombre) {
    toast('Nombre requerido', 'error');
    return;
  }

  const editId = document.getElementById('proveedorEditId').value;
  const payload = {
    nombre,
    telefono: document.getElementById('provTelefono').value.trim(),
    whatsapp: document.getElementById('provWhatsapp').value.trim(),
    contacto: document.getElementById('provContacto').value.trim(),
    ciudad: document.getElementById('provCiudad').value.trim(),
    direccion: document.getElementById('provDireccion').value.trim(),
    email: document.getElementById('provEmail').value.trim()
  };

  const url = editId ? `/proveedores/${editId}` : '/proveedores';
  const method = editId ? 'PUT' : 'POST';

  const res = await api(url, { method, body: payload });
  const data = await res.json();

  if (res.ok) {
    toast(editId ? 'Proveedor actualizado' : 'Proveedor creado', 'success');
    await cargarProveedoresCache();
    closeModal('modalProveedor');
    renderProveedores();
  } else {
    toast(data.error, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// REPORTES
// ══════════════════════════════════════════════════════════════════════════════
async function renderReportes() {
  const el = document.getElementById('page-content');
  el.innerHTML = `<div class="loading">⏳ Cargando reportes...</div>`;

  const [resVentas, resProd] = await Promise.all([
    api('/reportes/ventas-dia'),
    api('/reportes/productos-vendidos')
  ]);

  el.innerHTML = `
    <div class="page-header">
      <h2>📄 Reportes</h2>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--success-light);"><i class="fa-solid fa-cart-plus"></i></div>
        <div class="stat-info">
          <div class="stat-label">Ventas Por Día</div>
          <div class="stat-value">${resVentas?.ok ? '✓' : '✗'}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--info-light);">📦</div>
        <div class="stat-info">
          <div class="stat-label">Productos Vendidos</div>
          <div class="stat-value">${resProd?.ok ? '✓' : '✗'}</div>
        </div>
      </div>
    </div>

    <div id="ventasPorDiaContent" style="margin-bottom:16px;"></div>
    <div id="productosVendidosContent"></div>
  `;

  if (resVentas?.ok) {
    const ventas = await resVentas.json();
    const totalVentas = ventas.reduce((s, v) => s + v.total, 0);
    const elV = document.getElementById('ventasPorDiaContent');
    if (elV) elV.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>📈 Ventas por Día</h3></div>
        <div class="card-body">
      <div class="stats-grid">
        <div class="stat-card" style="flex:1;">
          <div class="stat-icon" style="background:var(--success-light);">💰</div>
          <div class="stat-info"><div class="stat-label">Total Período</div><div class="stat-value">${fmt(totalVentas)}</div></div>
        </div>
        <div class="stat-card" style="flex:1;">
          <div class="stat-icon" style="background:var(--primary-light);">📊</div>
          <div class="stat-info"><div class="stat-label">No. Días</div><div class="stat-value">${ventas.length}</div></div>
        </div>
        <div class="stat-card" style="flex:1;">
          <div class="stat-icon" style="background:var(--primary-light);">📅</div>
          <div class="stat-info"><div class="stat-label">Promedio/Día</div><div class="stat-value">${ventas.length ? fmt(totalVentas / ventas.length) : fmt(0)}</div></div>
        </div>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Fecha</th><th>No. Ventas</th><th>Total</th></tr></thead>
          <tbody>
            ${ventas.length ? ventas.map(v => `
              <tr>
                <td>${new Date(v.dia + 'T12:00:00').toLocaleDateString('es-CO', {weekday:'long', day:'numeric', month:'long'})}</td>
                <td>${v.num_ventas} ventas</td>
                <td><strong>${fmt(v.total)}</strong></td>
              </tr>
            `).join('') : `<tr><td colspan="3"><div class="empty-state"><p>Sin ventas en el período</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  if (resProd?.ok) {
    const prods = await resProd.json();
    const elP = document.getElementById('productosVendidosContent');
    if (elP) elP.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>🏆 Productos Más Vendidos</h3></div>
        <div class="card-body">
      <div class="table-container">
        <table>
          <thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Und. Vendidas</th><th>Total Ingresos</th></tr></thead>
          <tbody>
            ${prods.length ? prods.map(p => `
              <tr>
                <td><span class="td-code">${p.codigo}</span></td>
                <td>${p.nombre}</td>
                <td>${p.categoria || '-'}</td>
                <td>${p.total_vendido}</td>
                <td><strong>${fmt(p.total_ingresos)}</strong></td>
              </tr>
            `).join('') : `<tr><td colspan="5"><div class="empty-state"><p>Sin ventas en el período</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMINISTRACIÓN
// ══════════════════════════════════════════════════════════════════════════════
async function renderAdmin() {
  if (currentUser.rol !== 'admin') { toast('Acceso restringido', 'error'); loadPage('dashboard'); return; }
  const el = document.getElementById('page-content');

  const [resUsers, resConfig] = await Promise.all([api('/usuarios'), api('/config')]);
  const usuarios = resUsers?.ok ? await resUsers.json() : [];
  const config = resConfig?.ok ? await resConfig.json() : {};

  el.innerHTML = `
    <div class="page-header"><h2>⚙️ Administración</h2></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <!-- Config negocio -->
      <div class="card">
        <div class="card-header"><h3>🏪 Datos del Negocio</h3></div>
        <div class="card-body">
          <div class="form-group">
            <label>Nombre del Negocio</label>
            <input class="form-control" id="cfgNombre" value="${config.nombre_negocio || ''}">
          </div>
          <div class="form-group">
            <label>Ciudad</label>
            <input class="form-control" id="cfgCiudad" value="${config.ciudad || ''}">
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input class="form-control" id="cfgTel" value="${config.telefono || ''}">
          </div>
          <div class="form-group">
            <label>NIT / Cédula</label>
            <input class="form-control" id="cfgNit" value="${config.nit || ''}">
          </div>
          <button class="btn btn-primary" onclick="guardarConfig()">💾 Guardar Configuración</button>
        </div>
      </div>

      <!-- Usuarios -->
      <div class="card">
        <div class="card-header">
          <h3>👥 Usuarios del Sistema</h3>
          <button class="btn btn-primary btn-sm" onclick="openModalNuevoUsuario()">+ Usuario</button>
        </div>
        <div class="card-body">
          ${usuarios.map(u => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--gray-100);">
              <div>
                <div style="font-weight:600;font-size:13.5px;">${u.nombre}</div>
                <div style="font-size:12px;color:var(--gray-500);">${u.email}</div>
              </div>
              <span class="badge ${u.rol === 'admin' ? 'badge-warning' : 'badge-info'}">${u.rol}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Modal nuevo usuario embebido -->
    <div id="modalNuevoUsuario" class="modal-overlay">
      <div class="modal-box" style="max-width:400px;">
        <div class="modal-head">
          <h2>Nuevo Usuario</h2>
          <button class="close-btn" onclick="closeModal('modalNuevoUsuario')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nombre *</label>
            <input class="form-control" id="nuNombre" placeholder="Nombre completo">
          </div>
          <div class="form-group">
            <label>Email *</label>
            <input class="form-control" type="email" id="nuEmail" placeholder="correo@ejemplo.com">
          </div>
          <div class="form-group">
            <label>Contraseña *</label>
            <input class="form-control" type="password" id="nuPassword" placeholder="Mínimo 6 caracteres">
          </div>
          <div class="form-group">
            <label>Rol</label>
            <select class="form-control" id="nuRol">
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary" onclick="closeModal('modalNuevoUsuario')">Cancelar</button>
          <button class="btn btn-primary" onclick="crearUsuario()">Crear Usuario</button>
        </div>
      </div>
    </div>
  `;
}

function openModalNuevoUsuario() { openModal('modalNuevoUsuario'); }

async function crearUsuario() {
  const payload = {
    nombre: document.getElementById('nuNombre').value.trim(),
    email: document.getElementById('nuEmail').value.trim(),
    password: document.getElementById('nuPassword').value,
    rol: document.getElementById('nuRol').value
  };
  if (!payload.nombre || !payload.email || !payload.password) { toast('Todos los campos son requeridos', 'error'); return; }
  const res = await api('/usuarios', { method: 'POST', body: payload });
  const data = await res.json();
  if (res.ok) {
    toast('Usuario creado', 'success');
    closeModal('modalNuevoUsuario');
    renderAdmin();
  } else {
    toast(data.error, 'error');
  }
}

async function guardarConfig() {
  const payload = {
    nombre_negocio: document.getElementById('cfgNombre').value.trim(),
    ciudad: document.getElementById('cfgCiudad').value.trim(),
    telefono: document.getElementById('cfgTel').value.trim(),
    nit: document.getElementById('cfgNit').value.trim()
  };
  const res = await api('/config', { method: 'PUT', body: payload });
  const data = await res.json();
  if (res.ok) {
    toast('Configuración guardada', 'success');
    await cargarConfig();
  } else {
    toast(data.error, 'error');
  }
}

// ── LÓGICA DE NAVEGACIÓN MÓVIL ──────────────────────────

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
}

// Modificamos la función loadPage existente para que cierre el menú en móviles
const originalLoadPage = loadPage;
loadPage = function(page) {
  originalLoadPage(page);
  
  // Si estamos en móvil, cerramos el sidebar tras clickear
  if (window.innerWidth <= 992) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar.classList.contains('open')) {
      toggleSidebar();
    }
  }
  
  // Scroll al inicio de la página
  window.scrollTo(0, 0);
};

// Sincronizar el avatar del móvil con el del usuario
function sincronizarAvatares() {
    const mobileAvatar = document.getElementById('userAvatarMobile');
    if (mobileAvatar) {
        mobileAvatar.textContent = (currentUser.nombre || 'U').charAt(0).toUpperCase();
    }
}    cargarConfig(),
    cargarCategoriasCache(),
    cargarProveedoresCache(),
    cargarProductosCache()
  ]);

  loadPage('dashboard');
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Entrando...';
  errEl.style.display = 'none';

  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      await iniciarApp();
    } else {
      errEl.textContent = data.error || 'Credenciales incorrectas';
      errEl.style.display = 'flex';
      btn.disabled = false;
      btn.textContent = 'Iniciar Sesión';
    }
  } catch {
    errEl.textContent = '❌ Error de conexión. ¿Está el servidor activo?';
    errEl.style.display = 'flex';
    btn.disabled = false;
    btn.textContent = 'Iniciar Sesión';
  }
}

function handleLogout() {
  localStorage.clear();
  token = null;
  currentUser = {};
  location.reload();
}

// ── API HELPER ────────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(opts.headers || {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (res.status === 401) { handleLogout(); return null; }
  return res;
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success', dur = 3000) {
  const icons = { success: '✅', error: '❌', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || '💬'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), dur);
}

// ── MODALS ────────────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ── NAVIGATION ────────────────────────────────────────────────────────────────
function loadPage(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById(`nav-${page}`);
  if (navEl) navEl.classList.add('active');

  const pages = {
    dashboard: renderDashboard,
    ventas: renderVentas,
    historial: renderHistorial,
    productos: renderProductos,
    inventario: renderInventario,
    proveedores: renderProveedores,
    reportes: renderReportes,
    admin: renderAdmin
  };

  const fn = pages[page];
  if (fn) fn();
}

// ── CACHE LOADERS ─────────────────────────────────────────────────────────────
async function cargarProductosCache() {
  const res = await api('/productos');
  if (res && res.ok) productosCache = await res.json();
}

async function cargarCategoriasCache() {
  const res = await api('/categorias');
  if (res && res.ok) categoriasCache = await res.json();
}

async function cargarProveedoresCache() {
  const res = await api('/proveedores');
  if (res && res.ok) proveedoresCache = await res.json();
}

async function cargarConfig() {
  const res = await api('/config');
  if (res && res.ok) {
    configNegocio = await res.json();
    if (configNegocio.nombre_negocio) {
      document.getElementById('nombreNegocio').textContent = configNegocio.nombre_negocio;
      document.title = configNegocio.nombre_negocio + ' - Gestión';
    }
    if (configNegocio.ciudad) {
      document.getElementById('ciudadNegocio').textContent = configNegocio.ciudad;
    }
  }
}

function fmt(num) {
  return '$' + (Math.round(num || 0)).toLocaleString('es-CO');
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
async function renderDashboard() {
  const el = document.getElementById('page-content');
  el.innerHTML = `<div class="loading">⏳ Cargando panel...</div>`;

  const res = await api('/dashboard');
  if (!res || !res.ok) { el.innerHTML = `<div class="alert alert-danger">Error cargando dashboard</div>`; return; }
  const d = await res.json();

  el.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-chart-line"></i> Panel Principal</h2>
      <button class="btn btn-secondary" onclick="renderDashboard()"><i class="fa-solid fa-arrows-rotate"></i>Actualizar</button>
    </div>

    <!-- Acciones rápidas -->
    <div class="quick-actions">
      <button class="quick-btn" onclick="loadPage('ventas')">
        <span class="quick-btn-icon"><i class="fa-solid fa-cart-plus"></i></span>
        <span class="quick-btn-label">Nueva Venta</span>
      </button>
      <button class="quick-btn" onclick="openNuevoProducto()">
        <span class="quick-btn-icon"><i class="fa-solid fa-box-open"></i></span>
        <span class="quick-btn-label">Añadir Producto</span>
      </button>
      <button class="quick-btn" onclick="openModal('modalMovimiento')">
        <span class="quick-btn-icon"><i class="fa-solid fa-right-to-bracket fa-rotate-90"></i></span>
        <span class="quick-btn-label">Entrada Stock</span>
      </button>
      <button class="quick-btn" onclick="loadPage('reportes')">
        <span class="quick-btn-icon"><i class="fa-solid fa-file-lines"></i></span>
        <span class="quick-btn-label">Ver Reportes</span>
      </button>
    </div>

    <!-- Estadísticas -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--info-light);">📦</div>
        <div class="stat-info">
          <div class="stat-label">Total Productos</div>
          <div class="stat-value">${d.total_productos}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--success-light);"><i class="fa-solid fa-cart-plus"></i></div>
        <div class="stat-info">
          <div class="stat-label">Ventas Hoy</div>
          <div class="stat-value success">${fmt(d.ventas_hoy?.total)}</div>
          <div style="font-size:11px;color:var(--gray-500);">${d.ventas_hoy?.cantidad || 0} transacciones</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--primary-light);"><i class="fa-solid fa-wallet" style="color: rgb(0, 0, 0);"></i></div>
        <div class="stat-info">
          <div class="stat-label">Ventas del Mes</div>
          <div class="stat-value">${fmt(d.ventas_mes?.total)}</div>
          <div style="font-size:11px;color:var(--gray-500);">${d.ventas_mes?.cantidad || 0} transacciones</div>
        </div>
      </div>
      <div class="stat-card" style="cursor:pointer;" onclick="loadPage('inventario')">
        <div class="stat-icon" style="background:var(--danger-light);"><i class="fa-solid fa-triangle-exclamation" style="color: rgb(0, 0, 0);"></i></div>
        <div class="stat-info">
          <div class="stat-label">Bajo Stock</div>
          <div class="stat-value danger">${d.productos_bajo_stock}</div>
          <div style="font-size:11px;color:var(--gray-500);">productos críticos</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <!-- Ventas recientes -->
      <div class="table-container">
        <div class="table-header">
          <h3><i class="fa-regular fa-clock" style="color: rgb(0, 0, 0);"></i> Ventas Recientes</h3>
          <button class="btn btn-secondary btn-sm" onclick="loadPage('historial')">Ver todas</button>
        </div>
        <table>
          <thead><tr><th>Nro.</th><th>Cliente</th><th>Total</th><th>Pago</th></tr></thead>
          <tbody>
            ${d.ventas_recientes?.length ? d.ventas_recientes.map(v => `
              <tr>
                <td><span class="td-code">${v.numero_venta}</span></td>
                <td>${v.cliente}</td>
                <td><strong>${fmt(v.total)}</strong></td>
                <td><span class="badge badge-info">${v.metodo_pago || 'efectivo'}</span></td>
              </tr>
            `).join('') : `<tr><td colspan="4" class="loading">Sin ventas hoy</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- Alertas de stock -->
      <div class="card">
        <div class="card-header">
          <h3><i class="fa-solid fa-triangle-exclamation" style="color: rgb(0, 0, 0);"></i> Alertas de Stock</h3>
          <button class="btn btn-secondary btn-sm" onclick="loadPage('inventario')">Gestionar</button>
        </div>
        <div class="card-body">
          ${d.alertas_stock?.length ? `
            <div class="stock-alert-list">
              ${d.alertas_stock.map(p => `
                <div class="stock-alert-item ${p.stock < 2 ? '' : 'warning'}">
                  <div>
                    <div class="stock-alert-name">${p.nombre}</div>
                    <div class="stock-alert-code">${p.codigo}</div>
                  </div>
                  <div class="stock-alert-nums">
                    <strong style="color:${p.stock < 2 ? 'var(--danger)' : 'var(--warning)'};">${p.stock}</strong> uds<br>
                    <small>mín: ${p.stock_minimo}</small>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `<div class="empty-state"><span class="empty-icon"></span><p>Sin alertas de stock</p></div>`}
        </div>
      </div>
    </div>

    <!-- Top productos -->
    ${d.top_productos?.length ? `
      <div class="card" style="margin-top:16px;">
        <div class="card-header"><h3><i class="fa-solid fa-trophy" style="color: rgb(0, 0, 0);"></i> Productos Más Vendidos</h3></div>
        <div class="card-body">
          <div class="bar-chart">
            ${(() => {
              const max = Math.max(...d.top_productos.map(x => x.vendidos || 0));
              return d.top_productos.map(p => `
                <div class="bar-row">
                  <div class="bar-label" title="${p.nombre}">${p.nombre}</div>
                  <div class="bar-track">
                    <div class="bar-fill" style="width:${max > 0 ? (p.vendidos/max*100) : 0}%"></div>
                  </div>
                  <div class="bar-value">${p.vendidos} uds</div>
                </div>
              `).join('');
            })()}
          </div>
        </div>
      </div>
    ` : ''}
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// VENTAS / POS
// ══════════════════════════════════════════════════════════════════════════════
function renderVentas() {
  ventaItems = [];
  ventaDescuento = 0;
  ventaMetodoPago = 'efectivo';
  const el = document.getElementById('page-content');

  el.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-cart-plus"></i> Nueva Venta</h2>
      <span style="font-size:13px;color:var(--gray-500);">${new Date().toLocaleDateString('es-CO', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</span>
    </div>
    <div class="pos-layout">
      <!-- Panel izquierdo: búsqueda y lista -->
      <div class="pos-left">
        <div class="pos-search">
          <span class="search-icon"><i class="fa-solid fa-magnifying-glass" style="color: rgb(0, 0, 0);"></i></span>
          <input type="text" id="posSearch" class="form-control" 
            placeholder="Buscar por nombre o código... (mín 2 letras)"
            oninput="buscarProductoPOS(this.value)" autocomplete="off">
          <div id="posDropdown" class="search-dropdown"></div>
        </div>
        <div class="venta-items" id="ventaItemsEl">
          <div class="empty-state">
            <span class="empty-icon"><i class="fa-solid fa-cart-plus"></i></span>
            <p>Busca productos para añadir a la venta</p>
          </div>
        </div>
      </div>

      <!-- Panel derecho: resumen -->
      <div class="pos-right">
        <div class="pos-right-header">
          <h3><i class="fa-regular fa-credit-card" style="color: rgb(0, 0, 0);"></i> Resumen de Venta</h3>
        </div>

        <div style="padding:12px 16px;border-bottom:1px solid var(--gray-200);">
          <div class="form-group" style="margin-bottom:8px;">
            <label style="font-size:12px;">Cliente</label>
            <input class="form-control" id="ventaCliente" placeholder="Mostrador / Nombre cliente">
          </div>
        </div>

        <div class="pos-items-list" id="posResumenItems">
          <p style="color:var(--gray-400);font-size:13px;text-align:center;padding:20px 0;">Sin productos</p>
        </div>

        <div style="padding:12px 16px;border-top:1px solid var(--gray-200);">
          <div class="pos-resumen-row">
            <span>Subtotal:</span><span id="posSubtotal">${fmt(0)}</span>
          </div>
          <div class="pos-resumen-row">
            <span>Descuento:</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <input type="number" id="posDescuento" min="0" value="0" 
                style="width:80px;padding:4px 6px;border:1px solid var(--gray-300);border-radius:4px;font-size:13px;"
                oninput="actualizarDescuento(this.value)">
            </div>
          </div>
          <div class="pos-total">
            <span>TOTAL:</span><span id="posTotal">${fmt(0)}</span>
          </div>
        </div>

        <div style="padding:10px 16px;border-top:1px solid var(--gray-200);">
          <div style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:6px;">Método de pago:</div>
          <div class="payment-methods">
            <button class="pay-method-btn selected" onclick="seleccionarPago('efectivo', this)"><i class="fa-solid fa-money-bills" style="color: rgb(0, 0, 0);"></i> Efectivo</button>
            <button class="pay-method-btn" onclick="seleccionarPago('nequi', this)"><i class="fa-solid fa-n" style="color: rgb(0, 0, 0);"></i> Nequi</button>
            <button class="pay-method-btn" onclick="seleccionarPago('transferencia', this)"><i class="fa-solid fa-landmark" style="color: rgb(0, 0, 0);"></i> Transf.</button>
          </div>
          <div id="cambioContainer" style="display:none;background:var(--success-light);padding:8px 10px;border-radius:6px;font-size:13px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <span>Recibido:</span>
              <input type="number" id="efectivoRecibido" min="0" 
                style="width:100px;border:1.5px solid var(--success);background:#fff;text-align:right;font-weight:700;font-size:14px;padding:6px 8px;border-radius:4px;"
                oninput="calcularCambio(this.value)" placeholder="0">
            </div>
            <div style="display:flex;justify-content:space-between;font-weight:700;color:var(--success);margin-top:6px;">
              <span>Cambio:</span><span id="cambioValor">${fmt(0)}</span>
            </div>
          </div>
        </div>

        <div class="pos-footer">
          <button class="btn btn-primary btn-full btn-lg" id="btnCompletarVenta" 
            onclick="completarVenta()" disabled>
            <i class="fa-solid fa-square-check" style="color: rgb(0, 0, 0);"></i> Completar Venta
          </button>
          <button class="btn btn-secondary btn-full" onclick="limpiarVenta()">
            🗑️ Limpiar
          </button>
        </div>
      </div>
    </div>
  `;
  // Inicializar el método de pago por defecto
  setTimeout(() => {
    const btnEfectivo = document.querySelector('.pay-method-btn.selected');
    if (btnEfectivo) {
      seleccionarPago('efectivo', btnEfectivo);
    }
  }, 0);
}

function buscarProductoPOS(q) {
  const dropdown = document.getElementById('posDropdown');
  if (!q || q.length < 2) { dropdown.classList.remove('open'); return; }
  const ql = q.toLowerCase();
  const resultados = productosCache.filter(p =>
    p.nombre.toLowerCase().includes(ql) || p.codigo.toLowerCase().includes(ql)
  ).slice(0, 10);

  if (!resultados.length) {
    dropdown.innerHTML = `<div class="search-item"><span class="search-item-name">Sin resultados para "${q}"</span></div>`;
    dropdown.classList.add('open');
    return;
  }

  dropdown.innerHTML = resultados.map(p => `
    <div class="search-item" onclick="agregarItemVenta(${p.id})">
      <div>
        <div class="search-item-name">${p.nombre}</div>
        <div class="search-item-sub">
          <span class="td-code">${p.codigo}</span> · 
          <span class="${p.stock <= 0 ? 'search-item-stock-low' : ''}">
            Stock: ${p.stock} ${p.unidad_medida || ''}
          </span>
          ${p.stock <= 0 ? ' · <strong style="color:var(--danger);">AGOTADO</strong>' : ''}
        </div>
      </div>
      <div class="search-item-price">${fmt(p.precio_venta)}</div>
    </div>
  `).join('');
  dropdown.classList.add('open');
}

function agregarItemVenta(productoId) {
  document.getElementById('posDropdown').classList.remove('open');
  document.getElementById('posSearch').value = '';

  const prod = productosCache.find(p => p.id === productoId);
  if (!prod) return;
  if (prod.stock <= 0) { toast('Producto sin stock disponible', 'error'); return; }

  const existe = ventaItems.find(i => i.producto_id === productoId);
  if (existe) {
    if (existe.cantidad >= prod.stock) { toast(`Stock máximo: ${prod.stock} unidades`, 'warning'); return; }
    existe.cantidad++;
  } else {
    ventaItems.push({
      producto_id: prod.id,
      nombre: prod.nombre,
      codigo: prod.codigo,
      precio_unitario: prod.precio_venta,
      cantidad: 1,
      stock_max: prod.stock
    });
  }
  actualizarUIVenta();
}

function actualizarUIVenta() {
  const el = document.getElementById('ventaItemsEl');
  const resEl = document.getElementById('posResumenItems');

  if (!ventaItems.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">🛒</span><p>Busca productos para añadir</p></div>`;
    resEl.innerHTML = `<p style="color:var(--gray-400);font-size:13px;text-align:center;padding:20px 0;">Sin productos</p>`;
    document.getElementById('posSubtotal').textContent = fmt(0);
    document.getElementById('posTotal').textContent = fmt(0);
    document.getElementById('btnCompletarVenta').disabled = true;
    return;
  }

  el.innerHTML = ventaItems.map((item, idx) => `
    <div class="venta-item">
      <div>
        <div class="venta-item-name">${item.nombre}</div>
        <div class="venta-item-code">${item.codigo} · ${fmt(item.precio_unitario)}/u</div>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="cambiarCantidad(${idx}, -1)">−</button>
        <input class="qty-input" type="number" min="1" max="${item.stock_max}" value="${item.cantidad}" 
          onchange="setCantidad(${idx}, this.value)">
        <button class="qty-btn" onclick="cambiarCantidad(${idx}, 1)">+</button>
      </div>
      <div class="venta-item-price">${fmt(item.precio_unitario * item.cantidad)}</div>
      <button class="btn-icon" onclick="quitarItem(${idx})" title="Quitar">✕</button>
    </div>
  `).join('');

  const subtotal = ventaItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const total = Math.max(0, subtotal - ventaDescuento);

  document.getElementById('posSubtotal').textContent = fmt(subtotal);
  document.getElementById('posTotal').textContent = fmt(total);

  resEl.innerHTML = ventaItems.map(i => `
    <div class="pos-resumen-row">
      <span>${i.nombre} (${i.cantidad}x)</span>
      <span>${fmt(i.precio_unitario * i.cantidad)}</span>
    </div>
  `).join('');

  document.getElementById('btnCompletarVenta').disabled = false;
  calcularCambio(document.getElementById('efectivoRecibido')?.value || 0);
}

function cambiarCantidad(idx, delta) {
  const item = ventaItems[idx];
  const nueva = item.cantidad + delta;
  if (nueva < 1) { quitarItem(idx); return; }
  if (nueva > item.stock_max) { toast(`Máximo disponible: ${item.stock_max}`, 'warning'); return; }
  item.cantidad = nueva;
  actualizarUIVenta();
}

function setCantidad(idx, val) {
  const v = parseInt(val) || 1;
  const item = ventaItems[idx];
  if (v > item.stock_max) { toast(`Máximo disponible: ${item.stock_max}`, 'warning'); item.cantidad = item.stock_max; }
  else if (v < 1) item.cantidad = 1;
  else item.cantidad = v;
  actualizarUIVenta();
}

function quitarItem(idx) {
  ventaItems.splice(idx, 1);
  actualizarUIVenta();
}

function limpiarVenta() {
  ventaItems = [];
  ventaDescuento = 0;
  ventaMetodoPago = 'efectivo';
  renderVentas();
}

function actualizarDescuento(val) {
  ventaDescuento = parseFloat(val) || 0;
  actualizarUIVenta();
}

function seleccionarPago(metodo, btn) {
  ventaMetodoPago = metodo;
  document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const cambioContainer = document.getElementById('cambioContainer');
  if (metodo === 'efectivo') {
    cambioContainer.style.display = 'block';
  } else {
    cambioContainer.style.display = 'none';
  }
}

function calcularCambio(recibido) {
  const subtotal = ventaItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const total = Math.max(0, subtotal - ventaDescuento);
  const cambio = (parseFloat(recibido) || 0) - total;
  const el = document.getElementById('cambioValor');
  if (el) {
    el.textContent = fmt(Math.max(0, cambio));
    el.style.color = cambio >= 0 ? 'var(--success)' : 'var(--danger)';
  }
}

async function completarVenta() {
  if (!ventaItems.length) return;
  const btn = document.getElementById('btnCompletarVenta');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Procesando...';

  const subtotal = ventaItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const total = Math.max(0, subtotal - ventaDescuento);

  const payload = {
    cliente: document.getElementById('ventaCliente')?.value?.trim() || 'Mostrador',
    descuento: ventaDescuento,
    metodo_pago: ventaMetodoPago,
    detalles: ventaItems.map(i => ({
      producto_id: i.producto_id,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario
    }))
  };

  try {
    const res = await api('/ventas', { method: 'POST', body: payload });
    const data = await res.json();
    if (res.ok) {
      // Actualizar cache de productos
      await cargarProductosCache();
      // Mostrar ticket
      mostrarTicket(data, payload, total);
      // Reset venta
      ventaItems = [];
      actualizarUIVenta();
      document.getElementById('ventaCliente').value = '';
      toast('Venta registrada exitosamente', 'success');
    } else {
      toast(data.error || 'Error registrando venta', 'error');
      btn.disabled = false;
      btn.textContent = '✅ Completar Venta';
    }
  } catch {
    toast('Error de conexión', 'error');
    btn.disabled = false;
    btn.textContent = '✅ Completar Venta';
  }
}

function mostrarTicket(data, payload, total) {
  const now = new Date();
  const fecha = now.toLocaleDateString('es-CO') + ' ' + now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const negocio = configNegocio.nombre_negocio || 'Ferretería';
  const ciudad = configNegocio.ciudad || '';
  const tel = configNegocio.telefono || '';
  const nit = configNegocio.nit || '';

  document.getElementById('ticketContent').innerHTML = `
    <div class="ticket">
      <div class="ticket-title">${negocio}</div>
      ${ciudad ? `<div class="ticket-sub">${ciudad}</div>` : ''}
      ${tel ? `<div class="ticket-sub">Tel: ${tel}</div>` : ''}
      ${nit ? `<div class="ticket-sub">NIT: ${nit}</div>` : ''}
      <div class="ticket-divider"></div>
      <div class="ticket-row"><span>Venta:</span><span>${data.numero_venta}</span></div>
      <div class="ticket-row"><span>Fecha:</span><span>${fecha}</span></div>
      <div class="ticket-row"><span>Cliente:</span><span>${payload.cliente}</span></div>
      <div class="ticket-row"><span>Vendedor:</span><span>${currentUser.nombre}</span></div>
      <div class="ticket-divider"></div>
      <div style="font-size:11px;margin-bottom:4px;font-weight:700;">ÍTEM · CANT · PRECIO · SUBTOTAL</div>
      ${ventaItems.map(i => `
        <div class="ticket-row" style="font-size:11px;">
          <span style="max-width:120px;overflow:hidden;">${i.nombre}</span>
          <span>${i.cantidad}x${fmt(i.precio_unitario).replace('$','')}</span>
        </div>
        <div style="text-align:right;font-size:11px;">${fmt(i.cantidad*i.precio_unitario)}</div>
      `).join('')}
      <div class="ticket-divider"></div>
      ${payload.descuento > 0 ? `<div class="ticket-row"><span>Descuento:</span><span>-${fmt(payload.descuento)}</span></div>` : ''}
      <div class="ticket-row ticket-total"><span>TOTAL:</span><span>${fmt(total)}</span></div>
      <div class="ticket-row"><span>Pago:</span><span>${payload.metodo_pago}</span></div>
      <div class="ticket-divider"></div>
      <div style="text-align:center;font-size:11px;">¡Gracias por su compra!</div>
    </div>
  `;
  openModal('modalTicket');
}

// ══════════════════════════════════════════════════════════════════════════════
// HISTORIAL DE VENTAS
// ══════════════════════════════════════════════════════════════════════════════
async function renderHistorial() {
  const el = document.getElementById('page-content');
  const hoy = new Date().toISOString().split('T')[0];
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  el.innerHTML = `
    <div class="page-header">
      <h2>📋 Historial de Ventas</h2>
    </div>
    <div class="table-container">
      <div class="table-header">
        <div class="filters">
          <div>
            <label style="font-size:12px;color:var(--gray-500);">Desde</label>
            <input type="date" id="hFechaI" class="form-control" value="${inicioMes}" style="width:150px;">
          </div>
          <div>
            <label style="font-size:12px;color:var(--gray-500);">Hasta</label>
            <input type="date" id="hFechaF" class="form-control" value="${hoy}" style="width:150px;">
          </div>
          <button class="btn btn-primary" onclick="cargarHistorial()">Filtrar</button>
        </div>
        <div id="historialResumen" style="font-size:13px;color:var(--gray-600);"></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Nro. Venta</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Método</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Vendedor</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="historialBody">
          <tr><td colspan="8" class="loading">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
  `;
  cargarHistorial();
}

async function cargarHistorial() {
  const fi = document.getElementById('hFechaI')?.value;
  const ff = document.getElementById('hFechaF')?.value;
  let url = '/ventas?';
  if (fi) url += `fecha_inicio=${fi}&`;
  if (ff) url += `fecha_fin=${ff}`;
  const res = await api(url);
  if (!res || !res.ok) return;
  const ventas = await res.json();

  const total = ventas.filter(v => v.estado !== 'anulada').reduce((s, v) => s + v.total, 0);
  const resEl = document.getElementById('historialResumen');
  if (resEl) resEl.textContent = `${ventas.length} ventas · Total: ${fmt(total)}`;

  const tbody = document.getElementById('historialBody');
  if (!tbody) return;

  tbody.innerHTML = ventas.length ? ventas.map(v => `
    <tr>
      <td><span class="td-code">${v.numero_venta}</span></td>
      <td>${new Date(v.fecha).toLocaleString('es-CO', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
      <td>${v.cliente}</td>
      <td><span class="badge badge-info">${v.metodo_pago || 'efectivo'}</span></td>
      <td><strong>${fmt(v.total)}</strong></td>
      <td><span class="badge ${v.estado === 'anulada' ? 'badge-danger' : 'badge-success'}">${v.estado === 'anulada' ? 'Anulada' : 'Completada'}</span></td>
      <td>${v.vendedor || '-'}</td>
      <td>
        <div class="action-cell">
          <button class="btn btn-secondary btn-sm" onclick="verDetalleVenta(${v.id}, '${v.numero_venta}')">👁 Ver</button>
          ${currentUser.rol === 'admin' && v.estado !== 'anulada' ? `<button class="btn btn-danger btn-sm" onclick="anularVenta(${v.id})">✕ Anular</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="8"><div class="empty-state"><span class="empty-icon">📋</span><p>Sin ventas en el período</p></div></td></tr>`;
}

async function verDetalleVenta(id, numero) {
  const res = await api(`/ventas/${id}/detalles`);
  if (!res || !res.ok) return;
  const detalles = await res.json();
  const total = detalles.reduce((s, d) => s + d.subtotal, 0);

  document.getElementById('detalleVentaTitle').textContent = `Venta ${numero}`;
  document.getElementById('detalleVentaBody').innerHTML = `
    <table>
      <thead><tr><th>Producto</th><th>Código</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
      <tbody>
        ${detalles.map(d => `
          <tr>
            <td>${d.nombre_producto || d.nombre}</td>
            <td><span class="td-code">${d.codigo}</span></td>
            <td>${d.cantidad}</td>
            <td>${fmt(d.precio_unitario)}</td>
            <td>${fmt(d.subtotal)}</td>
          </tr>
        `).join('')}
        <tr style="font-weight:700;background:var(--gray-50);">
          <td colspan="4" style="text-align:right;">TOTAL:</td>
          <td>${fmt(total)}</td>
        </tr>
      </tbody>
    </table>
  `;
  openModal('modalDetalleVenta');
}

async function anularVenta(id) {
  if (!confirm('¿Anular esta venta? El stock será restaurado.')) return;
  const res = await api(`/ventas/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (res.ok) {
    toast(data.mensaje, 'success');
    await cargarProductosCache();
    cargarHistorial();
  } else {
    toast(data.error || 'Error anulando venta', 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PRODUCTOS
// ══════════════════════════════════════════════════════════════════════════════
function renderProductos() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-box-open"></i> Gestión de Productos</h2>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary" onclick="openModal('modalCategoria')">+ Categoría</button>
        <button class="btn btn-primary" onclick="openNuevoProducto()">+ Nuevo Producto</button>
      </div>
    </div>
    <div class="table-container">
      <div class="table-header">
        <div class="filters">
          <div class="search-input" style="min-width:220px;">
            <input type="text" id="buscarProducto" class="form-control" 
              placeholder="Buscar por nombre o código..."
              oninput="filtrarProductos()">
          </div>
          <select id="filtroCat" class="form-control" style="width:180px;" onchange="filtrarProductos()">
            <option value="">Todas las categorías</option>
            ${categoriasCache.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
          </select>
          <select id="filtroStock" class="form-control" style="width:150px;" onchange="filtrarProductos()">
            <option value="">Todo el stock</option>
            <option value="bajo">Bajo stock</option>
          </select>
        </div>
        <span id="productosCount" style="font-size:13px;color:var(--gray-500);"></span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Stock</th>
            <th>P. Compra</th>
            <th>P. Venta</th>
            <th>Margen</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="productosBody">
          <tr><td colspan="8" class="loading">Cargando productos...</td></tr>
        </tbody>
      </table>
    </div>
  `;
  filtrarProductos();
}

function filtrarProductos() {
  const buscar = document.getElementById('buscarProducto')?.value?.toLowerCase() || '';
  const cat = document.getElementById('filtroCat')?.value;
  const stock = document.getElementById('filtroStock')?.value;

  let filtrados = productosCache.filter(p => {
    const coincideTexto = p.nombre.toLowerCase().includes(buscar) || p.codigo.toLowerCase().includes(buscar);
    const pCatId = p.categoria?._id || p.categoria;
    const coincideCat = !cat || pCatId == cat;
    const coincideStock = !stock || (stock === 'bajo' && p.stock <= p.stock_minimo);
    return coincideTexto && coincideCat && coincideStock;
  });

  const countEl = document.getElementById('productosCount');
  if (countEl) countEl.textContent = `${filtrados.length} productos`;

  const tbody = document.getElementById('productosBody');
  if (!tbody) return;

  tbody.innerHTML = filtrados.length ? filtrados.map(p => {
    const margen = p.precio_compra > 0 ? ((p.precio_venta - p.precio_compra) / p.precio_compra * 100).toFixed(0) : '-';
    const stockClass = p.stock <= 0 ? 'badge-danger' : p.stock <= p.stock_minimo ? 'badge-warning' : 'badge-success';
    return `
      <tr>
        <td><span class="td-code">${p.codigo}</span></td>
        <td><strong>${p.nombre}</strong>${p.descripcion ? `<br><small style="color:var(--gray-500);">${p.descripcion.substring(0,40)}</small>` : ''}</td>
        <td>${(p.categoria && p.categoria.nombre) ? p.categoria.nombre : '<span style="color:var(--gray-400)">Sin categoría</span>'}</td>
        <td>
          <span class="badge ${stockClass}">${p.stock} ${p.unidad_medida || ''}</span>
          <small style="color:var(--gray-400);display:block;font-size:11px;">mín: ${p.stock_minimo}</small>
        </td>
        <td>${p.precio_compra ? fmt(p.precio_compra) : '-'}</td>
        <td><strong>${fmt(p.precio_venta)}</strong></td>
        <td>${margen !== '-' ? `<span style="color:${margen > 20 ? 'var(--success)' : 'var(--warning)'};">${margen}%</span>` : '-'}</td>
        <td>
          <div class="action-cell">
            <button class="btn btn-secondary btn-sm" onclick="editarProducto('${p._id}')"> Editar</button>
            ${currentUser.rol === 'admin' ? `<button class="btn btn-danger btn-sm" onclick="eliminarProducto('${p._id}')">Eliminar</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="8"><div class="empty-state"><span class="empty-icon">📦</span><p>Sin productos</p></div></td></tr>`;
}

function openNuevoProducto() {
  document.getElementById('productoEditId').value = '';
  document.getElementById('modalProductoTitle').textContent = 'Nuevo Producto';
  document.getElementById('pCodigo').value = '';
  document.getElementById('pNombre').value = '';
  document.getElementById('pDescripcion').value = '';
  document.getElementById('pCategoria').value = '';
  document.getElementById('pProveedor').value = '';
  document.getElementById('pUnidad').value = 'Unidad';
  document.getElementById('pPrecioCompra').value = '';
  document.getElementById('pPrecioVenta').value = '';
  document.getElementById('pStockMinimo').value = '5';
  document.getElementById('pStockInicial').value = '0';
  document.getElementById('stockInicialGroup').style.display = 'block';
  llenarSelectsProducto();
  openModal('modalProducto');
  document.getElementById('pPrecioCompra').oninput = calcularMargenProducto;
  document.getElementById('pPrecioVenta').oninput = calcularMargenProducto;
}

function llenarSelectsProducto() {
  document.getElementById('pCategoria').innerHTML = '<option value="">Sin categoría</option>' +
    categoriasCache.map(c => `<option value="${c._id}">${c.nombre}</option>`).join('');
  document.getElementById('pProveedor').innerHTML = '<option value="">Sin proveedor</option>' +
    proveedoresCache.map(p => `<option value="${p._id}">${p.nombre}</option>`).join('');
}

function calcularMargenProducto() {
  const pc = parseFloat(document.getElementById('pPrecioCompra').value) || 0;
  const pv = parseFloat(document.getElementById('pPrecioVenta').value) || 0;
  const margenEl = document.getElementById('pMargen');
  if (pc > 0 && pv > 0) {
    const margen = ((pv - pc) / pc * 100).toFixed(1);
    document.getElementById('pMargenValor').textContent = `${margen}% (ganancia: ${fmt(pv - pc)})`;
    margenEl.style.display = 'block';
    margenEl.style.color = margen > 20 ? 'var(--success)' : margen > 0 ? 'var(--warning)' : 'var(--danger)';
  } else {
    margenEl.style.display = 'none';
  }
}

async function editarProducto(id) {
  const prod = productosCache.find(p => p._id === id);
  if (!prod) return;
  llenarSelectsProducto();
  document.getElementById('productoEditId').value = id;
  document.getElementById('modalProductoTitle').textContent = 'Editar Producto';
  document.getElementById('pCodigo').value = prod.codigo;
  document.getElementById('pCodigo').disabled = true;
  document.getElementById('pNombre').value = prod.nombre;
  document.getElementById('pDescripcion').value = prod.descripcion || '';
  document.getElementById('pCategoria').value = prod.categoria?._id || prod.categoria || '';
  document.getElementById('pProveedor').value = prod.proveedor?._id || prod.proveedor || '';
  document.getElementById('pUnidad').value = prod.unidad_medida || 'Unidad';
  document.getElementById('pPrecioCompra').value = prod.precio_compra || '';
  document.getElementById('pPrecioVenta').value = prod.precio_venta;
  document.getElementById('pStockMinimo').value = prod.stock_minimo;
  document.getElementById('stockInicialGroup').style.display = 'none';
  document.getElementById('pMargen').style.display = 'none';
  document.getElementById('pPrecioCompra').oninput = calcularMargenProducto;
  document.getElementById('pPrecioVenta').oninput = calcularMargenProducto;
  calcularMargenProducto();
  openModal('modalProducto');
}

async function guardarProducto() {
  const id = document.getElementById('productoEditId').value;
  const payload = {
    codigo: document.getElementById('pCodigo').value.trim().toUpperCase(),
    nombre: document.getElementById('pNombre').value.trim(),
    descripcion: document.getElementById('pDescripcion').value.trim(),
    categoria_id: document.getElementById('pCategoria').value || null,
    proveedor_id: document.getElementById('pProveedor').value || null,
    unidad_medida: document.getElementById('pUnidad').value,
    precio_compra: parseFloat(document.getElementById('pPrecioCompra').value) || 0,
    precio_venta: parseFloat(document.getElementById('pPrecioVenta').value) || 0,
    stock: parseInt(document.getElementById('pStockInicial')?.value) || 0,
    stock_minimo: parseInt(document.getElementById('pStockMinimo').value) || 5
  };

  if (!payload.nombre || !payload.precio_venta) {
    toast('Nombre y precio de venta son requeridos', 'error'); return;
  }
  if (!id && !payload.codigo) {
    toast('El código es requerido', 'error'); return;
  }

  const method = id ? 'PUT' : 'POST';
  const url = id ? `/productos/${id}` : '/productos';
  const res = await api(url, { method, body: payload });
  const data = await res.json();

  if (res.ok) {
    toast(data.message || 'Operación exitosa', 'success');
    closeModal('modalProducto');
    document.getElementById('pCodigo').disabled = false;
    await cargarProductosCache();
    filtrarProductos();
  } else {
    toast(data.error || 'Error guardando producto', 'error');
  }
}

async function eliminarProducto(id) {
  const prod = productosCache.find(p => p._id === id);
  if (!confirm(`¿Eliminar "${prod?.nombre}"?`)) return;
  const res = await api(`/productos/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (res.ok) {
    toast(data.message, 'success');
    await cargarProductosCache();
    filtrarProductos();
  } else {
    toast(data.error, 'error');
  }
}

async function guardarCategoria() {
  const nombre = document.getElementById('catNombre').value.trim();
  const descripcion = document.getElementById('catDescripcion').value.trim();
  if (!nombre) { toast('El nombre es requerido', 'error'); return; }
  const res = await api('/categorias', { method: 'POST', body: { nombre, descripcion } });
  const data = await res.json();
  if (res.ok) {
    toast('Categoría creada', 'success');
    closeModal('modalCategoria');
    document.getElementById('catNombre').value = '';
    document.getElementById('catDescripcion').value = '';
    await cargarCategoriasCache();
  } else {
    toast(data.error, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// INVENTARIO
// ══════════════════════════════════════════════════════════════════════════════
async function renderInventario() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-square-poll-vertical"></i> Control de Inventario</h2>
      <button class="btn btn-primary" onclick="openModal('modalMovimiento');resetMovForm()">+ Registrar Movimiento</button>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="showTab('tabAlertas', this)">Alertas Stock</button>
      <button class="tab-btn" onclick="showTab('tabMovimientos', this)">Movimientos</button>
      <button class="tab-btn" onclick="showTab('tabInventarioCompleto', this)">Inventario Completo</button>
    </div>

    <div id="tabAlertas" class="tab-content active">
      <div id="alertasContent" class="loading">Cargando...</div>
    </div>

    <div id="tabMovimientos" class="tab-content">
      <div class="table-container">
        <div id="movimientosContent" class="loading">Cargando...</div>
      </div>
    </div>

    <div id="tabInventarioCompleto" class="tab-content">
      <div id="inventarioCompletoContent" class="loading">Cargando...</div>
    </div>
  `;

  cargarAlertas();
}

async function cargarAlertas() {
  const res = await api('/dashboard');
  if (!res || !res.ok) return;
  const d = await res.json();
  const el = document.getElementById('alertasContent');
  if (!el) return;

  el.innerHTML = d.alertas_stock?.length ? `
    <div class="stock-alert-list">
      ${d.alertas_stock.map(p => `
        <div class="stock-alert-item ${p.stock < 2 ? '' : 'warning'}">
          <div>
            <div class="stock-alert-name">${p.nombre}</div>
            <div class="stock-alert-code">${p.codigo}</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="stock-alert-nums">
              Stock: <strong style="color:${p.stock < 2 ? 'var(--danger)' : 'var(--warning)'};">${p.stock}</strong><br>
              Mínimo: ${p.stock_minimo}
            </div>
            <button class="btn btn-primary btn-sm" onclick="abrirMovParaProducto(${p._id}, '${p.nombre}')">📥 Entrada</button>
          </div>
        </div>
      `).join('')}
    </div>
  ` : `<div class="empty-state"><span class="empty-icon"><i class="fa-solid fa-circle-check" style="color: rgb(0, 0, 0);"></i></span><p>¡Sin alertas! Todo el inventario está en niveles normales.</p></div>`;
}

async function cargarMovimientos() {
  const res = await api('/movimientos');
  if (!res || !res.ok) return;
  const movs = await res.json();
  const el = document.getElementById('movimientosContent');
  if (!el) return;

  el.innerHTML = `
    <table>
      <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Referencia</th><th>Usuario</th></tr></thead>
      <tbody>
        ${movs.length ? movs.map(m => `
          <tr>
            <td>${new Date(m.fecha).toLocaleString('es-CO', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
            <td><strong>${m.producto_nombre}</strong><br><span class="td-code">${m.codigo}</span></td>
            <td>
              <span class="badge ${m.tipo === 'ENTRADA' || m.tipo === 'AJUSTE_POSITIVO' ? 'badge-success' : m.tipo === 'VENTA' ? 'badge-info' : 'badge-danger'}">
                ${m.tipo}
              </span>
            </td>
            <td><strong>${m.tipo === 'VENTA' ? '-' : ''}${Math.abs(m.cantidad)}</strong></td>
            <td>${m.referencia || '-'}</td>
            <td>${m.usuario_nombre || '-'}</td>
          </tr>
        `).join('') : `<tr><td colspan="6"><div class="empty-state"><p>Sin movimientos registrados</p></div></td></tr>`}
      </tbody>
    </table>
  `;
}

async function cargarInventarioCompleto() {
  const res = await api('/reportes/inventario');
  if (!res || !res.ok) return;
  const rows = await res.json();
  const valorTotal = rows.reduce((s, r) => s + (r.valor_inventario || 0), 0);
  const el = document.getElementById('inventarioCompletoContent');
  if (!el) return;

  el.innerHTML = `
    <div style="margin-bottom:12px;padding:12px 16px;background:var(--info-light);border-radius:var(--radius);font-size:13px;">
      <strong>Valor total del inventario:</strong> ${fmt(valorTotal)} (precio de compra)
    </div>
    <table>
      <thead>
        <tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>Stock</th><th>Estado</th><th>P. Compra</th><th>P. Venta</th><th>Valor</th></tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td><span class="td-code">${r.codigo}</span></td>
            <td>${r.nombre}</td>
            <td>${r.categoria || '-'}</td>
            <td>${r.stock} ${r.unidad_medida || ''}</td>
            <td><span class="badge ${r.estado_stock === 'Agotado' ? 'badge-danger' : r.estado_stock === 'Bajo' ? 'badge-warning' : 'badge-success'}">${r.estado_stock}</span></td>
            <td>${r.precio_compra ? fmt(r.precio_compra) : '-'}</td>
            <td>${fmt(r.precio_venta)}</td>
            <td>${r.precio_compra ? fmt(r.valor_inventario) : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function showTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');

  if (id === 'tabMovimientos') cargarMovimientos();
  if (id === 'tabInventarioCompleto') cargarInventarioCompleto();
}

function resetMovForm() {
  document.getElementById('movProductoId').value = '';
  document.getElementById('movProductoBuscar').value = '';
  document.getElementById('movProductoInfo').style.display = 'none';
  document.getElementById('movDropdown').innerHTML = '';
  document.getElementById('movDropdown').classList.remove('open');
  document.getElementById('movTipo').value = 'ENTRADA';
  document.getElementById('movCantidad').value = '1';
  document.getElementById('movReferencia').value = '';
  document.getElementById('movNotas').value = '';
}

function buscarProductoMov(q) {
  const dropdown = document.getElementById('movDropdown');
  if (!q || q.length < 2) { dropdown.classList.remove('open'); return; }
  const ql = q.toLowerCase();
  const resultados = productosCache.filter(p =>
    p.nombre.toLowerCase().includes(ql) || p.codigo.toLowerCase().includes(ql)
  ).slice(0, 8);

  dropdown.innerHTML = resultados.map(p => `
    <div class="search-item" onclick="seleccionarProductoMov('${p._id}')">
      <div>
        <div class="search-item-name">${p.nombre}</div>
        <div class="search-item-sub">${p.codigo} · Stock: ${p.stock}</div>
      </div>
    </div>
  `).join('') || `<div class="search-item">Sin resultados</div>`;
  dropdown.classList.add('open');
}

function seleccionarProductoMov(id) {
  const prod = productosCache.find(p => p._id === id);
  if (!prod) return;
  document.getElementById('movProductoId').value = id;
  document.getElementById('movProductoBuscar').value = prod.nombre;
  document.getElementById('movDropdown').classList.remove('open');
  const infoEl = document.getElementById('movProductoInfo');
  infoEl.textContent = `Stock actual: ${prod.stock} ${prod.unidad_medida || ''}`;
  infoEl.style.display = 'block';
}

function abrirMovParaProducto(id, nombre) {
  resetMovForm();
  document.getElementById('movProductoId').value = id;
  document.getElementById('movProductoBuscar').value = nombre;
  document.getElementById('movTipo').value = 'ENTRADA';
  const prod = productosCache.find(p => p._id === id);
  if (prod) {
    const infoEl = document.getElementById('movProductoInfo');
    infoEl.textContent = `Stock actual: ${prod.stock} ${prod.unidad_medida || ''}`;
    infoEl.style.display = 'block';
  }
  openModal('modalMovimiento');
}

async function registrarMovimiento() {
  const prod_id = document.getElementById('movProductoId').value;
  const tipo = document.getElementById('movTipo').value;
  const cantidad = parseInt(document.getElementById('movCantidad').value);
  const referencia = document.getElementById('movReferencia').value.trim();
  const notas = document.getElementById('movNotas').value.trim();

  if (!prod_id) { toast('Selecciona un producto', 'error'); return; }
  if (!cantidad || cantidad < 1) { toast('La cantidad debe ser mayor a 0', 'error'); return; }

  const res = await api('/movimientos', { method: 'POST', body: { producto_id: prod_id, tipo, cantidad, referencia, notas } });
  const data = await res.json();
  if (res.ok) {
    toast(`Movimiento registrado. Nuevo stock: ${data.nuevo_stock}`, 'success');
    closeModal('modalMovimiento');
    await cargarProductosCache();
    cargarAlertas();
    filtrarProductos();
  } else {
    toast(data.error, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PROVEEDORES
// ══════════════════════════════════════════════════════════════════════════════
function renderProveedores() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="page-header">
      <h2><i class="fa-solid fa-building"></i> Proveedores</h2>
      <button class="btn btn-primary" onclick="openNuevoProveedor()">+ Nuevo Proveedor</button>
    </div>
    <div class="table-container">
      <div class="table-header">
        <div class="search-input">
          <input type="text" class="form-control" placeholder="Buscar proveedor..." 
            oninput="filtrarProveedores(this.value)">
        </div>
      </div>
      <table>
        <thead>
          <tr><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>WhatsApp</th><th>Ciudad</th><th>Email</th><th>Acciones</th></tr>
        </thead>
        <tbody id="proveedoresBody">
          <tr><td colspan="7" class="loading">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
  `;
  mostrarProveedores(proveedoresCache);
}

function filtrarProveedores(q) {
  const ql = (q || '').toLowerCase();
  mostrarProveedores(proveedoresCache.filter(p => p.nombre.toLowerCase().includes(ql)));
}

function mostrarProveedores(lista) {
  const tbody = document.getElementById('proveedoresBody');
  if (!tbody) return;
  tbody.innerHTML = lista.length ? lista.map(p => `
    <tr>
      <td><strong>${p.nombre}</strong></td>
      <td>${p.contacto || '-'}</td>
      <td>${p.telefono || '-'}</td>
      <td>${p.whatsapp ? `<a href="https://wa.me/57${p.whatsapp.replace(/\D/g,'')}" target="_blank" style="color:var(--success);"> ${p.whatsapp}</a>` : '-'}</td>
      <td>${p.ciudad || '-'}</td>
      <td>${p.email ? `<a href="mailto:${p.email}">${p.email}</a>` : '-'}</td>
      <td>
        <div class="action-cell">
          <button class="btn btn-secondary btn-sm" onclick="editarProveedor('${p._id}')">Editar</button>
          ${currentUser.rol === 'admin' ? `<button class="btn btn-danger btn-sm" onclick="eliminarProveedor('${p._id}')">Eliminar</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="7"><div class="empty-state"><span class="empty-icon"><i class="fa-solid fa-building"></i></span><p>Sin proveedores</p></div></td></tr>`;
}

function openNuevoProveedor() {
  document.getElementById('proveedorEditId').value = '';
  document.getElementById('modalProveedorTitle').textContent = 'Nuevo Proveedor';
  ['provNombre','provTelefono','provWhatsapp','provEmail','provContacto','provCiudad','provDireccion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  openModal('modalProveedor');
}

function editarProveedor(id) {
  const prov = proveedoresCache.find(p => p._id === id);
  if (!prov) return;
  document.getElementById('proveedorEditId').value = id;
  document.getElementById('modalProveedorTitle').textContent = 'Editar Proveedor';
  document.getElementById('provNombre').value = prov.nombre;
  document.getElementById('provTelefono').value = prov.telefono || '';
  document.getElementById('provWhatsapp').value = prov.whatsapp || '';
  document.getElementById('provEmail').value = prov.email || '';
  document.getElementById('provContacto').value = prov.contacto || '';
  document.getElementById('provCiudad').value = prov.ciudad || '';
  document.getElementById('provDireccion').value = prov.direccion || '';
  openModal('modalProveedor');
}

async function guardarProveedor() {
  const id = document.getElementById('proveedorEditId').value;
  const payload = {
    nombre: document.getElementById('provNombre').value.trim(),
    telefono: document.getElementById('provTelefono').value.trim(),
    whatsapp: document.getElementById('provWhatsapp').value.trim(),
    email: document.getElementById('provEmail').value.trim(),
    contacto: document.getElementById('provContacto').value.trim(),
    ciudad: document.getElementById('provCiudad').value.trim(),
    direccion: document.getElementById('provDireccion').value.trim()
  };
  if (!payload.nombre) { toast('Nombre requerido', 'error'); return; }

  const method = id ? 'PUT' : 'POST';
  const url = id ? `/proveedores/${id}` : '/proveedores';
  const res = await api(url, { method, body: payload });
  const data = await res.json();
  if (res.ok) {
    toast(data.message, 'success');
    closeModal('modalProveedor');
    await cargarProveedoresCache();
    mostrarProveedores(proveedoresCache);
  } else {
    toast(data.error, 'error');
  }
}

async function eliminarProveedor(id) {
  const prov = proveedoresCache.find(p => p._id === id);
  if (!confirm(`¿Eliminar "${prov?.nombre}"?`)) return;
  const res = await api(`/proveedores/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (res.ok) {
    toast(data.message, 'success');
    await cargarProveedoresCache();
    mostrarProveedores(proveedoresCache);
  } else {
    toast(data.error, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// REPORTES
// ══════════════════════════════════════════════════════════════════════════════
async function renderReportes() {
  const el = document.getElementById('page-content');
  const hoy = new Date().toISOString().split('T')[0];
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  el.innerHTML = `
    <div class="page-header">
      <h2>📄 Reportes y Estadísticas</h2>
    </div>
    <div class="card" style="margin-bottom:16px;">
      <div class="card-body">
        <div class="filters">
          <div>
            <label style="font-size:12px;">Desde</label>
            <input type="date" id="repFechaI" class="form-control" value="${inicioMes}" style="width:150px;">
          </div>
          <div>
            <label style="font-size:12px;">Hasta</label>
            <input type="date" id="repFechaF" class="form-control" value="${hoy}" style="width:150px;">
          </div>
          <button class="btn btn-primary" onclick="cargarReportes()">📊 Generar Reporte</button>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="showTabReportes('repVentasDia', this)">Ventas por Día</button>
      <button class="tab-btn" onclick="showTabReportes('repProductos', this)">Productos Vendidos</button>
    </div>

    <div id="repVentasDia" class="tab-content active">
      <div id="ventasDiaContent" class="loading">Cargando...</div>
    </div>
    <div id="repProductos" class="tab-content">
      <div id="productosVendidosContent" class="loading">Cargando...</div>
    </div>
  `;
  cargarReportes();
}

function showTabReportes(id, btn) {
  document.querySelectorAll('#page-content .tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#page-content .tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');
}

async function cargarReportes() {
  const fi = document.getElementById('repFechaI')?.value;
  const ff = document.getElementById('repFechaF')?.value;
  const params = `fecha_inicio=${fi}&fecha_fin=${ff}`;

  const [resVentas, resProd] = await Promise.all([
    api(`/reportes/ventas-por-dia?${params}`),
    api(`/reportes/productos-vendidos?${params}`)
  ]);

  if (resVentas?.ok) {
    const ventas = await resVentas.json();
    const totalVentas = ventas.reduce((s, v) => s + v.total, 0);
    const totalTxs = ventas.reduce((s, v) => s + v.num_ventas, 0);
    const elV = document.getElementById('ventasDiaContent');
    if (elV) elV.innerHTML = `
      <div style="display:flex;gap:12px;margin-bottom:12px;">
        <div class="stat-card" style="flex:1;">
          <div class="stat-icon" style="background:var(--success-light);"><i class="fa-solid fa-wallet" style="color: rgb(0, 0, 0);"></i></div>
          <div class="stat-info"><div class="stat-label">Total Período</div><div class="stat-value success">${fmt(totalVentas)}</div></div>
        </div>
        <div class="stat-card" style="flex:1;">
          <div class="stat-icon" style="background:var(--info-light);"><i class="fa-solid fa-receipt" style="color: rgb(0, 0, 0);"></i></div>
          <div class="stat-info"><div class="stat-label">Transacciones</div><div class="stat-value">${totalTxs}</div></div>
        </div>
        <div class="stat-card" style="flex:1;">
          <div class="stat-icon" style="background:var(--primary-light);">📅</div>
          <div class="stat-info"><div class="stat-label">Promedio/Día</div><div class="stat-value">${ventas.length ? fmt(totalVentas / ventas.length) : fmt(0)}</div></div>
        </div>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Fecha</th><th>No. Ventas</th><th>Total</th></tr></thead>
          <tbody>
            ${ventas.length ? ventas.map(v => `
              <tr>
                <td>${new Date(v.dia + 'T12:00:00').toLocaleDateString('es-CO', {weekday:'long', day:'numeric', month:'long'})}</td>
                <td>${v.num_ventas} ventas</td>
                <td><strong>${fmt(v.total)}</strong></td>
              </tr>
            `).join('') : `<tr><td colspan="3"><div class="empty-state"><p>Sin ventas en el período</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  if (resProd?.ok) {
    const prods = await resProd.json();
    const elP = document.getElementById('productosVendidosContent');
    if (elP) elP.innerHTML = `
      <div class="table-container">
        <table>
          <thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Und. Vendidas</th><th>Total Ingresos</th></tr></thead>
          <tbody>
            ${prods.length ? prods.map(p => `
              <tr>
                <td><span class="td-code">${p.codigo}</span></td>
                <td>${p.nombre}</td>
                <td>${p.categoria || '-'}</td>
                <td>${p.total_vendido}</td>
                <td><strong>${fmt(p.total_ingresos)}</strong></td>
              </tr>
            `).join('') : `<tr><td colspan="5"><div class="empty-state"><p>Sin ventas en el período</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMINISTRACIÓN
// ══════════════════════════════════════════════════════════════════════════════
async function renderAdmin() {
  if (currentUser.rol !== 'admin') { toast('Acceso restringido', 'error'); loadPage('dashboard'); return; }
  const el = document.getElementById('page-content');

  const [resUsers, resConfig] = await Promise.all([api('/usuarios'), api('/config')]);
  const usuarios = resUsers?.ok ? await resUsers.json() : [];
  const config = resConfig?.ok ? await resConfig.json() : {};

  el.innerHTML = `
    <div class="page-header"><h2>⚙️ Administración</h2></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <!-- Config negocio -->
      <div class="card">
        <div class="card-header"><h3>🏪 Datos del Negocio</h3></div>
        <div class="card-body">
          <div class="form-group">
            <label>Nombre del Negocio</label>
            <input class="form-control" id="cfgNombre" value="${config.nombre_negocio || ''}">
          </div>
          <div class="form-group">
            <label>Ciudad</label>
            <input class="form-control" id="cfgCiudad" value="${config.ciudad || ''}">
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input class="form-control" id="cfgTel" value="${config.telefono || ''}">
          </div>
          <div class="form-group">
            <label>NIT / Cédula</label>
            <input class="form-control" id="cfgNit" value="${config.nit || ''}">
          </div>
          <button class="btn btn-primary" onclick="guardarConfig()">💾 Guardar Configuración</button>
        </div>
      </div>

      <!-- Usuarios -->
      <div class="card">
        <div class="card-header">
          <h3>👥 Usuarios del Sistema</h3>
          <button class="btn btn-primary btn-sm" onclick="openModalNuevoUsuario()">+ Usuario</button>
        </div>
        <div class="card-body">
          ${usuarios.map(u => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--gray-100);">
              <div>
                <div style="font-weight:600;font-size:13.5px;">${u.nombre}</div>
                <div style="font-size:12px;color:var(--gray-500);">${u.email}</div>
              </div>
              <span class="badge ${u.rol === 'admin' ? 'badge-warning' : 'badge-info'}">${u.rol}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Modal nuevo usuario embebido -->
    <div id="modalNuevoUsuario" class="modal-overlay">
      <div class="modal-box" style="max-width:400px;">
        <div class="modal-head">
          <h2>Nuevo Usuario</h2>
          <button class="close-btn" onclick="closeModal('modalNuevoUsuario')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nombre *</label>
            <input class="form-control" id="nuNombre" placeholder="Nombre completo">
          </div>
          <div class="form-group">
            <label>Email *</label>
            <input class="form-control" type="email" id="nuEmail" placeholder="correo@ejemplo.com">
          </div>
          <div class="form-group">
            <label>Contraseña *</label>
            <input class="form-control" type="password" id="nuPassword" placeholder="Mínimo 6 caracteres">
          </div>
          <div class="form-group">
            <label>Rol</label>
            <select class="form-control" id="nuRol">
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary" onclick="closeModal('modalNuevoUsuario')">Cancelar</button>
          <button class="btn btn-primary" onclick="crearUsuario()">Crear Usuario</button>
        </div>
      </div>
    </div>
  `;
}

function openModalNuevoUsuario() { openModal('modalNuevoUsuario'); }

async function crearUsuario() {
  const payload = {
    nombre: document.getElementById('nuNombre').value.trim(),
    email: document.getElementById('nuEmail').value.trim(),
    password: document.getElementById('nuPassword').value,
    rol: document.getElementById('nuRol').value
  };
  if (!payload.nombre || !payload.email || !payload.password) { toast('Todos los campos son requeridos', 'error'); return; }
  const res = await api('/usuarios', { method: 'POST', body: payload });
  const data = await res.json();
  if (res.ok) {
    toast('Usuario creado', 'success');
    closeModal('modalNuevoUsuario');
    renderAdmin();
  } else {
    toast(data.error, 'error');
  }
}

async function guardarConfig() {
  const payload = {
    nombre_negocio: document.getElementById('cfgNombre').value.trim(),
    ciudad: document.getElementById('cfgCiudad').value.trim(),
    telefono: document.getElementById('cfgTel').value.trim(),
    nit: document.getElementById('cfgNit').value.trim()
  };
  const res = await api('/config', { method: 'PUT', body: payload });
  const data = await res.json();
  if (res.ok) {
    toast('Configuración guardada', 'success');
    await cargarConfig();
  } else {
    toast(data.error, 'error');
  }
}

// ── LÓGICA DE NAVEGACIÓN MÓVIL ──────────────────────────

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

// Modificamos la función loadPage existente para que cierre el menú en móviles
const originalLoadPage = loadPage;
loadPage = function(page) {
  originalLoadPage(page);
  
  // Si estamos en móvil, cerramos el sidebar tras clickear
  if (window.innerWidth <= 992) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar.classList.contains('open')) {
      toggleSidebar();
    }
  }
  
  // Scroll al inicio de la página
  window.scrollTo(0, 0);
};

// Sincronizar el avatar del móvil con el del usuario
// Añade esto dentro de iniciarApp()
function sincronizarAvatares() {
    const mobileAvatar = document.getElementById('userAvatarMobile');
    if (mobileAvatar) {
        mobileAvatar.textContent = (currentUser.nombre || 'U').charAt(0).toUpperCase();
    }
}
