const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Database connection
const dbPath = path.join(__dirname, '../db/voice_planner.db');
const db = new sqlite3.Database(dbPath);

// Get all tasks
router.get('/', (req, res) => {
  const { completed, priority, search } = req.query;
  
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];
  
  if (completed !== undefined) {
    query += ' AND completed = ?';
    params.push(completed === 'true' ? 1 : 0);
  }
  
  if (priority) {
    query += ' AND priority = ?';
    params.push(priority);
  }
  
  if (search) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  query += ' ORDER BY createdAt DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching tasks:', err);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }
    
    // Convert SQLite boolean values to JavaScript booleans
    const tasks = rows.map(row => ({
      ...row,
      completed: Boolean(row.completed)
    }));
    
    res.json(tasks);
  });
});

// Get task by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error fetching task:', err);
      return res.status(500).json({ error: 'Failed to fetch task' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({
      ...row,
      completed: Boolean(row.completed)
    });
  });
});

// Create new task
router.post('/', (req, res) => {
  const { title, description, priority = 'medium', dueDate } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const query = `
    INSERT INTO tasks (id, title, description, completed, priority, dueDate, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [id, title, description || null, 0, priority, dueDate || null, now, now];
  
  db.run(query, params, function(err) {
    if (err) {
      console.error('Error creating task:', err);
      return res.status(500).json({ error: 'Failed to create task' });
    }
    
    // Fetch the created task
    db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Error fetching created task:', err);
        return res.status(500).json({ error: 'Failed to fetch created task' });
      }
      
      res.status(201).json({
        ...row,
        completed: Boolean(row.completed)
      });
    });
  });
});

// Update task
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, completed, priority, dueDate } = req.body;
  
  const updates = [];
  const params = [];
  
  if (title !== undefined) {
    updates.push('title = ?');
    params.push(title);
  }
  
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  
  if (completed !== undefined) {
    updates.push('completed = ?');
    params.push(completed ? 1 : 0);
  }
  
  if (priority !== undefined) {
    updates.push('priority = ?');
    params.push(priority);
  }
  
  if (dueDate !== undefined) {
    updates.push('dueDate = ?');
    params.push(dueDate);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  
  updates.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(id);
  
  const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
  
  db.run(query, params, function(err) {
    if (err) {
      console.error('Error updating task:', err);
      return res.status(500).json({ error: 'Failed to update task' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Fetch the updated task
    db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Error fetching updated task:', err);
        return res.status(500).json({ error: 'Failed to fetch updated task' });
      }
      
      res.json({
        ...row,
        completed: Boolean(row.completed)
      });
    });
  });
});

// Delete task
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error deleting task:', err);
      return res.status(500).json({ error: 'Failed to delete task' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.status(204).send();
  });
});

// Toggle task completion
router.patch('/:id/toggle', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error fetching task:', err);
      return res.status(500).json({ error: 'Failed to fetch task' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const newCompleted = !Boolean(row.completed);
    const now = new Date().toISOString();
    
    db.run(
      'UPDATE tasks SET completed = ?, updatedAt = ? WHERE id = ?',
      [newCompleted ? 1 : 0, now, id],
      function(err) {
        if (err) {
          console.error('Error toggling task:', err);
          return res.status(500).json({ error: 'Failed to toggle task' });
        }
        
        res.json({
          ...row,
          completed: newCompleted,
          updatedAt: now
        });
      }
    );
  });
});

module.exports = router;
