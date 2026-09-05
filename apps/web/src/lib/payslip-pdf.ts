import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { monthName, type Payslip } from "@/lib/api/payroll";

// Matches PayslipDocument's on-screen constant — kept as its own copy here
// (not shared) since this file has no React dependency and stays usable
// from a plain download handler.
const PAYSLIP_ISSUER = {
  name: "Expetize Private Limited",
  addressLine: "47, Vijay Block, Ground Floor, Laxmi Nagar, Delhi - 110092",
  cin: "U74999DL2016PTC307712",
  registrationNumber: "307712",
};

// jsPDF's built-in fonts (WinAnsi-encoded) don't include the ₹ glyph, so it
// renders as a blank box. "Rs." is the standard workaround for
// client-generated PDFs and keeps the amount identical otherwise (no
// thousands separator, trailing ".5" left as-is) to match a real issued
// payslip's formatting.
function money(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return `Rs. ${rounded}`;
}

function labelValue(doc: jsPDF, x: number, y: number, label: string, value: string) {
  doc.setFont("helvetica", "bold");
  doc.text(label, x, y);
  const w = doc.getTextWidth(`${label} `);
  doc.setFont("helvetica", "normal");
  doc.text(value, x + w, y);
}

export function downloadPayslipPdf(payslip: Payslip): void {
  const employee = payslip.employee;
  const earnings = payslip.lineItems.filter((i) => i.type === "EARNING");
  const deductions = payslip.lineItems.filter((i) => i.type === "DEDUCTION");
  const totalEarning = earnings.reduce((sum, i) => sum + i.amount, 0);
  const totalDeduction = deductions.reduce((sum, i) => sum + i.amount, 0);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageCenter = 105;
  const innerX = 15;
  const innerWidth = 180;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(PAYSLIP_ISSUER.name, pageCenter, y, { align: "center" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(PAYSLIP_ISSUER.addressLine, pageCenter, y, { align: "center" });
  y += 5;
  doc.text(
    `CIN : ${PAYSLIP_ISSUER.cin} | Registration Number : ${PAYSLIP_ISSUER.registrationNumber}`,
    pageCenter,
    y,
    { align: "center" },
  );
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Payslip for the Month of ${monthName(payslip.periodMonth)}, ${payslip.periodYear}`, pageCenter, y, {
    align: "center",
  });
  y += 8;

  // Two-column employee/bank info box
  const infoTop = y;
  const infoHeight = 30;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(innerX, infoTop, innerWidth, infoHeight);
  doc.line(pageCenter, infoTop, pageCenter, infoTop + infoHeight);

  doc.setFontSize(9);
  const leftX = innerX + 4;
  const rightX = pageCenter + 4;
  let ly = infoTop + 7;
  labelValue(doc, leftX, ly, "Name :", employee ? `${employee.firstName} ${employee.lastName}` : "—");
  labelValue(doc, rightX, ly, "Employee ID :", employee?.employeeCode ?? "—");
  ly += 6;
  labelValue(doc, leftX, ly, "Designation :", employee?.designation?.title ?? "—");
  labelValue(doc, rightX, ly, "Bank :", employee?.bankDetail?.bankName ?? "—");
  ly += 6;
  labelValue(doc, leftX, ly, "Department :", employee?.department?.name ?? "—");
  labelValue(doc, rightX, ly, "Account :", employee?.bankDetail?.accountNumber ?? "—");
  ly += 6;
  labelValue(doc, rightX, ly, "IFSC :", employee?.bankDetail?.ifscCode ?? "—");

  y = infoTop + infoHeight + 6;

  const rowCount = Math.max(earnings.length, deductions.length);
  const body: string[][] = [];
  for (let i = 0; i < rowCount; i++) {
    body.push([
      earnings[i]?.label ?? "",
      earnings[i] ? money(earnings[i].amount) : "",
      deductions[i]?.label ?? "",
      deductions[i] ? money(deductions[i].amount) : "",
    ]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: innerX, right: innerX },
    head: [["Earning", "Amount", "Deduction", "Amount"]],
    body,
    foot: [["Total Earning", money(totalEarning), "Total Deduction", money(totalDeduction)]],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: 20 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
    footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: "bold" },
    columnStyles: {
      1: { halign: "right" },
      3: { halign: "right" },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable augments jsPDF's instance type at runtime only
  const finalY = (doc as any).lastAutoTable.finalY as number;

  const netTop = finalY + 6;
  const netHeight = 12;
  doc.rect(innerX, netTop, innerWidth, netHeight);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Net Pay : ${money(payslip.netAmount)}`, pageCenter, netTop + 8, { align: "center" });

  // Outer border framing the whole slip, matching the legacy layout
  doc.setLineWidth(0.3);
  doc.rect(innerX - 5, 10, innerWidth + 10, netTop + netHeight + 6 - 10);

  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : "Payslip";
  doc.save(`${employeeName}_${monthName(payslip.periodMonth)}_${payslip.periodYear}.pdf`);
}
