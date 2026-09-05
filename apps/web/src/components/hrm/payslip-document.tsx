import { monthName, type Payslip, type PayslipEmployee } from "@/lib/api/payroll";
import { formatDate, formatINR } from "@/lib/format";

// The legal entity that actually issues payslips ("Expetize Private
// Limited") is distinct from the company brand (CompanySettings holds
// "1Solutions") — confirmed against a real legacy-issued payslip PDF and
// the legacy app's own PHP template, which hardcodes this block the same
// way (it isn't pulled from a company table there either). No
// CompanySettings field exists for CIN/registration number, so this stays
// a constant here rather than a half-modeled schema addition.
const PAYSLIP_ISSUER = {
  name: "Expetize Private Limited",
  addressLine1: "47, Vijay Block, Ground Floor, Laxmi Nagar,",
  addressLine2: "Delhi - 110092",
  cin: "U74999DL2016PTC307712",
  registrationNumber: "307712",
};

export function PayslipDocument({ payslip }: { payslip: Payslip }) {
  const earnings = payslip.lineItems.filter((i) => i.type === "EARNING");
  const deductions = payslip.lineItems.filter((i) => i.type === "DEDUCTION");
  const totalEarning = earnings.reduce((sum, i) => sum + i.amount, 0);
  const totalDeduction = deductions.reduce((sum, i) => sum + i.amount, 0);
  const employee: PayslipEmployee | null = payslip.employee;

  return (
    <div className="space-y-4 rounded-lg border p-5">
      <div className="space-y-1 text-center">
        <p className="text-lg font-bold">{PAYSLIP_ISSUER.name}</p>
        <p className="text-muted-foreground text-xs">
          {PAYSLIP_ISSUER.addressLine1}
          <br />
          {PAYSLIP_ISSUER.addressLine2}
        </p>
        <p className="text-muted-foreground text-[11px]">
          CIN : {PAYSLIP_ISSUER.cin} | Registration Number : {PAYSLIP_ISSUER.registrationNumber}
        </p>
      </div>

      <p className="text-center text-sm font-semibold">
        Payslip for the Month of {monthName(payslip.periodMonth)}, {payslip.periodYear}
      </p>

      {employee && (
        <div className="grid grid-cols-2 gap-4 rounded-md border p-3 text-xs">
          <div className="space-y-0.5">
            <p>
              <span className="font-medium">Name :</span> {employee.firstName} {employee.lastName}
            </p>
            <p>
              <span className="font-medium">Designation :</span>{" "}
              {employee.designation?.title ?? "—"}
            </p>
            <p>
              <span className="font-medium">Department :</span> {employee.department?.name ?? "—"}
            </p>
            <p>
              <span className="font-medium">Date of Joining :</span>{" "}
              {formatDate(employee.dateOfJoining)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p>
              <span className="font-medium">Employee ID :</span> {employee.employeeCode}
            </p>
            {employee.bankDetail ? (
              <>
                <p>
                  <span className="font-medium">Bank :</span> {employee.bankDetail.bankName}
                </p>
                <p>
                  <span className="font-medium">Account :</span> {employee.bankDetail.accountNumber}
                </p>
                <p>
                  <span className="font-medium">IFSC :</span> {employee.bankDetail.ifscCode}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No bank details on file</p>
            )}
          </div>
        </div>
      )}

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted">
            <th className="border p-1.5 text-left font-medium">Earning</th>
            <th className="border p-1.5 text-right font-medium">Amount</th>
            <th className="border p-1.5 text-left font-medium">Deduction</th>
            <th className="border p-1.5 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(earnings.length, deductions.length) }).map((_, i) => {
            const e = earnings[i];
            const d = deductions[i];
            return (
              <tr key={i}>
                <td className="border p-1.5">{e?.label ?? ""}</td>
                <td className="border p-1.5 text-right tabular-nums">
                  {e ? formatINR(e.amount) : ""}
                </td>
                <td className="border p-1.5">{d?.label ?? ""}</td>
                <td className="border p-1.5 text-right tabular-nums">
                  {d ? formatINR(d.amount) : ""}
                </td>
              </tr>
            );
          })}
          <tr className="font-semibold">
            <td className="border p-1.5">Total Earning</td>
            <td className="border p-1.5 text-right tabular-nums">{formatINR(totalEarning)}</td>
            <td className="border p-1.5">Total Deduction</td>
            <td className="border p-1.5 text-right tabular-nums">{formatINR(totalDeduction)}</td>
          </tr>
        </tbody>
      </table>

      <div className="rounded-md border p-3 text-center text-sm font-semibold">
        Net Pay : {formatINR(payslip.netAmount)}
      </div>
    </div>
  );
}
