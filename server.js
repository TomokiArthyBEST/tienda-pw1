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

// --- 2. CONEXIÓN AUTOMÁTICA (Clever Cloud Add-on) ---
const pool = mysql.createPool({
    host: process.env.MYSQL_ADDON_HOST || 'localhost',
    user: process.env.MYSQL_ADDON_USER || 'root',
    password: process.env.MYSQL_ADDON_PASSWORD || '',
    database: process.env.MYSQL_ADDON_DB || 'tiendapw',
    port: process.env.MYSQL_ADDON_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10
});

pool.getConnection((err, conn) => {
    if (err) console.error("❌ Error de conexión:", err.message);
    else {
        console.log("✅ Conexión exitosa a la base de datos de Clever Cloud");
        conn.release();
    }
});

// --- 3. MIDDLEWARE DE SEGURIDAD ---
function IsLoggedIn(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
}

// --- 4. RUTAS ---

// Login y Registro
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', (req, res) => {
    const { user_name, password } = req.body;
    pool.query("SELECT * FROM usuarios WHERE USER_NAME = ? AND PASSWORD = ?", [user_name, password], (err, results) => {
        if (results && results.length > 0) {
            req.session.user = results[0].USER_NAME;
            res.redirect('/');
        } else {
            res.render('login', { error: 'Usuario o contraseña incorrectos' });
        }
    });
});

app.get('/registro', (req, res) => res.render('registro', { error: null }));
app.post('/registro', (req, res) => {
    const { user_name, password } = req.body;
    pool.query("INSERT INTO usuarios (USER_NAME, PASSWORD) VALUES (?, ?)", [user_name, password], (err) => {
        if (err) return res.send("Error: " + err.message);
        res.redirect('/login');
    });
});

// Vistas Principales
app.get('/', IsLoggedIn, (req, res) => {
    const sqlProd = "SELECT p.*, pr.NOMBRE AS PROVEEDOR FROM productos p LEFT JOIN proveedores pr ON p.NIF = pr.NIF";
    const sqlTotal = "SELECT SUM(STOCK) AS total FROM productos";

    pool.query(sqlProd, (err, lista) => {
        if (err) return res.send("Error en productos: " + err.message);

        pool.query(sqlTotal, (err, resTotal) => {
            // Si la consulta falla o no hay productos, ponemos 0
            const total = (resTotal[0] && resTotal[0].total) ? resTotal[0].total : 0;
            
            // ¡ESTA ES LA CLAVE! Enviamos 'totalProductos' a la vista
            res.render('productos', { 
                productos: lista || [], 
                totalProductos: total, 
                user: req.session.user, 
                paginaActiva: 'productos' 
            });
        });
    });
});

app.get('/proveedores', IsLoggedIn, (req, res) => {
    pool.query("SELECT * FROM proveedores", (err, results) => {
        res.render('proveedores', { proveedores: results || [], user: req.session.user, paginaActiva: 'proveedores' });
    });
});

app.get('/clientes', IsLoggedIn, (req, res) => {
    pool.query("SELECT * FROM clientes", (err, results) => {
        res.render('clientes', { clientes: results || [], user: req.session.user, paginaActiva: 'clientes' });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- 5. PUERTO PARA LA NUBE ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));