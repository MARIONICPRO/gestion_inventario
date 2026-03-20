// ================================================================
//  CBA Inventory · app.js
//  Auth propia con tabla `usuarios` — sin Supabase Auth
//  Contraseñas hasheadas con bcryptjs
// ================================================================

const SUPABASE_URL = 'https://tjvbloddkcmpjbpbqejo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Y7guvU793hHGEsnZN16UeA_h-rfbsrw';
const STORAGE_BUCKET = 'product-images';
const SESSION_KEY = 'cba_session';

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Alias seguro para bcryptjs (compatible con cdnjs)
const bcrypt = window.dcodeIO?.bcrypt || window.bcrypt;

// ── Estado global ──────────────────────────────────────────────
let productos         = [];
let proveedores       = [];
let productosFiltrados = [];
let currentUser       = null; // fila completa de tabla usuarios
let activeFilters     = { search: '', categoria: '', proveedor: '', stock: '' };

// ================================================================
//  INICIALIZACIÓN
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkSession();
});

// ================================================================
//  MODO OSCURO
// ================================================================
function initTheme() {
    applyTheme(localStorage.getItem('cba_theme') || 'light');
}
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('cba_theme', next);
}
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';
    ['loginThemeToggle', 'appThemeToggle'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.toggle('on', isDark);
    });
    const style = document.getElementById('swal-dark') || Object.assign(document.createElement('style'), { id: 'swal-dark' });
    style.textContent = isDark
        ? `.swal2-popup{background:#1e293b!important;color:#f1f5f9!important;border:1px solid #334155}
           .swal2-title{color:#f1f5f9!important}.swal2-html-container{color:#94a3b8!important}
           .swal2-confirm{background:#3b82f6!important}.swal2-cancel{background:#334155!important;color:#f1f5f9!important}`
        : '';
    document.head.appendChild(style);
}

// ================================================================
//  SESIÓN (localStorage — sin Supabase Auth)
// ================================================================
function checkSession() {
    try {
        const saved = localStorage.getItem(SESSION_KEY);
        if (saved) {
            currentUser = JSON.parse(saved);
            renderApp();
        } else {
            showLogin();
        }
    } catch {
        showLogin();
    }
}

function saveSession(user) {
    // Guardamos todo menos el hash de contraseña
    const safe = { ...user };
    delete safe.password_hash;
    localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
    currentUser = safe;
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    currentUser = null;
}

// ================================================================
//  VISTAS LOGIN / APP
// ================================================================
function showLogin() {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('flex');
}

function renderApp() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('flex');

    // Nombre en sidebar
    const nameEl = document.getElementById('userNameDisplay');
    if (nameEl) nameEl.textContent = currentUser.nombre || currentUser.email;

    // Badge de rol
    const badge = document.getElementById('userRoleBadge');
    if (badge) {
        badge.textContent = currentUser.rol === 'admin' ? 'Administrador' : 'Usuario';
        badge.className = currentUser.rol === 'admin' ? 'badge-admin' : 'badge-user';
    }

    // Mostrar sección Usuarios solo a admin
    if (currentUser.rol === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
    }

    // Ocultar botones de escritura a usuarios normales
    if (currentUser.rol !== 'admin') {
        ['btnNuevoProducto', 'btnNuevoProveedor'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.style.display = 'none';
        });
    }

    cargarDatosIniciales();
}

// ================================================================
//  AUTH — LOGIN
// ================================================================
async function handleLogin() {
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    // Validaciones
    let err = false;
    if (!email)              { showFieldError('loginEmail', 'El correo es requerido'); err = true; }
    else if (!isValidEmail(email)) { showFieldError('loginEmail', 'Ingresa un correo válido'); err = true; }
    if (!password)           { showFieldError('loginPassword', 'La contraseña es requerida'); err = true; }
    if (err) return;

    const btn = document.getElementById('btnLogin');
    const txt = document.getElementById('loginBtnText');
    btn.disabled = true;
    txt.innerHTML = '<i class="fas fa-circle-notch spinner mr-2"></i>Ingresando...';

    try {
        // Buscar usuario por email
        const { data: users, error } = await sbClient
            .from('usuarios')
            .select('*')
            .eq('email', email)
            .eq('activo', true)
            .limit(1);

        if (error) throw new Error('Error de conexión con la base de datos');
        if (!users || users.length === 0) {
            showFieldError('loginEmail', 'No existe una cuenta con este correo');
            return;
        }

        const user = users[0];

        // Verificar contraseña con bcrypt
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            showFieldError('loginPassword', 'Contraseña incorrecta');
            return;
        }

        // Sesión exitosa
        saveSession(user);
        renderApp();

    } catch (e) {
        showFieldError('loginPassword', e.message || 'Error al iniciar sesión');
    } finally {
        btn.disabled = false;
        txt.textContent = 'Ingresar';
    }
}

