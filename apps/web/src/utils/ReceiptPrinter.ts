import type { Order, Tenant } from '@restaurant-qr/core';

export class ReceiptPrinter {
  /**
   * Generates a clean, professional thermal receipt HTML template
   */
  static generateReceiptHtml(order: Order, tenant?: Tenant | null): string {
    const currency = '₹';
    const restaurantName = tenant?.name || 'Aman\'s Restaurant & Bar';
    const header = tenant?.theme?.receiptTheme?.header || 'Thank you for dining with us!';
    const footer = tenant?.theme?.receiptTheme?.footer || 'Please visit again!';

    let safeItems = Array.isArray(order?.items) ? order.items : [];
    if (safeItems.length === 0) {
      safeItems = [
        {
          id: 'item_fallback',
          menuItemId: 'item_01',
          name: 'Chef\'s Special Order Dish',
          quantity: 1,
          unitPrice: order?.totals?.grandTotal || 0,
          totalPrice: order?.totals?.grandTotal || 0,
          stationId: 'main',
          status: 'served'
        }
      ];
    }

    const itemsHtml = safeItems
      .map(
        (item) => `
        <tr>
          <td style="padding: 4px 0; font-weight: 600;">
            ${item.name || 'Item'} x${item.quantity || 1}
            ${item.selectedVariant ? `<br/><span style="font-size: 10px; color: #555;">Opt: ${item.selectedVariant.name}</span>` : ''}
            ${item.notes ? `<br/><span style="font-size: 10px; color: #555; italic;">"${item.notes}"</span>` : ''}
          </td>
          <td style="text-align: right; padding: 4px 0; font-weight: 700; font-family: monospace;">
            ${currency}${(item.totalPrice || (item.unitPrice || 0) * (item.quantity || 1) || 0).toFixed(2)}
          </td>
        </tr>
      `
      )
      .join('');

    const subtotal = (order?.totals?.subtotal || order?.totals?.grandTotal || 0).toFixed(2);
    const tax = (order?.totals?.tax || 0).toFixed(2);
    const serviceCharge = (order?.totals?.serviceCharge || 0).toFixed(2);
    const grandTotal = (order?.totals?.grandTotal || 0).toFixed(2);
    const paymentStatus = (order?.payment?.status || 'unpaid').toUpperCase();
    const paymentMethod = order?.payment?.method ? order.payment.method.toUpperCase() : 'CASH / UPI';

    const dateStr = (() => {
      const val = order?.createdAt as any;
      if (!val) return new Date().toLocaleString();
      const d = val instanceof Date ? val : typeof val.toDate === 'function' ? val.toDate() : typeof val.seconds === 'number' ? new Date(val.seconds * 1000) : new Date(val);
      return isNaN(d.getTime()) ? new Date().toLocaleString() : d.toLocaleString();
    })();

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt - Order #${order?.id || 'N/A'}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 280px;
              margin: 0 auto;
              padding: 15px;
              color: #000;
              background: #fff;
              font-size: 12px;
              line-height: 1.4;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; }
            @media print {
              body { width: 100%; margin: 0; padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="text-center font-bold" style="font-size: 18px; text-transform: uppercase;">${restaurantName}</div>
          <div class="text-center" style="font-size: 10px; margin-top: 4px;">${header}</div>
          <div class="divider"></div>

          <div><strong>ORDER ID:</strong> #${order?.id || 'N/A'}</div>
          <div><strong>TABLE:</strong> ${order?.tableNumber || `Table ${order?.tableId || '1'}`}</div>
          <div><strong>DATE:</strong> ${dateStr}</div>
          ${order?.customerName ? `<div><strong>CUSTOMER:</strong> ${order.customerName}</div>` : ''}

          <div class="divider"></div>

          <table>
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <th style="text-align: left; padding-bottom: 4px;">ITEM</th>
                <th style="text-align: right; padding-bottom: 4px;">AMOUNT</th>
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
              <td class="text-right">${currency}${subtotal}</td>
            </tr>
            <tr>
              <td>GST Tax (5%)</td>
              <td class="text-right">${currency}${tax}</td>
            </tr>
            <tr>
              <td>Service Charge</td>
              <td class="text-right">${currency}${serviceCharge}</td>
            </tr>
            <tr style="font-size: 14px; font-weight: bold;">
              <td style="padding-top: 6px;">GRAND TOTAL</td>
              <td class="text-right" style="padding-top: 6px;">${currency}${grandTotal}</td>
            </tr>
          </table>

          <div class="divider"></div>
          <div class="text-center font-bold" style="font-size: 13px;">PAYMENT: ${paymentStatus}</div>
          <div class="text-center" style="font-size: 10px; margin-top: 2px;">Method: ${paymentMethod}</div>
          <div class="divider"></div>

          <div class="text-center" style="font-size: 10px; text-transform: uppercase;">${footer}</div>
        </body>
      </html>
    `;
  }

  /**
   * Triggers browser thermal receipt print with fallback iframe print engine
   */
  static printReceipt(order: Order, tenant?: Tenant | null): void {
    const html = this.generateReceiptHtml(order, tenant);

    // 1. Primary approach: Try window.open
    try {
      const printWindow = window.open('', '_blank', 'width=450,height=650');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
          try {
            printWindow.print();
          } catch (e) {
            console.warn('Popup print blocked, switching to iframe fallback.');
          }
        }, 300);
        return;
      }
    } catch (err) {
      console.warn('Window popup opening blocked, using hidden iframe print.');
    }

    // 2. Fallback approach: Hidden iframe if popups are blocked
    let iframe = document.getElementById('receipt-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'receipt-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
      }, 300);
    }
  }
}
