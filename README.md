# 📦 Sistema de Gestión de Inventario CBA (ADSO)

Este proyecto es una aplicación web Full-Stack diseñada para el control eficiente de productos, proveedores y movimientos de stock. Desarrollado como parte de la formación tecnológica en **Análisis y Desarrollo de Software (ADSO)**.

---

## 📝 Descripción del Proyecto
La aplicación **CBA - Gestión de Inventario** permite a las empresas administrar su flujo de mercancía en tiempo real. El sistema implementa operaciones CRUD completas, permitiendo la trazabilidad de productos desde su ingreso por proveedor hasta su salida de bodega, con alertas automáticas de stock bajo y reportes básicos de inventario.

### Características Principales:
* **Gestión Integral:** Control total sobre productos, proveedores y categorías.
* **Trazabilidad:** Historial detallado de movimientos (Entradas/Salidas).
* **Inteligencia de Datos:** Dashboard con estadísticas de inventario y alertas de stock.
* **Interfaz Moderna:** Diseño responsive y amigable optimizado para la productividad.

---

## 🏗️ Modelo de Base de Datos
El sistema utiliza una arquitectura relacional con persistencia en la nube. Todas las entidades siguen el estándar de nombrado con el prefijo **CBA**.

| Entidad | Descripción |
| :--- | :--- |
| **CBA_Productos** | Almacena la información técnica, precio y cantidad de los artículos. |
| **CBA_Proveedores** | Registro de aliados comerciales y datos de contacto. |
| **CBA_Categorias** | Clasificación lógica de los productos. |
| **CBA_Movimientos** | Auditoría de cada ingreso y egreso de mercancía. |

> **Nota:** Se implementaron relaciones de llave foránea para garantizar la integridad referencial entre productos y proveedores.

---

## 🛠️ Tecnologías Utilizadas

* **Frontend:** [Angular](https://angular.io/) (TypeScript, Reactive Forms).
* **Estilos:** [Tailwind CSS](https://tailwindcss.com/) / Bootstrap.
* **Base de Datos:** [Supabase / MongoDB Atlas] (Base de datos online).
* **Despliegue:** [Vercel](https://vercel.com/).
* **Control de Versiones:** Git & GitHub.

---

## 🚀 Despliegue en la Nube
La aplicación se encuentra disponible y operativa en el siguiente enlace:

🔗 **[VER APLICACIÓN EN VIVO](TU_URL_DE_VERCEL_AQUÍ)**

---

## 📸 Capturas de Pantalla

### 1. Dashboard Principal
> ![Dashboard](https://via.placeholder.com/800x400?text=Captura+Dashboard+CBA)
*Vista general de estadísticas y alertas de bajo stock.*

### 2. Gestión de Productos (CRUD)
> ![Listado de Productos](https://via.placeholder.com/800x400?text=Captura+Listado+Productos)
*Tabla interactiva con opciones de búsqueda, edición y eliminación.*

### 3. Registro de Movimientos
> ![Formulario de Movimientos](https://via.placeholder.com/800x400?text=Captura+Formulario+Movimientos)
*Interfaz para el ingreso y salida de mercancía con validaciones en tiempo real.*

---

## 👷 Instalación Local

1. Clona el repositorio:
   ```bash
   git clone [https://github.com/tu-usuario/nombre-repo.git](https://github.com/tu-usuario/nombre-repo.git)