// ================================================================
//  AUTH — REGISTRO
// ================================================================
async function handleRegister() {
    const nombre   = document.getElementById('registerNombre').value.trim();
    const email    = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirm  = document.getElementById('registerConfirm').value;
    const rol      = document.getElementById('registerRole').value;

    // Validaciones
    let err = false;
    if (!nombre || nombre.length < 2) { showFieldError('registerNombre', 'El nombre debe tener al menos 2 caracteres'); err = true; }
    if (!email)                        { showFieldError('registerEmail', 'El correo es requerido'); err = true; }
    else if (!isValidEmail(email))     { showFieldError('registerEmail', 'Ingresa un correo válido'); err = true; }
    const pwErrs = validatePassword(password);
    if (pwErrs.length)   { showFieldError('registerPassword', pwErrs[0]); err = true; }
    if (!confirm)        { showFieldError('registerConfirm', 'Confirma tu contraseña'); err = true; }
    else if (password !== confirm) { showFieldError('registerConfirm', 'Las contraseñas no coinciden'); err = true; }
    if (err) return;

    const btn = document.getElementById('btnRegister');
    const txt = document.getElementById('registerBtnText');
    btn.disabled = true;
    txt.innerHTML = '<i class="fas fa-circle-notch spinner mr-2"></i>Creando cuenta...';

    try {
        // Verificar si el email ya existe
        const { data: existing } = await sbClient
            .from('usuarios')
            .select('id')
            .eq('email', email)
            .limit(1);

        if (existing && existing.length > 0) {
            showFieldError('registerEmail', 'Este correo ya está registrado');
            return;
        }

        // Hashear contraseña con bcrypt (salt rounds = 10)
        const hash = await bcrypt.hash(password, 10);

        // Insertar usuario
        const { error } = await sbClient.from('usuarios').insert([{
            nombre,
            email,
            rol,
            activo: true,
            password_hash: hash
        }]);

        if (error) throw new Error('No se pudo crear la cuenta');

        showToast('success', '¡Cuenta creada! Ya puedes iniciar sesión.');
        switchTab('login');

        // Pre-llenar email en el login
        document.getElementById('loginEmail').value = email;

    } catch (e) {
        showFieldError('registerEmail', e.message || 'Error al crear la cuenta');
    } finally {
        btn.disabled = false;
        txt.textContent = 'Crear cuenta';
    }
}

// ================================================================
//  AUTH — LOGOUT
// ================================================================
async function handleLogout() {
    const r = await Swal.fire({
        title: '¿Cerrar sesión?', icon: 'question',
        showCancelButton: true, confirmButtonText: 'Salir',
        cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444'
    });
    if (!r.isConfirmed) return;
    clearSession();
    showLogin();
}

// ================================================================
//  UI HELPERS — LOGIN
// ================================================================
function switchTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('formLogin').classList.toggle('hidden', !isLogin);
    document.getElementById('formRegister').classList.toggle('hidden', isLogin);
    document.getElementById('tabLogin').classList.toggle('active', isLogin);
    document.getElementById('tabRegister').classList.toggle('active', !isLogin);
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon  = btn.querySelector('i');
    input.type = input.type === 'password' ? 'text' : 'password';
    icon.classList.toggle('fa-eye',      input.type === 'password');
    icon.classList.toggle('fa-eye-slash', input.type === 'text');
}

