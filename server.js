const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const app = express();

// 1. --- CONFIGURACIÓN ---
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'mi-clave-secreta-tomoki',
    resave: false,
    saveUninitialized: true
}));

// 2. --- CONEXIÓN LOCAL (XAMPP / WORKBENCH) ---
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      // Usuario por defecto de XAMPP/Workbench
    password: '',      // Deja vacío si es XAMPP, pon tu clave si es Workbench
    database: 'tiendapw',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection((err, conn) => {
    if (err) {
        console.error("❌ Error: Asegúrate de que MySQL esté encendido en XAMPP");
        console.error(err.message);
    } else {
        console.log("✅ Conexión LOCAL exitosa a MySQL");
        conn.release();
    }
});

// 3. --- SEGURIDAD ---
function IsLoggedIn(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
}

// 4. --- RUTAS DE ACCESO ---
app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', (req, res) => {
    const { user_name, password } = req.body;
    pool.query("SELECT * FROM usuarios WHERE USER_NAME = ? AND PASSWORD = ?", [user_name, password], (err, results) => {
        if (err) return res.render('login', { error: 'Error en el servidor' });
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
    const sql = "INSERT INTO usuarios (USER_NAME, PASSWORD) VALUES (?, ?)";
    pool.query(sql, [user_name, password], (err) => {
        if (err) return res.send("❌ Error: " + err.message);
        res.send("<script>alert('✅ Registro exitoso'); window.location='/login';</script>");
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// 5. --- GESTIÓN DE PRODUCTOS (HOME) ---
app.get('/', IsLoggedIn, (req, res) => {
    const sqlProd = `SELECT p.CODIGO, p.NOMBRE, p.PRECIO, p.STOCK, pr.NOMBRE AS PROVEEDOR 
                     FROM productos p 
                     JOIN proveedores pr ON p.NIF = pr.NIF`;
    
    const sqlTotal = "SELECT SUM(STOCK) AS total FROM productos";

    pool.query(sqlProd, (err, lista) => {
        if (err) return res.send("Error en productos: " + err.message);

        pool.query(sqlTotal, (err, resTotal) => {
            const total = (resTotal[0] && resTotal[0].total) ? resTotal[0].total : 0;
            res.render('productos', { 
                productos: lista || [], 
                totalProductos: total, 
                user: req.session.user, 
                paginaActiva: 'productos' 
            });
        });
    });
});

// 6. --- GESTIÓN DE PROVEEDORES ---
app.get('/proveedores', IsLoggedIn, (req, res) => {
    pool.query('SELECT * FROM proveedores', (err, results) => {
        if (err) return res.send("Error en proveedores: " + err.message);
        res.render('proveedores', { 
            proveedores: results || [], 
            user: req.session.user, 
            paginaActiva: 'proveedores' 
        });
    });
});

app.post('/agregar-proveedor', IsLoggedIn, (req, res) => {
    const { nif, nombre, direccion } = req.body;
    const sql = "INSERT INTO proveedores (NIF, NOMBRE, DIRECCION) VALUES (?, ?, ?)";
    pool.query(sql, [nif, nombre, direccion], () => res.redirect('/proveedores'));
});

// 7. --- GESTIÓN DE CLIENTES ---
app.get('/clientes', IsLoggedIn, (req, res) => {
    pool.query('SELECT * FROM clientes', (err, results) => {
        if (err) return res.send("Error en clientes: " + err.message);
        res.render('clientes', { 
            clientes: results || [], 
            user: req.session.user, 
            paginaActiva: 'clientes' 
        });
    });
});

app.post('/agregar-cliente', IsLoggedIn, (req, res) => {
    const { id_clientes, nombre, apellido, curp, direccion, fca_nac } = req.body;
    const sql = "INSERT INTO clientes (ID_CLIENTES, NOMBRE, APELLIDO, CURP, DIRECCION, FCA_NAC) VALUES (?, ?, ?, ?, ?, ?)";
    pool.query(sql, [id_clientes, nombre, apellido, curp, direccion, fca_nac], () => res.redirect('/clientes'));
});

// 8. --- ASIGNACIONES / VENTAS ---
app.get('/asignaciones', IsLoggedIn, (req, res) => {
    const sql = `SELECT pc.ID_PC, p.NOMBRE AS PRODUCTO, c.NOMBRE AS CLIENTE, c.APELLIDO
                 FROM producto_clientes pc
                 JOIN productos p ON pc.CODIGO = p.CODIGO
                 JOIN clientes c ON pc.ID_CLIENTES = c.ID_CLIENTES`;
    pool.query(sql, (err, results) => {
        if (err) return res.send("Error en asignaciones: " + err.message);
        res.render('asignaciones', { 
            asignaciones: results || [], 
            user: req.session.user, 
            paginaActiva: 'asignaciones' 
        });
    });
});

app.post('/agregar-asignacion', IsLoggedIn, (req, res) => {
    const { codigo, id_clientes } = req.body;
    pool.query("INSERT INTO producto_clientes (CODIGO, ID_CLIENTES) VALUES (?, ?)", [codigo, id_clientes], (err) => {
        if (err) return res.send("Error al asignar: " + err.message);
        pool.query("UPDATE productos SET STOCK = STOCK - 1 WHERE CODIGO = ?", [codigo], () => {
            res.redirect('/asignaciones');
        });
    });
});

// 9. --- GENERACIÓN DE PDF ---
app.get('/descargar-ventas', IsLoggedIn, (req, res) => {
    const doc = new PDFDocument();
    const sql = `SELECT pc.ID_PC, p.NOMBRE AS PRODUCTO, c.NOMBRE AS CLIENTE, c.APELLIDO 
                 FROM producto_clientes pc 
                 JOIN productos p ON pc.CODIGO = p.CODIGO 
                 JOIN clientes c ON pc.ID_CLIENTES = c.ID_CLIENTES`;

    pool.query(sql, (err, results) => {
        if (err) return res.send("Error en PDF: " + err.message);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=reporte-ventas.pdf');
        doc.pipe(res);
        doc.fontSize(22).text('REPORTE DE VENTAS', { align: 'center' });
        doc.moveDown();
        if (results) {
            results.forEach(v => {
                doc.fontSize(12).text(`• Folio: ${v.ID_PC} | Item: ${v.PRODUCTO} | Cliente: ${v.CLIENTE} ${v.APELLIDO}`);
            });
        }
        doc.end();
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));