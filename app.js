// ============================================================
//  CBA Inventory · app.js
//  Incluye: Auth Supabase, Modo Oscuro, CRUD Productos/Proveedores
// ============================================================

const SUPABASE_URL = 'https://tjvbloddkcmpjbpbqejo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Y7guvU793hHGEsnZN16UeA_h-rfbsrw';

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables globales
let productos = [];
let proveedores = [];
let productosFiltrados = [];
let currentUser = null;

// ============================================================
//  INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    await checkSession();
});

// ============================================================
//  MODO OSCURO
// ============================================================
function initTheme() {
    const saved = localStorage.getItem('cba_theme') || 'light';
    applyTheme(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('cba_theme', next);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';

    // Sincronizar ambos toggles (login y app)
    ['loginThemeToggle', 'appThemeToggle'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (isDark) btn.classList.add('on');
        else btn.classList.remove('on');
    });

    // Adaptar SweetAlert2 al tema
    if (typeof Swal !== 'undefined') {
        const style = document.getElementById('swal-theme-override') || document.createElement('style');
        style.id = 'swal-theme-override';
        if (isDark) {
            style.textContent = `
                .swal2-popup { background: #1e293b !important; color: #f1f5f9 !important; border: 1px solid #334155; }
                .swal2-title { color: #f1f5f9 !important; }
                .swal2-html-container { color: #94a3b8 !important; }
                .swal2-confirm { background: #3b82f6 !important; }
                .swal2-cancel { background: #334155 !important; color: #f1f5f9 !important; }
            `;
        } else {
            style.textContent = '';
        }
        document.head.appendChild(style);
    }
}

// ============================================================
//  AUTH — SESIÓN
// ============================================================
async function checkSession() {
    try {
        const { data: { session } } = await sbClient.auth.getSession();
        if (session && session.user) {
            currentUser = session.user;
            showApp();
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('Error verificando sesión:', error);
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('flex');
}

async function showApp() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('flex');

    // Mostrar email del usuario
    const emailEl = document.getElementById('userEmailDisplay');
    if (emailEl && currentUser) {
        emailEl.textContent = currentUser.email;
    }

    await cargarDatosIniciales();
}

// ============================================================
//  AUTH — LOGIN / REGISTER / LOGOUT
// ============================================================
function switchTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('formLogin').classList.toggle('hidden', !isLogin);
    document.getElementById('formRegister').classList.toggle('hidden', isLogin);
    document.getElementById('tabLogin').classList.toggle('active', isLogin);
    document.getElementById('tabRegister').classList.toggle('active', !isLogin);
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('btnLogin');
    const btnText = document.getElementById('loginBtnText');

    if (!email || !password) {
        showToast('warning', 'Completa todos los campos');
        return;
    }

    btn.disabled = true;
    btnText.innerHTML = '<i class="fas fa-circle-notch spinner mr-2"></i>Ingresando...';

    try {
        const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
        if (error) throw error;

        currentUser = data.user;
        showApp();
    } catch (error) {
        console.error('Login error:', error);
        const msg = error.message.includes('Invalid login')
            ? 'Correo o contraseña incorrectos'
            : 'Error al iniciar sesión. Intenta de nuevo.';
        showToast('error', msg);
    } finally {
        btn.disabled = false;
        btnText.textContent = 'Ingresar';
    }
}

async function handleRegister() {
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirm').value;
    const btn = document.getElementById('btnRegister');
    const btnText = document.getElementById('registerBtnText');

    if (!email || !password || !confirm) {
        showToast('warning', 'Completa todos los campos');
        return;
    }
    if (password.length < 6) {
        showToast('warning', 'La contraseña debe tener mínimo 6 caracteres');
        return;
    }
    if (password !== confirm) {
        showToast('warning', 'Las contraseñas no coinciden');
        return;
    }

    btn.disabled = true;
    btnText.innerHTML = '<i class="fas fa-circle-notch spinner mr-2"></i>Creando cuenta...';

    try {
        const { data, error } = await sbClient.auth.signUp({ email, password });
        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: '¡Cuenta creada!',
            text: 'Revisa tu correo para confirmar tu cuenta, luego inicia sesión.',
            confirmButtonText: 'Entendido'
        });
        switchTab('login');
    } catch (error) {
        console.error('Register error:', error);
        const msg = error.message.includes('already registered')
            ? 'Este correo ya está registrado'
            : 'Error al crear la cuenta. Intenta de nuevo.';
        showToast('error', msg);
    } finally {
        btn.disabled = false;
        btnText.textContent = 'Crear cuenta';
    }
}

