const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const path = require('path');
const app = express();

// --- 1. CONFIGURACIÓN DE CARPETAS ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'secreto-utvch-tomoki',
    resave: false,
    saveUninitialized: true
}));

// --- 2. CONEXIÓN A CLEVER CLOUD ---
const pool = mysql.createPool({
    host: process.env.MYSQL_ADDON_HOST || 'btdjfvoltt1fngzt23uf-mysql.services.clever-cloud.com',
    user: process.env.MYSQL_ADDON_USER || 'uzz6zkkzji3qngw2',
    password: process.env.MYSQL_ADDON_PASSWORD || '5TKHTtS35XpaHM7oXqru',
    database: process.env.MYSQL_ADDON_DB || 'btdjfvoltt1fngzt23uf',
    port: process.env.MYSQL_ADDON_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection((err, conn) => {
    if (err) {
        console.error("❌ Error de conexión detallado:", err.message);
    } else {
        console.log("✅ Conexión exitosa a la base de datos de Clever Cloud");
        conn.release();
    }
});

// --- 3. MIDDLEWARE DE SEGURIDAD ---
function IsLoggedIn(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
}

// --- 4. RUTAS GET (VISTAS) ---

// Login y Registro
app.get('/login', (req, res) => res.render('login', { error: null }));
app.get('/registro', (req, res) => res.render('registro', { error: null }));

// Productos (Página Principal)
app.get('/', IsLoggedIn, (req, res) => {
    const sqlProd = "SELECT p.*, pr.NOMBRE AS PROVEEDOR FROM productos p LEFT JOIN proveedores pr ON p.NIF = pr.NIF";
    const sqlTotal = "SELECT SUM(STOCK) AS total FROM productos";
    pool.query(sqlProd, (err, lista) => {
        if (err) return res.send("Error en productos: " + err.message);
        pool.query(sqlTotal, (err, resTotal) => {
            const total = (resTotal[0] && resTotal[0].total) ? resTotal[0].total : 0;
            res.render('productos', { productos: lista || [], totalProductos: total, user: req.session.user, paginaActiva: 'productos' });
        });
    });
});

app.get('/proveedores', IsLoggedIn, (req, res) => {
    pool.query("SELECT * FROM proveedores", (err, results) => {
        if (err) return res.send("Error en proveedores: " + err.message);
        res.render('proveedores', { proveedores: results || [], user: req.session.user, paginaActiva: 'proveedores' });
    });
});

app.get('/clientes', IsLoggedIn, (req, res) => {
    pool.query("SELECT * FROM clientes", (err, results) => {
        if (err) return res.send("Error en clientes: " + err.message);
        res.render('clientes', { clientes: results || [], user: req.session.user, paginaActiva: 'clientes' });
    });
});

app.get('/asignaciones', IsLoggedIn, (req, res) => {
    const sql = `SELECT pc.ID_PC, p.NOMBRE AS PRODUCTO, c.NOMBRE AS CLIENTE, c.APELLIDO 
                 FROM producto_clientes pc 
                 JOIN productos p ON pc.CODIGO = p.CODIGO 
                 JOIN clientes c ON pc.ID_CLIENTES = c.ID_CLIENTES`;
    pool.query(sql, (err, results) => {
        res.render('asignaciones', { asignaciones: results || [], user: req.session.user, paginaActiva: 'asignaciones' });
    });
});

// 🗑️ RUTA PARA ELIMINAR PRODUCTO
app.get('/eliminar-producto/:codigo', IsLoggedIn, (req, res) => {
    const codigo = req.params.codigo;
    const sql = "DELETE FROM productos WHERE CODIGO = ?";
    
    pool.query(sql, [codigo], (err, result) => {
        if (err) {
            console.error("Error al eliminar producto:", err.message);
            return res.send("❌ Error al eliminar: " + err.message);
        }
        console.log(`✅ Producto ${codigo} eliminado con éxito`);
        res.redirect('/'); // Te regresa a la lista de productos
    });
});

// --- 5. RUTAS POST (RECEPCIÓN DE FORMULARIOS) ---

app.post('/login', (req, res) => {
    const { user_name, password } = req.body;
    pool.query("SELECT * FROM usuarios WHERE USER_NAME = ? AND PASSWORD = ?", [user_name, password], (err, results) => {
        if (err) return res.send("Error en login: " + err.message);
        if (results && results.length > 0) {
            req.session.user = results[0].USER_NAME;
            res.redirect('/');
        } else {
            res.render('login', { error: 'Usuario o contraseña incorrectos' });
        }
    });
});

app.post('/registro', (req, res) => {
    const { user_name, password } = req.body;
    pool.query("INSERT INTO usuarios (USER_NAME, PASSWORD) VALUES (?, ?)", [user_name, password], (err) => {
        if (err) return res.send("Error al crear cuenta: " + err.message);
        res.redirect('/login');
    });
});

// 🚀 AQUÍ ESTÁN LAS RUTAS QUE TE FALTABAN PARA QUITAR EL "CANNOT POST"
app.post('/agregar-producto', IsLoggedIn, (req, res) => {
    const { codigo, nombre, precio, stock, nif } = req.body;
    const sql = "INSERT INTO productos (CODIGO, NOMBRE, PRECIO, STOCK, NIF) VALUES (?, ?, ?, ?, ?)";
    pool.query(sql, [codigo, nombre, precio, stock, nif], (err) => {
        if (err) return res.send("Error al insertar producto: " + err.message);
        res.redirect('/');
    });
});

app.post('/agregar-cliente', IsLoggedIn, (req, res) => {
    const { id_clientes, nombre, apellido, curp, direccion, fca_nac } = req.body;
    const sql = "INSERT INTO clientes (ID_CLIENTES, NOMBRE, APELLIDO, CURP, DIRECCION, FCA_NAC) VALUES (?, ?, ?, ?, ?, ?)";
    pool.query(sql, [id_clientes, nombre, apellido, curp, direccion, fca_nac], (err) => {
        if (err) return res.send("Error al insertar cliente: " + err.message);
        res.redirect('/clientes');
    });
});

app.post('/agregar-proveedor', IsLoggedIn, (req, res) => {
    const { nif, nombre, direccion } = req.body;
    const sql = "INSERT INTO proveedores (NIF, NOMBRE, DIRECCION) VALUES (?, ?, ?)";
    pool.query(sql, [nif, nombre, direccion], (err) => {
        if (err) return res.send("Error al insertar proveedor: " + err.message);
        res.redirect('/proveedores');
    });
});

app.post('/agregar-asignacion', IsLoggedIn, (req, res) => {
    const { codigo, id_clientes } = req.body;
    pool.query("INSERT INTO producto_clientes (CODIGO, ID_CLIENTES) VALUES (?, ?)", [codigo, id_clientes], (err) => {
        if (err) return res.send("Error en asignación: " + err.message);
        // Opcional: Descontar del stock
        pool.query("UPDATE productos SET STOCK = STOCK - 1 WHERE CODIGO = ?", [codigo], () => {
            res.redirect('/asignaciones');
        });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- 6. PUERTO PARA LA NUBE ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
