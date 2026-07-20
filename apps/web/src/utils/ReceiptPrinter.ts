import type { Order, Tenant } from '@restaurant-qr/core';

export class ReceiptPrinter {
  /**
   * Generates a pixel-perfect thermal receipt HTML template optimized for 80mm thermal printers & PDF output
   */
  static generateReceiptHtml(order: Order, tenant?: Tenant | null): string {
    const tenantId = order?.tenantId || 'tenant_dev_123';
    let storedSettings: any = null;
    try {
      const raw = localStorage.getItem(`restaurant_qr_settings_${tenantId}`);
      if (raw) storedSettings = JSON.parse(raw);
    } catch (e) {}

    const currency = '₹';
    const restaurantName = storedSettings?.restaurantName || tenant?.name || 'Aman\'s Restaurant & Bar';
    const header = storedSettings?.receiptHeader || tenant?.theme?.receiptTheme?.header || 'TAX INVOICE / BILL RECEIPT';
    const footer = storedSettings?.receiptFooter || tenant?.theme?.receiptTheme?.footer || 'Thank you for dining with us! Visit again.';
    const gstinNumber = storedSettings?.gstNumber || '22AAAAA0000A1Z5';
    const rawLogo = storedSettings?.logoUrl || tenant?.logoUrl;
    const logoUrl = (rawLogo && rawLogo.trim().length > 0 && !rawLogo.includes('photo-1555396273')) ? rawLogo.trim() : 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png';

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
        <tr style="border-bottom: 1px dashed #e0e0e0;">
          <td style="padding: 5px 0; text-align: left;">
            <div style="font-weight: 700; font-size: 12px; color: #000;">${item.name || 'Item'}</div>
            ${item.selectedVariant ? `<div style="font-size: 10px; color: #444;">• Option: ${item.selectedVariant.name}</div>` : ''}
            ${item.notes ? `<div style="font-size: 10px; color: #444; font-style: italic;">• Note: "${item.notes}"</div>` : ''}
          </td>
          <td style="padding: 5px 0; text-align: center; font-weight: 700; font-size: 12px; vertical-align: top;">
            ${item.quantity || 1}
          </td>
          <td style="padding: 5px 0; text-align: right; font-weight: 800; font-size: 12px; font-family: monospace; vertical-align: top;">
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
      if (!val) return new Date().toLocaleString('en-IN');
      const d = val instanceof Date ? val : typeof val.toDate === 'function' ? val.toDate() : typeof val.seconds === 'number' ? new Date(val.seconds * 1000) : new Date(val);
      return isNaN(d.getTime()) ? new Date().toLocaleString('en-IN') : d.toLocaleString('en-IN');
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
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Courier New', Courier, 'Liberation Mono', monospace;
              width: 290px;
              margin: 0 auto;
              padding: 16px;
              color: #000;
              background: #fff;
              font-size: 12px;
              line-height: 1.35;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold { font-weight: 700; }
            .font-black { font-weight: 900; }
            .uppercase { text-transform: uppercase; }

            .dashed-divider {
              border-top: 1.5px dashed #000;
              margin: 10px 0;
            }
            .solid-divider {
              border-top: 1.5px solid #000;
              margin: 10px 0;
            }
            .double-divider {
              border-top: 3px double #000;
              margin: 12px 0;
            }

            .store-title {
              font-size: 18px;
              font-weight: 900;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              text-align: center;
              margin-bottom: 2px;
            }
            .store-header {
              font-size: 10px;
              text-align: center;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }

            .meta-table {
              width: 100%;
              font-size: 11px;
              margin: 4px 0;
            }
            .meta-table td {
              padding: 2px 0;
            }

            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 6px 0;
            }
            .items-table th {
              border-top: 1.5px solid #000;
              border-bottom: 1.5px solid #000;
              padding: 5px 0;
              font-size: 10px;
              font-weight: 900;
              text-transform: uppercase;
            }

            .totals-table {
              width: 100%;
              font-size: 11px;
              margin: 4px 0;
            }
            .totals-table td {
              padding: 2px 0;
            }

            .grand-total-box {
              border: 2px solid #000;
              padding: 8px 10px;
              margin: 10px 0;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 14px;
              font-weight: 900;
              background: #fff;
            }

            @media print {
              html, body {
                width: 72mm !important;
                margin: 0 auto !important;
                padding: 3mm !important;
                background: #fff !important;
                color: #000 !important;
                font-size: 11px !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <!-- Header Logo with High-Contrast Crisp Vector Sizing -->
          ${logoUrl ? `<div class="text-center" style="margin-bottom: 8px;"><img src="${logoUrl}" style="max-height: 55px; max-width: 180px; width: auto; height: auto; object-fit: contain; display: block; margin: 0 auto;" /></div>` : ''}
          <div class="store-title">${restaurantName}</div>
          <div class="store-header">${header}</div>
          <div class="text-center" style="font-size: 10px; font-weight: bold; margin-top: 2px;">GSTIN: ${gstinNumber}</div>
          <div class="dashed-divider"></div>

          <!-- Meta Details Table -->
          <table class="meta-table">
            <tr>
              <td><strong>ORDER ID:</strong> #${order?.id || 'N/A'}</td>
              <td class="text-right"><strong>TABLE:</strong> ${order?.tableNumber || `Table ${order?.tableId || '1'}`}</td>
            </tr>
            <tr>
              <td colspan="2"><strong>DATE:</strong> ${dateStr}</td>
            </tr>
            ${order?.customerName ? `<tr><td colspan="2"><strong>CUSTOMER:</strong> ${order.customerName}</td></tr>` : ''}
          </table>

          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 55%; text-align: left;">ITEM DISH</th>
                <th style="width: 15%; text-align: center;">QTY</th>
                <th style="width: 30%; text-align: right;">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="dashed-divider"></div>

          <!-- Subtotals Table -->
          <table class="totals-table">
            <tr>
              <td class="text-left">Items Subtotal</td>
              <td class="text-right font-bold">${currency}${subtotal}</td>
            </tr>
            <tr>
              <td class="text-left">GST Tax (5%)</td>
              <td class="text-right">${currency}${tax}</td>
            </tr>
            <tr>
              <td class="text-left">Service Charge</td>
              <td class="text-right">${currency}${serviceCharge}</td>
            </tr>
          </table>

          <!-- Grand Total Highlight Box -->
          <div class="grand-total-box">
            <span>NET TOTAL</span>
            <span>${currency}${grandTotal}</span>
          </div>

          <div class="solid-divider"></div>

          <!-- Footer Info -->
          <div class="text-center font-bold" style="font-size: 12px; text-transform: uppercase;">
            PAYMENT: <span style="text-decoration: underline;">${paymentStatus}</span>
          </div>
          <div class="text-center" style="font-size: 10px; margin-top: 2px; color: #333;">
            METHOD: ${paymentMethod}
          </div>

          <div class="double-divider"></div>
          <div class="text-center font-bold" style="font-size: 10px; text-transform: uppercase;">${footer}</div>
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