async function handleLogout() {
    const result = await Swal.fire({
        title: '¿Cerrar sesión?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
    });
    if (!result.isConfirmed) return;

    await sbClient.auth.signOut();
    currentUser = null;
    showLogin();
}

async function forgotPassword() {
    const { value: email } = await Swal.fire({
        title: 'Recuperar contraseña',
        input: 'email',
        inputLabel: 'Ingresa tu correo electrónico',
        inputPlaceholder: 'correo@ejemplo.com',
        confirmButtonText: 'Enviar',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
    });

    if (!email) return;

    try {
        const { error } = await sbClient.auth.resetPasswordForEmail(email);
        if (error) throw error;
        showToast('success', 'Revisa tu correo para restablecer tu contraseña');
    } catch (error) {
        showToast('error', 'No se pudo enviar el correo. Verifica el email.');
    }
}

// ============================================================
//  CARGA DE DATOS
// ============================================================
async function cargarDatosIniciales() {
    try {
        await Promise.all([cargarProductos(), cargarProveedores()]);
        actualizarDashboard();
        actualizarSelectProveedores();
    } catch (error) {
        console.error('Error cargando datos:', error);
        showToast('error', 'No se pudieron cargar los datos');
    }
}

async function cargarProductos() {
    try {
        const { data, error } = await sbClient
            .from('productos')
            .select('*, proveedores(*)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        productos = data || [];
        productosFiltrados = productos;
        renderizarProductos();
    } catch (error) {
        console.error('Error cargando productos:', error);
    }
}

async function cargarProveedores() {
    try {
        const { data, error } = await sbClient
            .from('proveedores')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw error;
        proveedores = data || [];
        renderizarProveedores();
    } catch (error) {
        console.error('Error cargando proveedores:', error);
    }
}

// ============================================================
//  GUARDAR PRODUCTO
// ============================================================
async function guardarProducto(e) {
    e.preventDefault();

    const id = document.getElementById('productId').value;
    const producto = {
        nombre: document.getElementById('productName').value,
        categoria: document.getElementById('productCategory').value,
        stock: parseInt(document.getElementById('productStock').value) || 0,
        precio: parseFloat(document.getElementById('productPrice').value) || 0,
        proveedor_id: document.getElementById('productSupplier').value
    };

    try {
        let result;
        if (id) {
            result = await sbClient.from('productos').update(producto).eq('id', id);
        } else {
            result = await sbClient.from('productos').insert([producto]);
        }
        if (result.error) throw result.error;

        showToast('success', `Producto ${id ? 'actualizado' : 'creado'} correctamente`);
        closeProductModal();
        await cargarProductos();
        actualizarDashboard();
    } catch (error) {
        console.error('Error guardando producto:', error);
        showToast('error', 'No se pudo guardar el producto');
    }
}

// ============================================================
//  GUARDAR PROVEEDOR
// ============================================================
async function guardarProveedor(e) {
    e.preventDefault();

    const proveedor = {
        nombre: document.getElementById('proveedorName').value,
        contacto: document.getElementById('proveedorContacto').value,
        telefono: document.getElementById('proveedorTelefono').value,
        email: document.getElementById('proveedorEmail').value
    };

    try {
        const { error } = await sbClient.from('proveedores').insert([proveedor]);
        if (error) throw error;

        showToast('success', 'Proveedor creado correctamente');
        closeProveedorModal();
        await cargarProveedores();
        actualizarSelectProveedores();
    } catch (error) {
        console.error('Error guardando proveedor:', error);
        showToast('error', 'No se pudo guardar el proveedor');
    }
}

// ============================================================
//  ELIMINAR
// ============================================================
async function eliminarProducto(id) {
    const result = await Swal.fire({
        title: '¿Eliminar producto?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
        const { error } = await sbClient.from('productos').delete().eq('id', id);
        if (error) throw error;

        showToast('success', 'Producto eliminado');
        await cargarProductos();
        actualizarDashboard();
    } catch (error) {
        console.error('Error eliminando producto:', error);
        showToast('error', 'No se pudo eliminar el producto');
    }
}

async function eliminarProveedor(id) {
    const tieneProductos = productos.some(p => p.proveedor_id === id);
    if (tieneProductos) {
        showToast('warning', 'No puedes eliminar un proveedor con productos asociados');
        return;
    }

    const result = await Swal.fire({
        title: '¿Eliminar proveedor?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
        const { error } = await sbClient.from('proveedores').delete().eq('id', id);
        if (error) throw error;

        showToast('success', 'Proveedor eliminado');
        await cargarProveedores();
    } catch (error) {
        console.error('Error eliminando proveedor:', error);
        showToast('error', 'No se pudo eliminar el proveedor');
    }
}

// ============================================================
//  RENDERIZADO
// ============================================================
function renderizarProductos() {
    renderizarTablaDashboard();
    renderizarTablaInventario();
}

function renderizarTablaDashboard() {
    const tbody = document.getElementById('productosTable');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (productosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-sm" style="color:var(--text-secondary)">No hay productos registrados</td></tr>`;
        return;
    }

    productosFiltrados.slice(0, 5).forEach(p => {
        const bajo = p.stock < 5;
        tbody.innerHTML += `
        <tr class="table-row">
            <td class="px-6 py-3 text-sm font-medium" style="color:var(--text-primary)">${p.nombre || ''}</td>
            <td class="px-6 py-3 text-sm" style="color:var(--text-secondary)">${p.categoria || ''}</td>
            <td class="px-6 py-3 text-sm font-semibold" style="color:var(--text-primary)">${p.stock ?? 0}</td>
            <td class="px-6 py-3 text-sm" style="color:var(--text-primary)">$${(p.precio || 0).toFixed(2)}</td>
            <td class="px-6 py-3"><span class="${bajo ? 'badge-low' : 'badge-ok'}">${bajo ? 'Stock bajo' : 'Normal'}</span></td>
            <td class="px-6 py-3">
                <button onclick="editarProducto('${p.id}')" class="mr-3 text-sm" style="color:var(--accent);background:none;border:none;cursor:pointer;" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="eliminarProducto('${p.id}')" class="text-sm" style="color:var(--danger);background:none;border:none;cursor:pointer;" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>`;
    });
}

function renderizarTablaInventario() {
    const tbody = document.getElementById('inventarioTable');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (productos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-sm" style="color:var(--text-secondary)">No hay productos registrados</td></tr>`;
        return;
    }

    productos.forEach(p => {
        const prov = proveedores.find(v => v.id === p.proveedor_id);
        tbody.innerHTML += `
        <tr class="table-row">
            <td class="px-6 py-3 text-sm font-medium" style="color:var(--text-primary)">${p.nombre || ''}</td>
            <td class="px-6 py-3 text-sm" style="color:var(--text-secondary)">${p.categoria || ''}</td>
            <td class="px-6 py-3 text-sm font-semibold" style="color:${p.stock < 5 ? 'var(--danger)' : 'var(--text-primary)'}">${p.stock ?? 0}</td>
            <td class="px-6 py-3 text-sm" style="color:var(--text-primary)">$${(p.precio || 0).toFixed(2)}</td>
            <td class="px-6 py-3 text-sm" style="color:var(--text-secondary)">${prov ? prov.nombre : 'Sin proveedor'}</td>
            <td class="px-6 py-3">
                <button onclick="editarProducto('${p.id}')" class="mr-3 text-sm" style="color:var(--accent);background:none;border:none;cursor:pointer;" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="eliminarProducto('${p.id}')" class="text-sm" style="color:var(--danger);background:none;border:none;cursor:pointer;" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>`;
    });
}

function renderizarProveedores() {
    const tbody = document.getElementById('proveedoresTable');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (proveedores.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-sm" style="color:var(--text-secondary)">No hay proveedores registrados</td></tr>`;
        return;
    }

    proveedores.forEach(prov => {
        tbody.innerHTML += `
        <tr class="table-row">
            <td class="px-6 py-3 text-sm font-medium" style="color:var(--text-primary)">${prov.nombre || ''}</td>
            <td class="px-6 py-3 text-sm" style="color:var(--text-secondary)">${prov.contacto || ''}</td>
            <td class="px-6 py-3 text-sm" style="color:var(--text-secondary)">${prov.telefono || ''}</td>
            <td class="px-6 py-3 text-sm" style="color:var(--accent)">${prov.email || ''}</td>
            <td class="px-6 py-3">
                <button onclick="eliminarProveedor('${prov.id}')" class="text-sm" style="color:var(--danger);background:none;border:none;cursor:pointer;" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>`;
    });
}

function actualizarSelectProveedores() {
    const select = document.getElementById('productSupplier');
    if (!select) return;
    select.innerHTML = '<option value="">Seleccionar...</option>';
    proveedores.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nombre;
        select.appendChild(opt);
    });
}

function actualizarDashboard() {
    const totalValor = productos.reduce((sum, p) => sum + ((p.precio || 0) * (p.stock || 0)), 0);
    const totalAlertas = productos.filter(p => (p.stock || 0) < 5).length;

    const elValor = document.getElementById('totalValor');
    const elAlertas = document.getElementById('totalAlertas');
    const elTotal = document.getElementById('totalProductos');

    if (elValor) elValor.textContent = '$' + totalValor.toLocaleString('es-CO', { minimumFractionDigits: 2 });
    if (elAlertas) elAlertas.textContent = totalAlertas;
    if (elTotal) elTotal.textContent = productos.length;
}

// ============================================================
//  NAVEGACIÓN
// ============================================================
window.showSection = function(section, el) {
    ['dashboard', 'inventario', 'proveedores'].forEach(s => {
        const sec = document.getElementById(s);
        if (sec) sec.classList.add('hidden');
    });

    const target = document.getElementById(section);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('fade-in');
    }

    const titles = { dashboard: 'Panel de Control', inventario: 'Gestión de Inventario', proveedores: 'Gestión de Proveedores' };
    const titleEl = document.getElementById('sectionTitle');
    if (titleEl) titleEl.textContent = titles[section] || '';

    document.querySelectorAll('.sidebar-link').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');

    return false;
};

