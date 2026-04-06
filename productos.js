const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // Tu contraseña de MySQL
  database: 'tiendapw'
});

connection.connect((err) => {
  if (err) throw err;
  console.log('✅ Conectado para registrar productos.');

  // Insertamos un producto vinculado al proveedor 'A100' que creamos antes
  const sql = "INSERT INTO PRODUCTOS (CODIGO, NOMBRE, PRECIO, NIF) VALUES (10, 'Teclado Mecánico', 25.50, 'A100')";

  connection.query(sql, (err, res) => {
    if (err) {
      console.log("⚠️ Error o Producto ya existente:", err.message);
    } else {
      console.log("✅ ¡Producto registrado con éxito!");
    }

    // Consultamos la tabla de productos
    connection.query('SELECT * FROM PRODUCTOS', (err, results) => {
      if (err) throw err;
      console.log('--- LISTA DE PRODUCTOS EN STOCK ---');
      console.table(results);
      connection.end();
    });
  });
});