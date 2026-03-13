// Configuración de Supabase - CAMBIA EL NOMBRE DE LA VARIABLE
const SUPABASE_URL = 'https://tjvbloddkcmpjbpbqejo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Y7guvU793hHGEsnZN16UeA_h-rfbsrw';

// Cambia 'supabase' por 'sbClient' para evitar conflictos
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables globales
let productos = [];
let proveedores = [];
let productosFiltrados = [];

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    await cargarDatosIniciales();
    configurarEventListeners();
});

// Configurar event listeners
function configurarEventListeners() {
    const productForm = document.getElementById('productForm');
    const proveedorForm = document.getElementById('proveedorForm');
    
    if (productForm) {
        productForm.addEventListener('submit', guardarProducto);
    }
    
    if (proveedorForm) {
        proveedorForm.addEventListener('submit', guardarProveedor);
    }
}

// Cargar datos iniciales
async function cargarDatosIniciales() {
    try {
        await Promise.all([
            cargarProductos(),
            cargarProveedores()
        ]);
        actualizarDashboard();
        actualizarSelectProveedores();
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        Swal.fire('Error', 'No se pudieron cargar los datos iniciales', 'error');
    }
}

// ============= FUNCIONES DE SUPABASE =============

// Cargar productos - USAR sbClient en lugar de supabase
async function cargarProductos() {
    try {
        const { data, error } = await sbClient  // Cambiado de supabase a sbClient
            .from('productos')
            .select('*, proveedores(*)')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        productos = data || [];
        productosFiltrados = productos;
        renderizarProductos();
        return data;
    } catch (error) {
        console.error('Error cargando productos:', error);
        Swal.fire('Error', 'No se pudieron cargar los productos', 'error');
        return [];
    }
}

// Cargar proveedores - USAR sbClient
async function cargarProveedores() {
    try {
        const { data, error } = await sbClient  // Cambiado de supabase a sbClient
            .from('proveedores')
            .select('*')
            .order('nombre', { ascending: true });
        
        if (error) throw error;
        
        proveedores = data || [];
        renderizarProveedores();
        return data;
    } catch (error) {
        console.error('Error cargando proveedores:', error);
        Swal.fire('Error', 'No se pudieron cargar los proveedores', 'error');
        return [];
    }
}

// Guardar producto - USAR sbClient
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

    if (!producto.nombre || !producto.categoria || !producto.proveedor_id) {
        Swal.fire('Advertencia', 'Por favor completa todos los campos requeridos', 'warning');
        return;
    }

    try {
        let result;
        
        if (id) {
            result = await sbClient  // Cambiado de supabase a sbClient
                .from('productos')
                .update(producto)
                .eq('id', id);
        } else {
            result = await sbClient  // Cambiado de supabase a sbClient
                .from('productos')
                .insert([producto]);
        }

        if (result.error) throw result.error;

        Swal.fire('Éxito', `Producto ${id ? 'actualizado' : 'creado'} correctamente`, 'success');
        closeProductModal();
        await cargarProductos();
        actualizarDashboard();
    } catch (error) {
        console.error('Error guardando producto:', error);
        Swal.fire('Error', 'No se pudo guardar el producto', 'error');
    }
}

// Guardar proveedor - USAR sbClient
async function guardarProveedor(e) {
    e.preventDefault();
    
    const proveedor = {
        nombre: document.getElementById('proveedorName').value,
        contacto: document.getElementById('proveedorContacto').value,
        telefono: document.getElementById('proveedorTelefono').value,
        email: document.getElementById('proveedorEmail').value
    };

    if (!proveedor.nombre || !proveedor.contacto || !proveedor.telefono || !proveedor.email) {
        Swal.fire('Advertencia', 'Por favor completa todos los campos', 'warning');
        return;
    }

    try {
        const { error } = await sbClient  // Cambiado de supabase a sbClient
            .from('proveedores')
            .insert([proveedor]);

        if (error) throw error;

        Swal.fire('Éxito', 'Proveedor creado correctamente', 'success');
        closeProveedorModal();
        await cargarProveedores();
        actualizarSelectProveedores();
    } catch (error) {
        console.error('Error guardando proveedor:', error);
        Swal.fire('Error', 'No se pudo guardar el proveedor', 'error');
    }
}

