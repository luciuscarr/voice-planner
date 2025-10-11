const { Pool } = require('pg');

let pool;

const initDatabase = async () => {
  try {
    // Use Railway PostgreSQL if available, otherwise fallback to SQLite
    if (process.env.DATABASE_URL) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      // Test connection
      const client = await pool.connect();
      console.log('Connected to PostgreSQL database');
      
      // Create tasks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          completed BOOLEAN DEFAULT FALSE,
          priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
          "dueDate" TEXT,
          "createdAt" TEXT NOT NULL,
          "updatedAt" TEXT NOT NULL
        )
      `);

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON tasks("createdAt")');
      await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_dueDate ON tasks("dueDate")');

      client.release();
      console.log('PostgreSQL database initialized successfully');
      return pool;
    } else {
      // Fallback to SQLite for local development
      const { initDatabase } = require('./init');
      await initDatabase();
      return null;
    }
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

const getDatabase = () => {
  return pool;
};

module.exports = { initDatabase, getDatabase };
