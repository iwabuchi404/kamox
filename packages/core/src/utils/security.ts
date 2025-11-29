import { URL } from 'url';

/**
 * Validates a URL to ensure it is safe to open in a browser.
 * Prevents SSRF and access to local files/network.
 * 
 * @param inputUrl The URL to validate
 * @param options Validation options
 * @throws Error if the URL is invalid or unsafe
 */
export function validateUrl(inputUrl: string, options: { allowLocal?: boolean } = {}): void {
  let url: URL;
  try {
    url = new URL(inputUrl);
  } catch (e) {
    throw new Error('Invalid URL format');
  }

  // 1. Protocol Check
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Protocol '${url.protocol}' is not allowed. Only HTTP/HTTPS are supported.`);
  }

  // 2. Localhost/Private IP Check
  if (!options.allowLocal) {
    const hostname = url.hostname;
    
    // Check for localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      throw new Error('Access to localhost is restricted for security.');
    }

    // Check for private IP ranges (IPv4)
    // 10.0.0.0 - 10.255.255.255
    // 172.16.0.0 - 172.31.255.255
    // 192.168.0.0 - 192.168.255.255
    if (isPrivateIP(hostname)) {
      throw new Error('Access to local network resources is restricted.');
    }
  }
}

function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false; // Not an IPv4 address (or hostname)

  const first = parseInt(parts[0], 10);
  const second = parseInt(parts[1], 10);

  if (isNaN(first) || isNaN(second)) return false;

  // 10.x.x.x
  if (first === 10) return true;

  // 172.16.x.x - 172.31.x.x
  if (first === 172 && second >= 16 && second <= 31) return true;

  // 192.168.x.x
  if (first === 192 && second === 168) return true;

  return false;
}