// Eliminar producto - USAR sbClient
async function eliminarProducto(id) {
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const { error } = await sbClient  // Cambiado de supabase a sbClient
                .from('productos')
                .delete()
                .eq('id', id);

            if (error) throw error;

            Swal.fire('Eliminado', 'Producto eliminado correctamente', 'success');
            await cargarProductos();
            actualizarDashboard();
        } catch (error) {
            console.error('Error eliminando producto:', error);
            Swal.fire('Error', 'No se pudo eliminar el producto', 'error');
        }
    }
}

// Eliminar proveedor - USAR sbClient
async function eliminarProveedor(id) {
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const productosConProveedor = productos.filter(p => p.proveedor_id === id);
            
            if (productosConProveedor.length > 0) {
                Swal.fire('Error', 'No se puede eliminar un proveedor con productos asociados', 'error');
                return;
            }

            const { error } = await sbClient  // Cambiado de supabase a sbClient
                .from('proveedores')
                .delete()
                .eq('id', id);

            if (error) throw error;

            Swal.fire('Eliminado', 'Proveedor eliminado correctamente', 'success');
            await cargarProveedores();
        } catch (error) {
            console.error('Error eliminando proveedor:', error);
            Swal.fire('Error', 'No se pudo eliminar el proveedor', 'error');
        }
    }
}

// ============= FUNCIONES DE RENDERIZADO =============
// (El resto del código permanece IGUAL desde aquí)
function renderizarProductos() {
    renderizarTablaDashboard();
    renderizarTablaInventario();
}