function checkPasswordStrength() {
    const pw = document.getElementById('registerPassword').value;
    const checks = {
        'req-len':     pw.length >= 8,
        'req-upper':   /[A-Z]/.test(pw),
        'req-num':     /[0-9]/.test(pw),
        'req-special': /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)
    };
    const score  = Object.values(checks).filter(Boolean).length;
    const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];
    for (let i = 1; i <= 4; i++) {
        const bar = document.getElementById(`sb${i}`);
        if (bar) bar.style.background = i <= score ? colors[score] : 'var(--border)';
    }
    Object.entries(checks).forEach(([id, met]) => {
        const el = document.getElementById(id);
        if (el) el.className = `pw-req ${met ? 'met' : 'unmet'}`;
    });
}

// ================================================================
//  VALIDACIONES
// ================================================================
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidPhone(phone) {
    return /^[0-9+\s\-()]{7,15}$/.test(phone.trim());
}
function validatePassword(pw) {
    const e = [];
    if (pw.length < 8)                                          e.push('Mínimo 8 caracteres');
    if (!/[A-Z]/.test(pw))                                     e.push('Debe incluir al menos una mayúscula');
    if (!/[0-9]/.test(pw))                                     e.push('Debe incluir al menos un número');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw))   e.push('Debe incluir un carácter especial');
    return e;
}
function validateProductForm() {
    let ok = true;
    const name     = document.getElementById('productName').value.trim();
    const cat      = document.getElementById('productCategory').value;
    const stock    = document.getElementById('productStock').value;
    const price    = document.getElementById('productPrice').value;
    const supplier = document.getElementById('productSupplier').value;

    if (!name || name.length < 2)    { showFieldError('productName', 'El nombre debe tener al menos 2 caracteres'); ok = false; }
    else if (name.length > 100)       { showFieldError('productName', 'Máximo 100 caracteres'); ok = false; }
    if (!cat)                         { showFieldError('productCategory', 'Selecciona una categoría'); ok = false; }
    if (!supplier)                    { showFieldError('productSupplier', 'Selecciona un proveedor'); ok = false; }
    if (stock === '' || isNaN(stock)) { showFieldError('productStock', 'Ingresa un stock válido'); ok = false; }
    else if (parseInt(stock) < 0)     { showFieldError('productStock', 'No puede ser negativo'); ok = false; }
    if (price === '' || isNaN(price)) { showFieldError('productPrice', 'Ingresa un precio válido'); ok = false; }
    else if (parseFloat(price) < 0)   { showFieldError('productPrice', 'No puede ser negativo'); ok = false; }
    return ok;
}
function validateProveedorForm() {
    let ok = true;
    const name     = document.getElementById('proveedorName').value.trim();
    const contacto = document.getElementById('proveedorContacto').value.trim();
    const telefono = document.getElementById('proveedorTelefono').value.trim();
    const email    = document.getElementById('proveedorEmail').value.trim();

    if (!name || name.length < 2)    { showFieldError('proveedorName', 'Mínimo 2 caracteres'); ok = false; }
    if (!contacto || contacto.length < 2) { showFieldError('proveedorContacto', 'Ingresa el nombre de contacto'); ok = false; }
    if (!telefono)                   { showFieldError('proveedorTelefono', 'El teléfono es requerido'); ok = false; }
    else if (!isValidPhone(telefono)) { showFieldError('proveedorTelefono', 'Formato inválido'); ok = false; }
    if (!email)                      { showFieldError('proveedorEmail', 'El email es requerido'); ok = false; }
    else if (!isValidEmail(email))   { showFieldError('proveedorEmail', 'Email inválido'); ok = false; }
    return ok;
}
function showFieldError(id, msg) {
    const input = document.getElementById(id);
    const err   = document.getElementById(`err-${id}`);
    if (input) input.classList.add('error');
    if (err)   { err.textContent = msg; err.classList.add('show'); }
}
function clearFieldError(id) {
    const input = document.getElementById(id);
    const err   = document.getElementById(`err-${id}`);
    if (input) input.classList.remove('error');
    if (err)   err.classList.remove('show');
}

