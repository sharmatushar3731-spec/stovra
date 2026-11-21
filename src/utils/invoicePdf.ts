import type { Booking } from '../types';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadBookingInvoiceHtml(booking: Booking, customerName: string, customerEmail: string) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>STOVRA Tax Invoice - ${esc(booking.bookingCode)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; max-width: 780px; margin: 40px auto; padding: 24px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0B1F3A; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 24px; font-weight: 800; color: #0B1F3A; letter-spacing: -0.02em; }
    .meta { text-align: right; font-size: 13px; color: #475569; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; }
    th { background: #f8fafc; color: #334155; font-size: 12px; text-transform: uppercase; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .total { font-size: 16px; font-weight: 700; color: #0B1F3A; }
    .foot { margin-top: 32px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">STOVRA</div>
      <div style="font-size:12px;color:#0D9488;font-weight:600;">Your Space. Your Control.</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">GSTIN: 29AABCS1429B1Z5 · SAC: 996729</div>
    </div>
    <div class="meta">
      <div><strong>TAX INVOICE / RECEIPT</strong></div>
      <div>Booking Ref: <strong>${esc(booking.bookingCode)}</strong></div>
      <div>Issued: ${esc(new Date().toLocaleDateString('en-IN'))}</div>
      <div>Status: ${esc(booking.paymentStatus.toUpperCase())}</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <strong>Billed To</strong><br/>
      ${esc(customerName)}<br/>
      ${esc(customerEmail)}
    </div>
    <div>
      <strong>Storage Facility</strong><br/>
      ${esc(booking.facilityName)}<br/>
      ${esc(booking.facilityAddress)}<br/>
      Unit: ${esc(booking.unitCode)} (${esc(booking.unitSizeLabel)})
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Period</th>
        <th class="num">Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Smart Storage Rental — ${esc(booking.unitSizeLabel)}</td>
        <td>${esc(booking.checkInDate)} to ${esc(booking.checkOutDate)} (${esc(booking.durationCount)} ${esc(booking.durationType)})</td>
        <td class="num">₹${booking.subtotal.toLocaleString('en-IN')}</td>
      </tr>
      ${booking.discountAmount > 0 ? `
      <tr>
        <td>Promo Discount (${esc(booking.promoCode)})</td>
        <td>Applied</td>
        <td class="num">-₹${booking.discountAmount.toLocaleString('en-IN')}</td>
      </tr>` : ''}
      <tr>
        <td>CGST + SGST (18%)</td>
        <td>SAC 996729</td>
        <td class="num">₹${booking.gstAmount.toLocaleString('en-IN')}</td>
      </tr>
      <tr class="total">
        <td colspan="2">Total Invoice Amount</td>
        <td class="num">₹${booking.totalAmount.toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td colspan="2">Paid to Date</td>
        <td class="num">₹${booking.paidAmount.toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td colspan="2">Balance Due</td>
        <td class="num">₹${Math.max(0, booking.totalAmount - booking.paidAmount).toLocaleString('en-IN')}</td>
      </tr>
    </tbody>
  </table>

  <div class="foot">
    Authorized Digital Verification Token: <code>${esc(booking.qrToken)}</code><br/>
    This is a computer-generated GST tax invoice from STOVRA Smart Storage Technologies Pvt. Ltd.
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `STOVRA-Invoice-${booking.bookingCode}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