function renderizarTablaDashboard() {
    const tbody = document.getElementById('productosTable');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    productosFiltrados.slice(0, 5).forEach(producto => {
        const stockBajo = producto.stock < 5;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4">${producto.nombre || ''}</td>
            <td class="px-6 py-4">${producto.categoria || ''}</td>
            <td class="px-6 py-4">${producto.stock || 0}</td>
            <td class="px-6 py-4">$${(producto.precio || 0).toFixed(2)}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 text-xs rounded-full ${stockBajo ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
                    ${stockBajo ? 'Stock bajo' : 'Normal'}
                </span>
            </td>
            <td class="px-6 py-4">
                <button onclick="editarProducto('${producto.id}')" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="eliminarProducto('${producto.id}')" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderizarTablaInventario() {
    const tbody = document.getElementById('inventarioTable');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    productos.forEach(producto => {
        const proveedor = proveedores.find(p => p.id === producto.proveedor_id);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4">${producto.nombre || ''}</td>
            <td class="px-6 py-4">${producto.categoria || ''}</td>
            <td class="px-6 py-4">${producto.stock || 0}</td>
            <td class="px-6 py-4">$${(producto.precio || 0).toFixed(2)}</td>
            <td class="px-6 py-4">${proveedor ? proveedor.nombre : 'Sin proveedor'}</td>
            <td class="px-6 py-4">
                <button onclick="editarProducto('${producto.id}')" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="eliminarProducto('${producto.id}')" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderizarProveedores() {
    const tbody = document.getElementById('proveedoresTable');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    proveedores.forEach(proveedor => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4">${proveedor.nombre || ''}</td>
            <td class="px-6 py-4">${proveedor.contacto || ''}</td>
            <td class="px-6 py-4">${proveedor.telefono || ''}</td>
            <td class="px-6 py-4">${proveedor.email || ''}</td>
            <td class="px-6 py-4">
                <button onclick="eliminarProveedor('${proveedor.id}')" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function actualizarSelectProveedores() {
    const select = document.getElementById('productSupplier');
    if (!select) return;
    
    select.innerHTML = '<option value="">Seleccionar proveedor</option>';
    
    proveedores.forEach(proveedor => {
        const option = document.createElement('option');
        option.value = proveedor.id;
        option.textContent = proveedor.nombre;
        select.appendChild(option);
    });
}

function actualizarDashboard() {
    const totalValor = productos.reduce((sum, p) => sum + ((p.precio || 0) * (p.stock || 0)), 0);
    const totalAlertas = productos.filter(p => (p.stock || 0) < 5).length;
    const totalProductos = productos.length;
    
    const totalValorEl = document.getElementById('totalValor');
    const totalAlertasEl = document.getElementById('totalAlertas');
    const totalProductosEl = document.getElementById('totalProductos');
    
    if (totalValorEl) totalValorEl.textContent = `$${totalValor.toFixed(2)}`;
    if (totalAlertasEl) totalAlertasEl.textContent = totalAlertas;
    if (totalProductosEl) totalProductosEl.textContent = totalProductos;
}

// ============= FUNCIONES DE INTERFAZ GLOBALES =============
window.showSection = function(section) {
    const dashboard = document.getElementById('dashboard');
    const inventario = document.getElementById('inventario');
    const proveedores = document.getElementById('proveedores');
    const sectionTitle = document.getElementById('sectionTitle');
    
    if (dashboard) dashboard.classList.add('hidden');
    if (inventario) inventario.classList.add('hidden');
    if (proveedores) proveedores.classList.add('hidden');
    
    const sectionEl = document.getElementById(section);
    if (sectionEl) sectionEl.classList.remove('hidden');
    
    const titles = {
        'dashboard': 'Panel de Control',
        'inventario': 'Gestión de Inventario',
        'proveedores': 'Gestión de Proveedores'
    };
    
    if (sectionTitle) sectionTitle.textContent = titles[section] || 'Panel de Control';
    
    document.querySelectorAll('nav a').forEach(a => {
        a.classList.remove('text-blue-600', 'bg-blue-50');
        a.classList.add('text-gray-700');
    });
    
    if (event && event.target) {
        event.target.classList.add('text-blue-600', 'bg-blue-50');
    }
};

window.filterProducts = function() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    
    if (searchTerm === '') {
        productosFiltrados = productos;
    } else {
        productosFiltrados = productos.filter(p => 
            p.nombre && p.nombre.toLowerCase().includes(searchTerm)
        );
    }
    
    renderizarTablaDashboard();
};

window.openProductModal = function() {
    const modal = document.getElementById('productModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('productForm');
    
    if (title) title.textContent = 'Nuevo Producto';
    if (form) form.reset();
    
    const productId = document.getElementById('productId');
    if (productId) productId.value = '';
    
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.closeProductModal = function() {
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.editarProducto = function(id) {
    const producto = productos.find(p => p.id === id);
    if (!producto) return;
    
    const title = document.getElementById('modalTitle');
    const productId = document.getElementById('productId');
    const productName = document.getElementById('productName');
    const productCategory = document.getElementById('productCategory');
    const productStock = document.getElementById('productStock');
    const productPrice = document.getElementById('productPrice');
    const productSupplier = document.getElementById('productSupplier');
    
    if (title) title.textContent = 'Editar Producto';
    if (productId) productId.value = producto.id;
    if (productName) productName.value = producto.nombre || '';
    if (productCategory) productCategory.value = producto.categoria || '';
    if (productStock) productStock.value = producto.stock || 0;
    if (productPrice) productPrice.value = producto.precio || 0;
    if (productSupplier) productSupplier.value = producto.proveedor_id || '';
    
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.openProveedorModal = function() {
    const modal = document.getElementById('proveedorModal');
    const form = document.getElementById('proveedorForm');
    
    if (form) form.reset();
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.closeProveedorModal = function() {
    const modal = document.getElementById('proveedorModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.eliminarProducto = eliminarProducto;
window.eliminarProveedor = eliminarProveedor;

// Cerrar modales con click fuera
window.onclick = function(event) {
    const productModal = document.getElementById('productModal');
    const proveedorModal = document.getElementById('proveedorModal');
    
    if (event.target === productModal) {
        closeProductModal();
    }
    if (event.target === proveedorModal) {
        closeProveedorModal();
    }
};