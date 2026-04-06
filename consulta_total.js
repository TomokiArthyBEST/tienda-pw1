const mysql = require('mysql2');
const connection = mysql.createConnection({
  host: 'localhost', user: 'root', password: '', database: 'tiendapw'
});

connection.connect((err) => {
  if (err) throw err;
  
  // Esta es la consulta "mágica" que une las tablas
  const sql = `
    SELECT 
      PRODUCTOS.NOMBRE AS Producto, 
      PRODUCTOS.PRECIO, 
      PROVEEDORES.NOMBRE AS Proveedor
    FROM PRODUCTOS
    JOIN PROVEEDORES ON PRODUCTOS.NIF = PROVEEDORES.NIF
  `;

  connection.query(sql, (err, results) => {
    if (err) throw err;
    console.log('--- REPORTE DE INVENTARIO ---');
    console.table(results);
    connection.end();
  });
});