// ================================================================
//  IMÁGENES
// ================================================================
function handleImageSelect(input) {
    if (input.files[0]) validateAndPreviewImage(input.files[0]);
}
function handleDrop(event) {
    event.preventDefault();
    document.getElementById('uploadArea').classList.remove('dragover');
    if (event.dataTransfer.files[0]) validateAndPreviewImage(event.dataTransfer.files[0]);
}
function validateAndPreviewImage(file) {
    clearFieldError('imageFile');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
        showFieldError('imageFile', 'Solo PNG, JPG o WEBP'); return;
    }
    if (file.size > 2 * 1024 * 1024) {
        showFieldError('imageFile', 'La imagen no puede superar 2MB'); return;
    }
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('imgPreview').src = e.target.result;
        document.getElementById('imgPreviewWrap').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    window._pendingImageFile = file;
}
function clearImage() {
    window._pendingImageFile = null;
    document.getElementById('imageFile').value  = '';
    document.getElementById('imgPreview').src   = '';
    document.getElementById('imgPreviewWrap').classList.add('hidden');
    document.getElementById('productImageUrl').value = '';
}
async function uploadImageToSupabase(file) {
    const ext      = file.name.split('.').pop();
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    document.getElementById('uploadProgress').classList.remove('hidden');
    try {
        console.log('Subiendo imagen:', filename, 'bucket:', STORAGE_BUCKET);
        const { data: uploadData, error } = await sbClient.storage
            .from(STORAGE_BUCKET)
            .upload(filename, file, { cacheControl: '3600', upsert: false });
        if (error) {
            console.error('Error subiendo imagen:', JSON.stringify(error));
            throw error;
        }
        console.log('Imagen subida OK:', uploadData);
        const { data } = sbClient.storage.from(STORAGE_BUCKET).getPublicUrl(filename);
        console.log('URL pública:', data.publicUrl);
        return data.publicUrl;
    } finally {
        document.getElementById('uploadProgress').classList.add('hidden');
    }
}

// ================================================================
//  CARGA DE DATOS
// ================================================================
async function cargarDatosIniciales() {
    await Promise.all([cargarProductos(), cargarProveedores()]);
    actualizarDashboard();
    actualizarSelectProveedores();
    if (currentUser?.rol === 'admin') cargarUsuarios();
}

async function cargarProductos() {
    const { data, error } = await sbClient.from('productos').select('*, proveedores(*)').order('created_at', { ascending: false });
    if (!error) {
        productos          = data || [];
        productosFiltrados = [...productos];
        renderizarProductos();
    }
}

async function cargarProveedores() {
    const { data, error } = await sbClient.from('proveedores').select('*').order('nombre', { ascending: true });
    if (!error) {
        proveedores = data || [];
        renderizarProveedores();
        actualizarFiltroProveedores();
    }
}

async function cargarUsuarios() {
    const { data } = await sbClient.from('usuarios').select('id, nombre, email, rol, activo, created_at').order('created_at', { ascending: false });
    renderizarUsuarios(data || []);
}

// ================================================================
//  CRUD PRODUCTOS
// ================================================================
async function guardarProducto(e) {
    e.preventDefault();
    if (!validateProductForm()) return;

    let imageUrl = document.getElementById('productImageUrl').value || null;
    if (window._pendingImageFile) {
        try {
            imageUrl = await uploadImageToSupabase(window._pendingImageFile);
            window._pendingImageFile = null;
            console.log('imageUrl guardada:', imageUrl);
        } catch (imgErr) {
            console.error('Fallo subida imagen:', imgErr);
            showToast('error', 'No se pudo subir la imagen: ' + (imgErr.message || imgErr.error || JSON.stringify(imgErr)));
            return; // No guardar el producto si falla la imagen
        }
    }

    const id = document.getElementById('productId').value;
    const producto = {
        nombre:       document.getElementById('productName').value.trim(),
        categoria:    document.getElementById('productCategory').value,
        stock:        parseInt(document.getElementById('productStock').value),
        precio:       parseFloat(document.getElementById('productPrice').value),
        proveedor_id: document.getElementById('productSupplier').value,
    };
    // Solo incluir imagen_url si existe en la tabla (evita error 400)
    if (imageUrl !== null) producto.imagen_url = imageUrl;

    console.log('Guardando producto:', JSON.stringify(producto));

    const result = id
        ? await sbClient.from('productos').update(producto).eq('id', id)
        : await sbClient.from('productos').insert([producto]);

    if (result.error) {
        console.error('guardarProducto error COMPLETO:', JSON.stringify(result.error));
        const esPermisos = result.error.code === '42501' || result.error.message?.includes('policy') || result.error.message?.includes('permission');
        showToast('error', esPermisos
            ? 'Sin permisos — ejecuta en Supabase: ALTER TABLE productos DISABLE ROW LEVEL SECURITY;'
            : (result.error.message || 'No se pudo guardar el producto'));
        return;
    }

    showToast('success', `Producto ${id ? 'actualizado' : 'creado'} correctamente`);
    closeProductModal();
    await cargarProductos();
    actualizarDashboard();
}

