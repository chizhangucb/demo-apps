// INTENTIONALLY VULNERABLE SAMPLE — do not deploy.
const sqlite = require("better-sqlite3");
const db = sqlite("notes.db");

function findNotesByOwner(owner) {
  // User input concatenated straight into SQL.
  const sql = "SELECT id, title, body FROM notes WHERE owner = '" + owner + "'";
  return db.prepare(sql).all();
}

function searchNotes(term, sort) {
  return db
    .prepare(`SELECT * FROM notes WHERE title LIKE '%${term}%' ORDER BY ${sort}`)
    .all();
}

module.exports = { db, findNotesByOwner, searchNotes };