window.filterProducts = function() {
    const term = (document.getElementById('searchInput')?.value || '').toLowerCase();
    productosFiltrados = term ? productos.filter(p => p.nombre?.toLowerCase().includes(term)) : [...productos];
    renderizarTablaDashboard();
};

// ============================================================
//  MODALES PRODUCTO
// ============================================================
window.openProductModal = function() {
    document.getElementById('modalTitle').textContent = 'Nuevo Producto';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    const modal = document.getElementById('productModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeProductModal = function() {
    const modal = document.getElementById('productModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

window.editarProducto = function(id) {
    const p = productos.find(x => x.id === id);
    if (!p) return;

    document.getElementById('modalTitle').textContent = 'Editar Producto';
    document.getElementById('productId').value = p.id;
    document.getElementById('productName').value = p.nombre || '';
    document.getElementById('productCategory').value = p.categoria || '';
    document.getElementById('productStock').value = p.stock ?? 0;
    document.getElementById('productPrice').value = p.precio ?? 0;
    document.getElementById('productSupplier').value = p.proveedor_id || '';

    const modal = document.getElementById('productModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

// ============================================================
//  MODALES PROVEEDOR
// ============================================================
window.openProveedorModal = function() {
    document.getElementById('proveedorForm').reset();
    const modal = document.getElementById('proveedorModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeProveedorModal = function() {
    const modal = document.getElementById('proveedorModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

// Cerrar modales clickeando fuera
window.addEventListener('click', e => {
    ['productModal', 'proveedorModal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal && e.target === modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    });
});

// Exponer funciones globales necesarias
window.eliminarProducto = eliminarProducto;
window.eliminarProveedor = eliminarProveedor;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.togglePassword = togglePassword;
window.forgotPassword = forgotPassword;
window.guardarProducto = guardarProducto;
window.guardarProveedor = guardarProveedor;

// ============================================================
//  TOAST HELPER
// ============================================================
function showToast(icon, title) {
    Swal.fire({
        icon,
        title,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
    });
}
