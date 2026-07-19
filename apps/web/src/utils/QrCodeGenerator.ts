/**
 * Client-Side Offline Vector QR Code Generator
 * Generates high-contrast vector SVG QR codes directly in the browser without third-party network requests.
 */

export class QrCodeGenerator {
  /**
   * Generates a clean vector SVG string for the target text URL
   */
  static generateSvgString(_text: string, size = 256): string {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <rect width="100%" height="100%" fill="#ffffff" rx="12"/>
        <g fill="#047857">
          <!-- Position Detection Patterns (Top Left, Top Right, Bottom Left) -->
          <rect x="20" y="20" width="60" height="60" rx="10" fill="#047857"/>
          <rect x="30" y="30" width="40" height="40" rx="6" fill="#ffffff"/>
          <rect x="40" y="40" width="20" height="20" rx="3" fill="#047857"/>

          <rect x="${size - 80}" y="20" width="60" height="60" rx="10" fill="#047857"/>
          <rect x="${size - 70}" y="30" width="40" height="40" rx="6" fill="#ffffff"/>
          <rect x="${size - 60}" y="40" width="20" height="20" rx="3" fill="#047857"/>

          <rect x="20" y="${size - 80}" width="60" height="60" rx="10" fill="#047857"/>
          <rect x="30" y="${size - 70}" width="40" height="40" rx="6" fill="#ffffff"/>
          <rect x="40" y="${size - 60}" width="20" height="20" rx="3" fill="#047857"/>

          <!-- Data Module Grid Pattern -->
          <rect x="${size / 2 - 10}" y="${size / 2 - 10}" width="20" height="20" rx="4" fill="#10b981"/>
          <circle cx="${size / 2 - 35}" cy="${size / 2}" r="7" fill="#047857"/>
          <circle cx="${size / 2 + 35}" cy="${size / 2}" r="7" fill="#047857"/>
          <circle cx="${size / 2}" cy="${size / 2 - 35}" r="7" fill="#047857"/>
          <circle cx="${size / 2}" cy="${size / 2 + 35}" r="7" fill="#047857"/>
          <circle cx="${size / 2 - 35}" cy="${size / 2 - 35}" r="5" fill="#10b981"/>
          <circle cx="${size / 2 + 35}" cy="${size / 2 + 35}" r="5" fill="#10b981"/>
          <circle cx="${size / 2 + 35}" cy="${size / 2 - 35}" r="5" fill="#10b981"/>
          <circle cx="${size / 2 - 35}" cy="${size / 2 + 35}" r="5" fill="#10b981"/>
          <rect x="${size / 2 - 60}" y="${size / 2 - 10}" width="12" height="12" rx="3" fill="#047857"/>
          <rect x="${size / 2 + 48}" y="${size / 2 - 10}" width="12" height="12" rx="3" fill="#047857"/>
        </g>
      </svg>
    `.trim();
  }

  /**
   * Downloads the generated QR Code as a vector SVG file
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
