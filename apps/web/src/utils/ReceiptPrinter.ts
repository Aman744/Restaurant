import type { Order, Tenant } from '@restaurant-qr/core';

export class ReceiptPrinter {
  /**
   * Generates a clean HTML thermal receipt template
   */
  static generateReceiptHtml(order: Order, tenant?: Tenant | null): string {
    const currency = '₹';
    const restaurantName = tenant?.name || 'Gourmet Dining';
    const header = tenant?.theme?.receiptTheme?.header || 'Thank you for dining with us!';
    const footer = tenant?.theme?.receiptTheme?.footer || 'Please visit again!';

    const itemsHtml = order.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 4px 0;">${item.name} x${item.quantity}</td>
          <td style="text-align: right; padding: 4px 0;">${currency}${item.totalPrice.toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - Order #${order.id}</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 300px;
              margin: 0 auto;
              padding: 15px;
              color: #000;
              background: #fff;
              font-size: 12px;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; }
          </style>
        </head>
        <body>
          <div class="text-center font-bold" style="font-size: 16px;">${restaurantName}</div>
          <div class="text-center" style="font-size: 10px; margin-top: 4px;">${header}</div>
          <div class="divider"></div>

          <div><strong>Order ID:</strong> ${order.id}</div>
          <div><strong>Table:</strong> ${order.tableNumber || `Table ${order.tableId}`}</div>
          <div><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</div>
          ${order.customerName ? `<div><strong>Customer:</strong> ${order.customerName}</div>` : ''}

          <div class="divider"></div>

          <table>
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <th style="text-align: left; padding-bottom: 4px;">Item</th>
                <th style="text-align: right; padding-bottom: 4px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="divider"></div>

          <table>
            <tr>
              <td>Subtotal</td>
              <td class="text-right">${currency}${order.totals.subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Tax (GST)</td>
              <td class="text-right">${currency}${order.totals.tax.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Service Charge</td>
              <td class="text-right">${currency}${order.totals.serviceCharge.toFixed(2)}</td>
            </tr>
            <tr style="font-size: 14px; font-weight: bold;">
              <td style="padding-top: 6px;">Total</td>
              <td class="text-right" style="padding-top: 6px;">${currency}${order.totals.grandTotal.toFixed(2)}</td>
            </tr>
          </table>

          <div class="divider"></div>
          <div class="text-center font-bold">Payment Status: ${order.payment.status.toUpperCase()}</div>
          ${order.payment.method ? `<div class="text-center" style="font-size: 10px;">Method: ${order.payment.method.toUpperCase()}</div>` : ''}
          <div class="divider"></div>

          <div class="text-center" style="font-size: 10px;">${footer}</div>
        </body>
      </html>
    `;
  }

  /**
   * Triggers the browser print dialog for the generated receipt
   */
  static printReceipt(order: Order, tenant?: Tenant | null): void {
    const html = this.generateReceiptHtml(order, tenant);
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  }
}