async function eliminarProducto(id) {
    if (currentUser?.rol !== 'admin') { showToast('warning', 'Solo los administradores pueden eliminar productos'); return; }
    const r = await Swal.fire({ title: '¿Eliminar producto?', text: 'Esta acción no se puede deshacer', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444' });
    if (!r.isConfirmed) return;
    const { error } = await sbClient.from('productos').delete().eq('id', id);
    if (!error) { showToast('success', 'Producto eliminado'); await cargarProductos(); actualizarDashboard(); }
    else showToast('error', 'No se pudo eliminar');
}

// ================================================================
//  CRUD PROVEEDORES
// ================================================================
async function guardarProveedor(e) {
    e.preventDefault();
    if (!validateProveedorForm()) return;

    const proveedor = {
        nombre:   document.getElementById('proveedorName').value.trim(),
        contacto: document.getElementById('proveedorContacto').value.trim(),
        telefono: document.getElementById('proveedorTelefono').value.trim(),
        email:    document.getElementById('proveedorEmail').value.trim()
    };

    const { error: provError } = await sbClient.from('proveedores').insert([proveedor]);
    if (!provError) {
        showToast('success', 'Proveedor creado correctamente');
        closeProveedorModal();
        await cargarProveedores();
        actualizarSelectProveedores();
    } else {
        console.error('guardarProveedor error:', provError);
        const esPermisos = provError.code === '42501' || provError.message?.includes('policy') || provError.message?.includes('permission');
        showToast('error', esPermisos
            ? 'Sin permisos — ejecuta en Supabase: ALTER TABLE proveedores DISABLE ROW LEVEL SECURITY;'
            : (provError.message || 'No se pudo guardar el proveedor'));
    }
}

async function eliminarProveedor(id) {
    if (currentUser?.rol !== 'admin') { showToast('warning', 'Solo los administradores pueden eliminar proveedores'); return; }
    if (productos.some(p => p.proveedor_id === id)) { showToast('warning', 'No puedes eliminar un proveedor con productos asociados'); return; }
    const r = await Swal.fire({ title: '¿Eliminar proveedor?', text: 'Esta acción no se puede deshacer', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444' });
    if (!r.isConfirmed) return;
    const { error } = await sbClient.from('proveedores').delete().eq('id', id);
    if (!error) { showToast('success', 'Proveedor eliminado'); await cargarProveedores(); }
    else showToast('error', 'No se pudo eliminar');
}

// ================================================================
//  FILTROS AVANZADOS
// ================================================================
function applyFilters() {
    activeFilters.search    = (document.getElementById('invSearch')?.value || '').toLowerCase().trim();
    activeFilters.categoria = document.getElementById('filterCategoria')?.value || '';
    activeFilters.proveedor = document.getElementById('filterProveedor')?.value || '';
    activeFilters.stock     = document.getElementById('filterStock')?.value || '';

    productosFiltrados = productos.filter(p => {
        if (activeFilters.search    && !p.nombre?.toLowerCase().includes(activeFilters.search)) return false;
        if (activeFilters.categoria && p.categoria !== activeFilters.categoria)                  return false;
        if (activeFilters.proveedor && p.proveedor_id !== activeFilters.proveedor)               return false;
        if (activeFilters.stock === 'low' && (p.stock ?? 0) >= 5)                               return false;
        if (activeFilters.stock === 'ok'  && (p.stock ?? 0) <  5)                               return false;
        return true;
    });

    renderizarTablaInventario();
    const el = document.getElementById('filterCount');
    if (el) el.textContent = `Mostrando ${productosFiltrados.length} de ${productos.length} productos`;
}

function setCatTag(cat, btn) {
    document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const sel = document.getElementById('filterCategoria');
    if (sel) sel.value = cat;
    applyFilters();
}

function clearFilters() {
    ['invSearch','filterCategoria','filterProveedor','filterStock'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.querySelectorAll('.filter-tag').forEach((t, i) => t.classList.toggle('active', i === 0));
    activeFilters      = { search: '', categoria: '', proveedor: '', stock: '' };
    productosFiltrados = [...productos];
    renderizarTablaInventario();
    const el = document.getElementById('filterCount');
    if (el) el.textContent = '';
}

function actualizarFiltroProveedores() {
    const sel = document.getElementById('filterProveedor');
    if (!sel) return;
    sel.innerHTML = '<option value="">Todos los proveedores</option>';
    proveedores.forEach(p => sel.innerHTML += `<option value="${p.id}">${p.nombre}</option>`);
}

window.filterProducts = function () {
    const term = (document.getElementById('searchInput')?.value || '').toLowerCase();
    productosFiltrados = term ? productos.filter(p => p.nombre?.toLowerCase().includes(term)) : [...productos];
    renderizarTablaDashboard();
};

// ================================================================
//  RENDERIZADO
// ================================================================
const thumbHtml = url => url
    ? `<img src="${url}" class="product-thumb" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="product-thumb-placeholder"><i class="fas fa-image text-xs" style="color:var(--text-secondary)"></i></div>`;

const isAdmin = () => currentUser?.rol === 'admin';

const actionBtns = id => isAdmin()
    ? `<button onclick="editarProducto('${id}')" style="color:var(--accent);background:none;border:none;cursor:pointer;margin-right:10px" title="Editar"><i class="fas fa-edit"></i></button>
       <button onclick="eliminarProducto('${id}')" style="color:var(--danger);background:none;border:none;cursor:pointer" title="Eliminar"><i class="fas fa-trash"></i></button>`
    : `<span class="text-xs" style="color:var(--text-secondary)">Solo lectura</span>`;

const emptyRow = (cols, msg) =>
    `<tr><td colspan="${cols}" class="px-6 py-10 text-center text-sm" style="color:var(--text-secondary)">${msg}</td></tr>`;

function renderizarProductos() { renderizarTablaDashboard(); renderizarTablaInventario(); }

function renderizarTablaDashboard() {
    const tbody = document.getElementById('productosTable');
    if (!tbody) return;
    if (!productosFiltrados.length) { tbody.innerHTML = emptyRow(7, 'No hay productos registrados'); return; }
    tbody.innerHTML = productosFiltrados.slice(0, 5).map(p => `
        <tr class="table-row">
            <td class="px-4 py-3">${thumbHtml(p.imagen_url)}</td>
            <td class="px-4 py-3 text-sm font-medium" style="color:var(--text-primary)">${p.nombre || ''}</td>
            <td class="px-4 py-3 text-sm" style="color:var(--text-secondary)">${p.categoria || ''}</td>
            <td class="px-4 py-3 text-sm font-semibold" style="color:${(p.stock??0) < 5 ? 'var(--danger)' : 'var(--text-primary)'}">${p.stock ?? 0}</td>
            <td class="px-4 py-3 text-sm" style="color:var(--text-primary)">$${(p.precio||0).toFixed(2)}</td>
            <td class="px-4 py-3"><span class="${(p.stock??0) < 5 ? 'badge-low' : 'badge-ok'}">${(p.stock??0) < 5 ? 'Stock bajo' : 'Normal'}</span></td>
            <td class="px-4 py-3">${actionBtns(p.id)}</td>
        </tr>`).join('');
}

function renderizarTablaInventario() {
    const tbody = document.getElementById('inventarioTable');
    if (!tbody) return;
    if (!productosFiltrados.length) { tbody.innerHTML = emptyRow(7, 'No se encontraron productos'); return; }
    tbody.innerHTML = productosFiltrados.map(p => {
        const prov = proveedores.find(v => v.id === p.proveedor_id);
        return `
        <tr class="table-row">
            <td class="px-4 py-3">${thumbHtml(p.imagen_url)}</td>
            <td class="px-4 py-3 text-sm font-medium" style="color:var(--text-primary)">${p.nombre || ''}</td>
            <td class="px-4 py-3 text-sm" style="color:var(--text-secondary)">${p.categoria || ''}</td>
            <td class="px-4 py-3 text-sm font-semibold" style="color:${(p.stock??0) < 5 ? 'var(--danger)' : 'var(--text-primary)'}">${p.stock ?? 0}</td>
            <td class="px-4 py-3 text-sm" style="color:var(--text-primary)">$${(p.precio||0).toFixed(2)}</td>
            <td class="px-4 py-3 text-sm" style="color:var(--text-secondary)">${prov ? prov.nombre : '—'}</td>
            <td class="px-4 py-3">${actionBtns(p.id)}</td>
        </tr>`;
    }).join('');
}

function renderizarProveedores() {
    const tbody = document.getElementById('proveedoresTable');
    if (!tbody) return;
    if (!proveedores.length) { tbody.innerHTML = emptyRow(5, 'No hay proveedores registrados'); return; }
    tbody.innerHTML = proveedores.map(p => `
        <tr class="table-row">
            <td class="px-6 py-3 text-sm font-medium" style="color:var(--text-primary)">${p.nombre || ''}</td>
            <td class="px-6 py-3 text-sm" style="color:var(--text-secondary)">${p.contacto || ''}</td>
            <td class="px-6 py-3 text-sm" style="color:var(--text-secondary)">${p.telefono || ''}</td>
            <td class="px-6 py-3 text-sm" style="color:var(--accent)">${p.email || ''}</td>
            <td class="px-6 py-3">
                ${isAdmin()
                    ? `<button onclick="eliminarProveedor('${p.id}')" style="color:var(--danger);background:none;border:none;cursor:pointer"><i class="fas fa-trash"></i></button>`
                    : `<span class="text-xs" style="color:var(--text-secondary)">Solo lectura</span>`}
            </td>
        </tr>`).join('');
}

function renderizarUsuarios(users) {
    const tbody = document.getElementById('usuariosTable');
    if (!tbody) return;
    if (!users.length) { tbody.innerHTML = emptyRow(5, 'No hay usuarios registrados'); return; }
    tbody.innerHTML = users.map(u => `
        <tr class="table-row">
            <td class="px-6 py-3 text-sm font-medium" style="color:var(--text-primary)">${u.nombre || '—'}</td>
            <td class="px-6 py-3 text-sm" style="color:var(--text-secondary)">${u.email || ''}</td>
            <td class="px-6 py-3"><span class="${u.rol === 'admin' ? 'badge-admin' : 'badge-user'}">${u.rol === 'admin' ? 'Administrador' : 'Usuario'}</span></td>
            <td class="px-6 py-3"><span class="${u.activo ? 'badge-ok' : 'badge-low'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
            <td class="px-6 py-3 text-sm" style="color:var(--text-secondary)">${u.created_at ? new Date(u.created_at).toLocaleDateString('es-CO') : '—'}</td>
        </tr>`).join('');
}

function actualizarSelectProveedores() {
    const sel = document.getElementById('productSupplier');
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccionar...</option>';
    proveedores.forEach(p => sel.innerHTML += `<option value="${p.id}">${p.nombre}</option>`);
}

function actualizarDashboard() {
    const total = productos.reduce((s, p) => s + (p.precio||0) * (p.stock||0), 0);
    const set   = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('totalValor',      '$' + total.toLocaleString('es-CO', { minimumFractionDigits: 2 }));
    set('totalAlertas',    productos.filter(p => (p.stock??0) < 5).length);
    set('totalProductos',  productos.length);
    set('totalProveedores', proveedores.length);
}

// ================================================================
//  NAVEGACIÓN
// ================================================================
window.showSection = function (section, el) {
    ['dashboard','inventario','proveedores','usuarios'].forEach(s => {
        const sec = document.getElementById(s);
        if (sec) sec.classList.add('hidden');
    });
    const target = document.getElementById(section);
    if (target) { target.classList.remove('hidden'); target.classList.add('fade-in'); }
    const titles = { dashboard: 'Panel de Control', inventario: 'Gestión de Inventario', proveedores: 'Gestión de Proveedores', usuarios: 'Gestión de Usuarios' };
    const titleEl = document.getElementById('sectionTitle');
    if (titleEl) titleEl.textContent = titles[section] || '';
    document.querySelectorAll('.sidebar-link').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');
    return false;
};

// ================================================================
//  MODALES
// ================================================================
window.openProductModal = function () {
    if (!isAdmin()) { showToast('warning', 'Solo los administradores pueden agregar productos'); return; }
    document.getElementById('modalTitle').textContent = 'Nuevo Producto';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('productImageUrl').value = '';
    clearImage();
    window._pendingImageFile = null;
    const m = document.getElementById('productModal');
    m.classList.remove('hidden'); m.classList.add('flex');
};

window.closeProductModal = function () {
    const m = document.getElementById('productModal');
    m.classList.add('hidden'); m.classList.remove('flex');
    window._pendingImageFile = null;
};

window.editarProducto = function (id) {
    if (!isAdmin()) { showToast('warning', 'Solo los administradores pueden editar'); return; }
    const p = productos.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modalTitle').textContent = 'Editar Producto';
    document.getElementById('productId').value         = p.id;
    document.getElementById('productName').value       = p.nombre || '';
    document.getElementById('productCategory').value   = p.categoria || '';
    document.getElementById('productStock').value      = p.stock ?? 0;
    document.getElementById('productPrice').value      = p.precio ?? 0;
    document.getElementById('productSupplier').value   = p.proveedor_id || '';
    document.getElementById('productImageUrl').value   = p.imagen_url || '';
    if (p.imagen_url) {
        document.getElementById('imgPreview').src = p.imagen_url;
        document.getElementById('imgPreviewWrap').classList.remove('hidden');
    } else clearImage();
    window._pendingImageFile = null;
    const m = document.getElementById('productModal');
    m.classList.remove('hidden'); m.classList.add('flex');
};

window.openProveedorModal = function () {
    if (!isAdmin()) { showToast('warning', 'Solo los administradores pueden agregar proveedores'); return; }
    document.getElementById('proveedorForm').reset();
    const m = document.getElementById('proveedorModal');
    m.classList.remove('hidden'); m.classList.add('flex');
};

window.closeProveedorModal = function () {
    const m = document.getElementById('proveedorModal');
    m.classList.add('hidden'); m.classList.remove('flex');
};

window.addEventListener('click', e => {
    ['productModal','proveedorModal'].forEach(id => {
        const m = document.getElementById(id);
        if (m && e.target === m) { m.classList.add('hidden'); m.classList.remove('flex'); }
    });
});

// ================================================================
//  TOAST
// ================================================================
function showToast(icon, title) {
    Swal.fire({ icon, title, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
}

// ── Exponer globales ─────────────────────────────────────────────
window.eliminarProducto  = eliminarProducto;
window.eliminarProveedor = eliminarProveedor;
window.handleLogin       = handleLogin;
window.handleRegister    = handleRegister;
window.handleLogout      = handleLogout;
window.toggleTheme       = toggleTheme;
window.switchTab         = switchTab;
window.togglePassword    = togglePassword;
window.guardarProducto   = guardarProducto;
window.guardarProveedor  = guardarProveedor;
window.applyFilters      = applyFilters;
window.clearFilters      = clearFilters;
window.setCatTag         = setCatTag;
window.handleImageSelect = handleImageSelect;
window.handleDrop        = handleDrop;
window.clearImage        = clearImage;
window.checkPasswordStrength = checkPasswordStrength;
window.clearFieldError   = clearFieldError;