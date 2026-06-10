import fs from "fs";
import path from "path";
import { joinUpload, publicUrlFor } from "../../utils/filePaths.js";

function esc(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function makePdf(lines) {
  const content = ["BT", "/F1 11 Tf", "50 800 Td", "15 TL"];
  for (const l of lines) {
    content.push(`(${esc(l)}) Tj`);
    content.push("T*");
  }
  content.push("ET");
  const stream = content.join("\n");

  const objs = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offs = [0];
  for (const o of objs) {
    offs.push(Buffer.byteLength(pdf));
    pdf += o;
  }
  const x = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i += 1) pdf += `${String(offs[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(pdf);
}

export async function generateInvoicePdf(invoice) {
  const dir = joinUpload("billing", "invoices");
  fs.mkdirSync(dir, { recursive: true });

  const file = `${invoice.invoice_no}.pdf`;
  const abs = path.join(dir, file);
  const rel = path.join("uploads", "billing", "invoices", file).replace(/\\/g, "/");

  const lines = [
    "Vertex Real Estate - Invoice/Receipt",
    `No: ${invoice.invoice_no}`,
    `Kind: ${invoice.invoice_kind || "Invoice"}`,
    `Type: ${invoice.type}`,
    `Date: ${invoice.invoice_date}`,
    `Base Amount: ${Number(invoice.amount || 0).toFixed(2)}`,
    `GST Rate: ${Number(invoice.gst_rate || 0).toFixed(2)}%`,
    `GST Amount: ${Number(invoice.gst_amount || 0).toFixed(2)}`,
    `Total Amount: ${Number(invoice.total_amount || invoice.amount || 0).toFixed(2)}`,
    `Total Paid: ${Number(invoice.total_paid || 0).toFixed(2)}`,
    `Due: ${Number(invoice.amount_due || 0).toFixed(2)}`,
    `Status: ${invoice.status}`,
    `Generated At: ${new Date().toISOString()}`,
  ];

  fs.writeFileSync(abs, makePdf(lines));
  return { path: rel, url: publicUrlFor(rel) };
}
