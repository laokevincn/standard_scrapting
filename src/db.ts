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
  );

  CREATE TABLE IF NOT EXISTS standard_prefixes (
    prefix TEXT UNIQUE PRIMARY KEY,
    last_scraped_at DATETIME
  );
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

  // Extract prefix (e.g., GB, DB, JJF) and save it
  const prefixMatch = std.std_num.match(/^[A-Z]+/i);
  if (prefixMatch) {
    const prefix = prefixMatch[0].toUpperCase();
    const prefixStmt = db.prepare(`INSERT OR IGNORE INTO standard_prefixes (prefix) VALUES (?)`);
    prefixStmt.run(prefix);
  }
}

export function getAllPrefixes() {
  const stmt = db.prepare(`SELECT prefix FROM standard_prefixes ORDER BY last_scraped_at ASC NULLS FIRST`);
  return stmt.all() as { prefix: string }[];
}

export function updatePrefixScrapedAt(prefix: string) {
  const stmt = db.prepare(`UPDATE standard_prefixes SET last_scraped_at = CURRENT_TIMESTAMP WHERE prefix = ?`);
  stmt.run(prefix);
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
