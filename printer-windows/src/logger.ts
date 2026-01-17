import * as fs from 'fs';
import * as path from 'path';

/**
 * Simple logger for Windows service
 */
export class Logger {
  private logFile: string;
  private logStream: fs.WriteStream | null = null;

  constructor(logFileName: string = 'beepost-printer.log') {
    // Log file in same directory as exe
    const exeDir = path.dirname(process.execPath);
    this.logFile = path.join(exeDir, logFileName);

    try {
      this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    } catch (err) {
      console.error('Could not create log file:', err);
    }
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private write(level: string, message: string, ...args: any[]): void {
    const timestamp = this.getTimestamp();
    const formattedMessage = `[${timestamp}] [${level}] ${message} ${args.length ? JSON.stringify(args) : ''}`;

    // Console
    console.log(formattedMessage);

    // File
    if (this.logStream) {
      this.logStream.write(formattedMessage + '\n');
    }
  }

  info(message: string, ...args: any[]): void {
    this.write('INFO', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.write('ERROR', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.write('WARN', message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.write('DEBUG', message, ...args);
  }

  success(message: string, ...args: any[]): void {
    this.write('SUCCESS', message, ...args);
  }

  close(): void {
    if (this.logStream) {
      this.logStream.end();
    }
  }
}

export const logger = new Logger();
