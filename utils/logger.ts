export function logPage(message: string, url: string): void {
  console.log(`[${new Date().toISOString()}] ${message}: ${url}`);
}
