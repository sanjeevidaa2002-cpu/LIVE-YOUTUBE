import fs from 'fs';
import path from 'path';

export interface CookieInfo {
  configured: boolean;
  count: number;
  hasYouTubeAuth: boolean;
  fileSize: number;
  updatedAt?: string;
  source?: string;
}

export class CookiesService {
  private static DATA_DIR = path.resolve(process.cwd(), 'data');
  private static COOKIES_FILE = path.join(CookiesService.DATA_DIR, 'cookies.txt');

  /**
   * Ensure directory exists and initialize from environment if set
   */
  public static init() {
    if (!fs.existsSync(this.DATA_DIR)) {
      try {
        fs.mkdirSync(this.DATA_DIR, { recursive: true });
      } catch {}
    }

    // If YOUTUBE_COOKIES environment variable is provided and cookies.txt doesn't exist, populate it
    if (process.env.YOUTUBE_COOKIES && !fs.existsSync(this.COOKIES_FILE)) {
      try {
        this.saveCookies(process.env.YOUTUBE_COOKIES);
        console.log('[Cookies Service] Initialized cookies from YOUTUBE_COOKIES environment variable.');
      } catch (e) {
        console.warn('[Cookies Service] Failed to initialize cookies from env:', e);
      }
    }
  }

  /**
   * Returns the path to cookies.txt if it exists and is valid for yt-dlp
   */
  public static getCookiesPath(): string | null {
    this.init();

    // 1. Explicit file in data directory
    if (fs.existsSync(this.COOKIES_FILE)) {
      try {
        const stat = fs.statSync(this.COOKIES_FILE);
        if (stat.size > 10) {
          return this.COOKIES_FILE;
        }
      } catch {}
    }

    // 2. Custom path from env
    if (process.env.YOUTUBE_COOKIES_FILE && fs.existsSync(process.env.YOUTUBE_COOKIES_FILE)) {
      return process.env.YOUTUBE_COOKIES_FILE;
    }

    return null;
  }

  /**
   * Check if valid cookies are available
   */
  public static hasCookies(): boolean {
    return this.getCookiesPath() !== null;
  }

  /**
   * Get detailed status of current cookies configuration
   */
  public static getCookiesInfo(): CookieInfo {
    const cookiesPath = this.getCookiesPath();
    if (!cookiesPath || !fs.existsSync(cookiesPath)) {
      return {
        configured: false,
        count: 0,
        hasYouTubeAuth: false,
        fileSize: 0,
      };
    }

    try {
      const content = fs.readFileSync(cookiesPath, 'utf-8');
      const stat = fs.statSync(cookiesPath);
      const lines = content.split('\n');

      let count = 0;
      let hasYouTubeAuth = false;

      const authKeys = ['LOGIN_INFO', 'SID', 'HSID', 'SSID', 'SAPISID', '__Secure-3PSID', '__Secure-1PSID', 'VISITOR_INFO1_LIVE'];

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const parts = line.split(/\t+|\s{2,}/);
        if (parts.length >= 7) {
          count++;
          const name = parts[5];
          const domain = parts[0];
          if ((domain.includes('youtube.com') || domain.includes('google.com')) && authKeys.includes(name)) {
            hasYouTubeAuth = true;
          }
        } else if (line.includes('=')) {
          count++;
          for (const key of authKeys) {
            if (line.includes(key)) hasYouTubeAuth = true;
          }
        }
      }

      return {
        configured: count > 0,
        count,
        hasYouTubeAuth,
        fileSize: stat.size,
        updatedAt: stat.mtime.toISOString(),
        source: path.basename(cookiesPath),
      };
    } catch {
      return {
        configured: false,
        count: 0,
        hasYouTubeAuth: false,
        fileSize: 0,
      };
    }
  }

  /**
   * Save cookies content (supports Netscape format and JSON format from browser extensions)
   */
  public static saveCookies(rawInput: string): { success: boolean; count: number; hasYouTubeAuth: boolean; message: string } {
    this.init();

    if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
      throw new Error('Cookies content is empty.');
    }

    const trimmed = rawInput.trim();
    let netscapeLines: string[] = [];

    // Check if user pasted JSON array from extensions like Cookie-Editor / EditThisCookie
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const jsonCookies = JSON.parse(trimmed);
        if (Array.isArray(jsonCookies)) {
          netscapeLines.push('# Netscape HTTP Cookie File');
          netscapeLines.push('# Converted from JSON by StreamLoop Cookies Service');
          
          for (const c of jsonCookies) {
            if (!c.name || c.value === undefined) continue;
            const domain = c.domain || '.youtube.com';
            const flag = domain.startsWith('.') ? 'TRUE' : 'FALSE';
            const cookiePath = c.path || '/';
            const secure = c.secure ? 'TRUE' : 'FALSE';
            const expiration = Math.floor(c.expirationDate || (Date.now() / 1000 + 86400 * 365));
            const name = c.name;
            const value = c.value;
            netscapeLines.push(`${domain}\t${flag}\t${cookiePath}\t${secure}\t${expiration}\t${name}\t${value}`);
          }
        }
      } catch (err: any) {
        throw new Error(`Failed to parse JSON cookies: ${err.message}`);
      }
    } else {
      // Netscape or raw text
      const rawLines = trimmed.split('\n');
      let headerPresent = false;

      for (const l of rawLines) {
        const line = l.trim();
        if (line.startsWith('# Netscape HTTP Cookie File')) {
          headerPresent = true;
          netscapeLines.push(line);
        } else if (line.startsWith('#')) {
          netscapeLines.push(line);
        } else if (line) {
          // Normalize tabs
          const tabbed = l.replace(/\s{2,}/g, '\t').trim();
          netscapeLines.push(tabbed);
        }
      }

      if (!headerPresent) {
        netscapeLines.unshift('# Netscape HTTP Cookie File');
      }
    }

    const finalContent = netscapeLines.join('\n') + '\n';
    fs.writeFileSync(this.COOKIES_FILE, finalContent, 'utf-8');

    const info = this.getCookiesInfo();
    return {
      success: true,
      count: info.count,
      hasYouTubeAuth: info.hasYouTubeAuth,
      message: `Saved ${info.count} cookies successfully${info.hasYouTubeAuth ? ' (YouTube authentication tokens detected)' : ''}.`,
    };
  }

  /**
   * Delete cookies file
   */
  public static clearCookies(): boolean {
    this.init();
    if (fs.existsSync(this.COOKIES_FILE)) {
      try {
        fs.unlinkSync(this.COOKIES_FILE);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }
}
