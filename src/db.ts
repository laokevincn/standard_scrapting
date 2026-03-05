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
    url_csres TEXT,
    url_samr TEXT,
    publish_date TEXT,
    replace_standard TEXT,
    standard_category TEXT,
    ccs_code TEXT,
    ics_code TEXT,
    execution_unit TEXT,
    competent_department TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS standard_prefixes (
    prefix TEXT UNIQUE PRIMARY KEY,
    last_scraped_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS api_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    token TEXT UNIQUE,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

export interface StandardRecord {
  std_num: string;
  title: string;
  department: string;
  implement_date: string;
  status: string;
  url: string;
  url_csres?: string;
  url_samr?: string;
  publish_date?: string;
  replace_standard?: string;
  standard_category?: string;
  ccs_code?: string;
  ics_code?: string;
  execution_unit?: string;
  competent_department?: string;
}

export function insertOrUpdateStandard(std: StandardRecord) {
  const stmt = db.prepare(`
    INSERT INTO standards (
      std_num, title, department, implement_date, status, url, 
      url_csres, url_samr, publish_date, replace_standard, standard_category, 
      ccs_code, ics_code, execution_unit, competent_department, updated_at
    )
    VALUES (
      @std_num, @title, @department, @implement_date, @status, @url, 
      @url_csres, @url_samr, @publish_date, @replace_standard, @standard_category, 
      @ccs_code, @ics_code, @execution_unit, @competent_department, CURRENT_TIMESTAMP
    )
    ON CONFLICT(std_num) DO UPDATE SET
      title = COALESCE(@title, title),
      department = COALESCE(@department, department),
      implement_date = COALESCE(@implement_date, implement_date),
      status = COALESCE(@status, status),
      url = COALESCE(@url, url),
      url_csres = COALESCE(@url_csres, url_csres),
      url_samr = COALESCE(@url_samr, url_samr),
      publish_date = COALESCE(@publish_date, publish_date),
      replace_standard = COALESCE(@replace_standard, replace_standard),
      standard_category = COALESCE(@standard_category, standard_category),
      ccs_code = COALESCE(@ccs_code, ccs_code),
      ics_code = COALESCE(@ics_code, ics_code),
      execution_unit = COALESCE(@execution_unit, execution_unit),
      competent_department = COALESCE(@competent_department, competent_department),
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run({
    ...std,
    url_csres: std.url_csres || null,
    url_samr: std.url_samr || null,
    publish_date: std.publish_date || null,
    replace_standard: std.replace_standard || null,
    standard_category: std.standard_category || null,
    ccs_code: std.ccs_code || null,
    ics_code: std.ics_code || null,
    execution_unit: std.execution_unit || null,
    competent_department: std.competent_department || null,
  });

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

export function getStandards(query: string, limit: number, offset: number, sortBy: string = 'updated_at', sortOrder: string = 'desc') {
  // Define allowed columns for sorting to prevent SQL injection
  const allowedColumns = [
    'id', 'std_num', 'title', 'department', 'implement_date',
    'status', 'publish_date', 'standard_category', 'updated_at'
  ];

  const safeSortBy = allowedColumns.includes(sortBy) ? sortBy : 'updated_at';
  const safeSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  if (query) {
    const words = query.trim().split(/\s+/);
    const conditions = words.map(() => '(REPLACE(std_num, \' \', \'\') LIKE ? OR title LIKE ?)').join(' AND ');
    const params = words.flatMap(w => {
      const normalizedWord = w.replace(/\s+/g, '');
      return [`%${normalizedWord}%`, `%${w}%`];
    });

    // Sort logic applies to search results as well
    const stmt = db.prepare(`SELECT * FROM standards WHERE ${conditions} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`);
    return stmt.all(...params, limit, offset);
  } else {
    const stmt = db.prepare(`SELECT * FROM standards ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`);
    return stmt.all(limit, offset);
  }
}

export function getStandardCount(query: string) {
  if (query) {
    const words = query.trim().split(/\s+/);
    const conditions = words.map(() => '(REPLACE(std_num, \' \', \'\') LIKE ? OR title LIKE ?)').join(' AND ');
    const params = words.flatMap(w => {
      const normalizedWord = w.replace(/\s+/g, '');
      return [`%${normalizedWord}%`, `%${w}%`];
    });

    const stmt = db.prepare(`SELECT COUNT(*) as count FROM standards WHERE ${conditions}`);
    return (stmt.get(...params) as any).count;
  } else {
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM standards`);
    return (stmt.get() as any).count;
  }
}

export function getStandardById(id: number) {
  const stmt = db.prepare(`SELECT * FROM standards WHERE id = ?`);
  return stmt.get(id) as StandardRecord | undefined;
}

export function getStandardsWithoutDetails(limit: number = 10) {
  const stmt = db.prepare(`
    SELECT * FROM standards 
    WHERE publish_date IS NULL AND (url_csres IS NOT NULL OR url_samr IS NOT NULL)
    ORDER BY updated_at ASC
    LIMIT ?
  `);
  return stmt.all(limit) as StandardRecord[];
}

export function updateStandardDetails(std_num: string, details: Partial<StandardRecord>) {
  const setClauses = [];
  const params: any = { std_num };

  for (const [key, value] of Object.entries(details)) {
    if (value !== undefined) {
      setClauses.push(`${key} = @${key}`);
      params[key] = value;
    }
  }

  if (setClauses.length === 0) return;

  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

  const stmt = db.prepare(`
    UPDATE standards 
    SET ${setClauses.join(', ')}
    WHERE std_num = @std_num
  `);

  stmt.run(params);
}
