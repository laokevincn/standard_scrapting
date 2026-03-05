import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const DB_FILE = path.join(process.cwd(), 'standards.db');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

let backupTask: cron.ScheduledTask | null = null;
let currentSchedule = '';

export interface BackupInfo {
  filename: string;
  size: number;
  createdAt: Date;
}

export function getBackups(): BackupInfo[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  
  const files = fs.readdirSync(BACKUP_DIR);
  return files
    .filter(f => f.endsWith('.db'))
    .map(filename => {
      const stats = fs.statSync(path.join(BACKUP_DIR, filename));
      return {
        filename,
        size: stats.size,
        createdAt: stats.birthtime,
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function createBackup(): BackupInfo {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `standards_backup_${timestamp}.db`;
  const destPath = path.join(BACKUP_DIR, filename);
  
  fs.copyFileSync(DB_FILE, destPath);
  
  const stats = fs.statSync(destPath);
  return {
    filename,
    size: stats.size,
    createdAt: stats.birthtime,
  };
}

export function deleteBackup(filename: string): boolean {
  const filepath = path.join(BACKUP_DIR, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return true;
  }
  return false;
}

export function restoreBackup(filename: string): boolean {
  const filepath = path.join(BACKUP_DIR, filename);
  if (fs.existsSync(filepath)) {
    // Create a backup of the current state before restoring
    createBackup();
    
    // Restore
    fs.copyFileSync(filepath, DB_FILE);
    return true;
  }
  return false;
}

export function getBackupSchedule(): string {
  return currentSchedule;
}

export function setBackupSchedule(cronExpression: string) {
  if (backupTask) {
    backupTask.stop();
  }
  
  if (cronExpression) {
    backupTask = cron.schedule(cronExpression, () => {
      console.log('Running scheduled database backup...');
      try {
        createBackup();
        console.log('Scheduled backup completed successfully.');
      } catch (error) {
        console.error('Error during scheduled backup:', error);
      }
    });
    currentSchedule = cronExpression;
  } else {
    currentSchedule = '';
  }
}

// Default schedule: daily at 3:00 AM
setBackupSchedule('0 3 * * *');
