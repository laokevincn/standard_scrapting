import Database from 'better-sqlite3';
import fs from 'fs';
const db = new Database('standards.db');

const rows = db.prepare('SELECT status, COUNT(*) as count FROM standards WHERE publish_date IS NULL GROUP BY status').all();
fs.writeFileSync('db_status.json', JSON.stringify(rows, null, 2));
