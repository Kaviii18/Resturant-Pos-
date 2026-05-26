const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a connection pool for efficient database access
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'restaurant_pos',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  multipleStatements: true,
  timezone: '+00:00',
});

// Test connection on startup + verify/seed feature tables
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    const dbName = process.env.MYSQL_DATABASE || 'restaurant_pos';
    console.log('✅ MySQL connected successfully to database:', dbName);

    const { ensureDbReady } = require('../utils/dbBootstrap');
    const { resolveColumns } = require('./dbColumns');
    await resolveColumns(pool);
    const bootstrap = await ensureDbReady();
    if (bootstrap.missingTables.length > 0) {
      console.warn('⚠️  Missing tables:', bootstrap.missingTables.join(', '));
    }
    if (bootstrap.seeded?.tables) {
      console.log('📋 Seeded default dining_tables (table was empty).');
    }
    if (bootstrap.seeded?.ingredients) {
      console.log('📦 Seeded default ingredients (table was empty).');
    }
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   Make sure MySQL is running and the database exists.');
    process.exit(1);
  }
}

testConnection();

module.exports = pool;
