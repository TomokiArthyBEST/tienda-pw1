const mysql = require('mysql2');

// --- CONFIGURACIÓN CON CREDENCIALES DE CLEVER CLOUD ---
const connection = mysql.createConnection({
  host: 'btdjfvoltt1fngzt23uf-mysql.services.clever-cloud.com',
  user: 'uzz6zkkzji3qngw2',
  password: '5TKHTtS35XpaHM7oXqru',
  database: 'btdjfvoltt1fngzt23uf',
  port: 3306
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos remota:', err.message);
    return;
  }
  
  console.log('✅ Conectado exitosamente a Clever Cloud para registrar productos.');

  // Nota: Asegúrate de que el proveedor con NIF 'A100' ya exista en la tabla PROVEEDORES
  // de lo contrario, la restricción de llave foránea (Foreign Key) podría dar error.
  const sql = "INSERT INTO productos (CODIGO, NOMBRE, PRECIO, NIF) VALUES (10, 'Teclado Mecánico', 25.50, 'A100')";

  connection.query(sql, (err, res) => {
    if (err) {
      // Si el error es por duplicado (código 10 ya existe), lo manejamos aquí
      console.log("⚠️ Información:", err.message);
    } else {
      console.log("✅ ¡Producto registrado con éxito en la nube!");
    }

    // Consultamos la tabla de productos para verificar
    connection.query('SELECT * FROM productos', (err, results) => {
      if (err) {
        console.error('❌ Error al consultar productos:', err.message);
      } else {
        console.log('\n--- LISTA DE PRODUCTOS EN STOCK (NUBE) ---');
        console.table(results);
      }
      
      // Cerramos la conexión al terminar las consultas
      connection.end();
    });
  });
});
