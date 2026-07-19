import QRCode from 'qrcode';

/**
 * Client-Side ISO-Standard Camera Scannable QR Code Generator
 * Encodes payload URLs into real ISO/IEC 18004 QR Code matrices directly in the browser.
 */

export class QrCodeGenerator {
  /**
   * Generates a Data URL for rendering standard high-contrast scannable QR images
   */
  static async generateDataUrl(text: string, width = 300): Promise<string> {
    try {
      return await QRCode.toDataURL(text, {
        width,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.error('Failed to generate QR DataURL:', err);
      return '';
    }
  }

  /**
   * Generates a vector SVG string for camera-scannable QR printing
   */
  static async generateSvgString(text: string, width = 300): Promise<string> {
    try {
      return await QRCode.toString(text, {
        type: 'svg',
        width,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.error('Failed to generate QR SVG string:', err);
      return '';
    }
  }

  /**
   * Downloads the generated QR Code as a PNG image file
   */
  static async downloadPng(text: string, filename: string): Promise<void> {
    const dataUrl = await this.generateDataUrl(text, 500);
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
