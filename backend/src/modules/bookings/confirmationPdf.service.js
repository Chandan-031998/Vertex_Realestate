import fs from "fs";
import path from "path";
import { joinUpload, publicUrlFor } from "../../utils/filePaths.js";

function escapePdfText(str) {
  return String(str || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createSimplePdfBuffer(lines) {
  const contentLines = ["BT", "/F1 12 Tf", "50 800 Td", "16 TL"];
  for (const line of lines) {
    contentLines.push(`(${escapePdfText(line)}) Tj`);
    contentLines.push("T*");
  }
  contentLines.push("ET");
  const stream = contentLines.join("\n");

  const objects = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n");
  objects.push(`4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`);
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export async function generateBookingConfirmationPdf({ booking_uid, customerName, propertyLabel, tokenAmount, holdExpiresAt }) {
  const dir = joinUpload("bookings", "confirmations");
  fs.mkdirSync(dir, { recursive: true });

  const fileName = `${booking_uid}.pdf`;
  const abs = path.join(dir, fileName);
  const rel = path.join("uploads", "bookings", "confirmations", fileName).replace(/\\/g, "/");

  const lines = [
    "Vertex Real Estate - Booking Confirmation",
    `Booking UID: ${booking_uid}`,
    `Customer: ${customerName || "-"}`,
    `Property: ${propertyLabel || "-"}`,
    `Token Amount: ${Number(tokenAmount || 0).toFixed(2)}`,
    `Hold Expires At: ${holdExpiresAt || "-"}`,
    `Generated At: ${new Date().toISOString()}`,
  ];

  const pdfBuffer = createSimplePdfBuffer(lines);
  fs.writeFileSync(abs, pdfBuffer);
  return { relPath: rel, url: publicUrlFor(rel) };
}
