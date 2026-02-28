import Database from 'better-sqlite3';

const db = new Database('standards.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS standards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    std_num TEXT UNIQUE,
    title TEXT,
    department TEXT,
    implement_date TEXT,
    status TEXT,
    url TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export interface StandardRecord {
  std_num: string;
  title: string;
  department: string;
  implement_date: string;
  status: string;
  url: string;
}

export function insertOrUpdateStandard(std: StandardRecord) {
  const stmt = db.prepare(`
    INSERT INTO standards (std_num, title, department, implement_date, status, url, updated_at)
    VALUES (@std_num, @title, @department, @implement_date, @status, @url, CURRENT_TIMESTAMP)
    ON CONFLICT(std_num) DO UPDATE SET
      title = @title,
      department = @department,
      implement_date = @implement_date,
      status = @status,
      url = @url,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(std);
}

export function getStandards(query: string, limit: number, offset: number) {
  if (query) {
    const words = query.trim().split(/\s+/);
    const conditions = words.map(() => '(std_num LIKE ? OR title LIKE ?)').join(' AND ');
    const params = words.flatMap(w => [`%${w}%`, `%${w}%`]);
    
    const stmt = db.prepare(`SELECT * FROM standards WHERE ${conditions} ORDER BY std_num ASC LIMIT ? OFFSET ?`);
    return stmt.all(...params, limit, offset);
  } else {
    const stmt = db.prepare(`SELECT * FROM standards ORDER BY updated_at DESC LIMIT ? OFFSET ?`);
    return stmt.all(limit, offset);
  }
}

export function getStandardCount(query: string) {
  if (query) {
    const words = query.trim().split(/\s+/);
    const conditions = words.map(() => '(std_num LIKE ? OR title LIKE ?)').join(' AND ');
    const params = words.flatMap(w => [`%${w}%`, `%${w}%`]);
    
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM standards WHERE ${conditions}`);
    return (stmt.get(...params) as any).count;
  } else {
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM standards`);
    return (stmt.get() as any).count;
  }
}
