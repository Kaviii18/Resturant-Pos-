/**
 * utils/setupDatabase.js
 * Run this script to initialize the MySQL database from schema.sql
 * Usage: node utils/setupDatabase.js
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function setupDatabase() {
  console.log('🔧 Starting database setup...');

  // Connect without specifying a database first (to create it if needed)
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    multipleStatements: true,
  });

  console.log('✅ Connected to MySQL server.');

  // Read the schema SQL file from the frontend project root
  // Adjust this path if your schema.sql is elsewhere
  const schemaPath = path.join(__dirname, '../../schema.sql');

  if (!fs.existsSync(schemaPath)) {
    console.error('❌ schema.sql not found at:', schemaPath);
    console.log('   Make sure schema.sql is in the project root (alongside server/)');
    process.exit(1);
  }

  const sql = fs.readFileSync(schemaPath, 'utf-8');
  console.log('📄 Schema file loaded.');

  try {
    await connection.query(sql);
    console.log('✅ Database schema executed successfully!');
    console.log('   Tables created: restaurant_config, menu_items, users, orders, order_items, held_orders, held_order_items');
    console.log('   Seed data inserted.');
  } catch (err) {
    console.error('❌ Error executing schema:', err.message);
    throw err;
  } finally {
    await connection.end();
  }

  console.log('\n🚀 Database setup complete! You can now start the server with: npm run dev');
}

setupDatabase().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
