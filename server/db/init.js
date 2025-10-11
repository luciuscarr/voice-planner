const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'voice_planner.db');

// Ensure the database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
    });

    // Create tasks table first
    const createTasksTable = `
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        completed INTEGER DEFAULT 0,
        priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
        dueDate TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `;

    db.run(createTasksTable, (err) => {
      if (err) {
        console.error('Error creating tasks table:', err);
        reject(err);
        return;
      }
      console.log('Tasks table created or already exists');

      // Create indexes for better performance - only after table is created
      const createIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed)',
        'CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)',
        'CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON tasks(createdAt)',
        'CREATE INDEX IF NOT EXISTS idx_tasks_dueDate ON tasks(dueDate)'
      ];

      let completedIndexes = 0;
      createIndexes.forEach((indexQuery, i) => {
        db.run(indexQuery, (err) => {
          if (err) {
            console.error(`Error creating index ${i + 1}:`, err);
            reject(err);
            return;
          }
          completedIndexes++;
          if (completedIndexes === createIndexes.length) {
            console.log('All indexes created successfully');
            db.close((err) => {
              if (err) {
                console.error('Error closing database:', err);
                reject(err);
              } else {
                console.log('Database initialization completed');
                resolve();
              }
            });
          }
        });
      });
    });
  });
};

module.exports = { initDatabase };
