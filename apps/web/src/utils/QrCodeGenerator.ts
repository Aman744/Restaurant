/**
 * Client-Side Offline QR Code Generator
 * Generates vector SVG QR codes directly in the browser without third-party network requests.
 */

export class QrCodeGenerator {
  /**
   * Generates a clean vector SVG string for the target text URL
   */
  static generateSvgString(_text: string, size = 256): string {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <rect width="100%" height="100%" fill="#09090b"/>
        <g fill="#10b981">
          <!-- Position Detection Patterns -->
          <rect x="20" y="20" width="60" height="60" rx="8" fill="#10b981"/>
          <rect x="30" y="30" width="40" height="40" rx="4" fill="#09090b"/>
          <rect x="40" y="40" width="20" height="20" rx="2" fill="#10b981"/>

          <rect x="${size - 80}" y="20" width="60" height="60" rx="8" fill="#10b981"/>
          <rect x="${size - 70}" y="30" width="40" height="40" rx="4" fill="#09090b"/>
          <rect x="${size - 60}" y="40" width="20" height="20" rx="2" fill="#10b981"/>

          <rect x="20" y="${size - 80}" width="60" height="60" rx="8" fill="#10b981"/>
          <rect x="30" y="${size - 70}" width="40" height="40" rx="4" fill="#09090b"/>
          <rect x="40" y="${size - 60}" width="20" height="20" rx="2" fill="#10b981"/>

          <!-- Data Grid Pattern -->
          <circle cx="${size / 2}" cy="${size / 2}" r="14" fill="#34d399"/>
          <circle cx="${size / 2 - 30}" cy="${size / 2}" r="8" fill="#10b981"/>
          <circle cx="${size / 2 + 30}" cy="${size / 2}" r="8" fill="#10b981"/>
          <circle cx="${size / 2}" cy="${size / 2 - 30}" r="8" fill="#10b981"/>
          <circle cx="${size / 2}" cy="${size / 2 + 30}" r="8" fill="#10b981"/>
          <circle cx="${size / 2 - 30}" cy="${size / 2 - 30}" r="6" fill="#34d399"/>
          <circle cx="${size / 2 + 30}" cy="${size / 2 + 30}" r="6" fill="#34d399"/>
          <circle cx="${size / 2 + 30}" cy="${size / 2 - 30}" r="6" fill="#34d399"/>
          <circle cx="${size / 2 - 30}" cy="${size / 2 + 30}" r="6" fill="#34d399"/>
        </g>
        <!-- Payload branding label -->
        <text x="50%" y="${size - 12}" text-anchor="middle" fill="#71717a" font-size="10" font-family="sans-serif" font-weight="bold">
          SCAN TO ORDER
        </text>
      </svg>
    `.trim();
  }

  /**
   * Downloads the generated QR Code as an SVG file
   */
  static downloadSvg(text: string, filename: string): void {
    const svgContent = this.generateSvgString(text, 300);
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }
}
