import path from "node:path";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { COMPANY, type PayslipEmployeeContext, type PayslipLine } from "@/lib/payroll/types";
import { formatMoney } from "@/lib/payroll/totals";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#171717",
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E3E8EF",
  },
  logo: {
    width: 120,
    height: 32,
    objectFit: "contain",
  },
  companyBlock: {
    alignItems: "flex-end",
  },
  companyName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  companyLine: {
    fontSize: 8,
    color: "#667085",
    lineHeight: 1.4,
  },
  title: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  period: {
    fontSize: 9,
    color: "#667085",
    marginBottom: 16,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#667085",
    marginBottom: 6,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  metaItem: {
    width: "50%",
    flexDirection: "row",
    marginBottom: 5,
    paddingRight: 8,
  },
  metaLabel: {
    width: 88,
    color: "#667085",
  },
  metaValue: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
  },
  table: {
    borderWidth: 1,
    borderColor: "#E3E8EF",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F5F7FB",
    borderBottomWidth: 1,
    borderBottomColor: "#E3E8EF",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E3E8EF",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  colDesc: {
    flex: 1,
  },
  colAmount: {
    width: 110,
    textAlign: "right",
  },
  headerText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#667085",
  },
  totalRow: {
    flexDirection: "row",
    backgroundColor: "#F5F7FB",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#E3E8EF",
  },
  totalLabel: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
  },
  totalAmount: {
    width: 110,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  netBlock: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: "#171717",
  },
  netLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  netAmount: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  bankRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E3E8EF",
  },
  bankCell: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: "#E3E8EF",
  },
  bankCellLast: {
    borderRightWidth: 0,
  },
  bankLabel: {
    fontSize: 7,
    color: "#667085",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  bankValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  signatures: {
    flexDirection: "row",
    marginTop: 28,
    gap: 24,
  },
  signatureBox: {
    flex: 1,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#171717",
    marginBottom: 4,
    height: 28,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#667085",
  },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 24,
    fontSize: 8,
    color: "#667085",
    borderTopWidth: 1,
    borderTopColor: "#E3E8EF",
    paddingTop: 8,
  },
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value || "-"}</Text>
    </View>
  );
}

function LineTable({
  title,
  lines,
  currency,
  totalLabel,
  totalAmount,
}: {
  title: string;
  lines: PayslipLine[];
  currency: string;
  totalLabel?: string;
  totalAmount?: number;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.colDesc, styles.headerText]}>Description</Text>
          <Text style={[styles.colAmount, styles.headerText]}>
            Amount ({currency})
          </Text>
        </View>
        {lines.map((line, index) => (
          <View
            key={line.id || `${line.code}-${index}`}
            style={[
              styles.tableRow,
              index === lines.length - 1 && !totalLabel
                ? styles.tableRowLast
                : {},
            ]}
          >
            <Text style={styles.colDesc}>{line.label}</Text>
            <Text style={styles.colAmount}>
              {line.amount.toLocaleString("en-GH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
        ))}
        {totalLabel !== undefined && totalAmount !== undefined ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{totalLabel}</Text>
            <Text style={styles.totalAmount}>
              {totalAmount.toLocaleString("en-GH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export interface PayslipDocumentProps {
  employee: PayslipEmployeeContext;
  reference?: string | null;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  lines: PayslipLine[];
}

export function PayslipDocument({
  employee,
  reference,
  periodLabel,
  periodStart,
  periodEnd,
  currency,
  grossPay,
  totalDeductions,
  netPay,
  lines,
}: PayslipDocumentProps) {
  const logoPath = path.join(
    process.cwd(),
    "public/logos/JA_logo_black_text.png",
  );

  const earnings = lines.filter((line) => line.kind === "earning");
  const deductions = lines.filter((line) => line.kind === "deduction");
  const employer = lines.filter(
    (line) => line.kind === "employer_contribution",
  );

  const periodRange = `${formatDate(periodStart)} to ${formatDate(periodEnd)}`;

  return (
    <Document
      title={`Payslip - ${periodLabel}`}
      author={COMPANY.name}
      subject={`Payslip for ${employee.full_name}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* react-pdf's Image has no alt prop; PDFs carry no image alt text. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={logoPath} style={styles.logo} />
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{COMPANY.name}</Text>
            {COMPANY.addressLines.map((line) => (
              <Text key={line} style={styles.companyLine}>
                {line}
              </Text>
            ))}
          </View>
        </View>

        <Text style={styles.title}>Pay Slip - {periodLabel}</Text>
        <Text style={styles.period}>{periodRange}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employee</Text>
          <View style={styles.metaGrid}>
            <Field label="Name" value={employee.full_name} />
            <Field
              label="Payroll No."
              value={employee.employee_number ?? ""}
            />
            {reference ? (
              <Field label="Payslip ref." value={reference} />
            ) : null}
            <Field
              label="Department"
              value={employee.department_name ?? ""}
            />
            <Field label="Designation" value={employee.job_title ?? ""} />
            <Field label="SSNIT No." value={employee.ssnit_number ?? ""} />
            <Field label="TIN No." value={employee.tin_number ?? ""} />
            <Field
              label="National ID No."
              value={employee.national_id ?? ""}
            />
          </View>
        </View>

        <LineTable
          title="Earnings"
          lines={earnings}
          currency={currency}
          totalLabel="GROSS PAY"
          totalAmount={grossPay}
        />

        <LineTable
          title="Deductions"
          lines={deductions}
          currency={currency}
          totalLabel="TOTAL DEDUCTIONS"
          totalAmount={totalDeductions}
        />

        <View style={styles.netBlock}>
          <Text style={styles.netLabel}>NET PAY</Text>
          <Text style={styles.netAmount}>
            {formatMoney(netPay, currency)}
          </Text>
        </View>

        {employer.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            <LineTable
              title="Employer contributions"
              lines={employer}
              currency={currency}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bank details</Text>
          <View style={styles.bankRow}>
            <View style={styles.bankCell}>
              <Text style={styles.bankLabel}>Bank name</Text>
              <Text style={styles.bankValue}>
                {employee.bank_name || "-"}
              </Text>
            </View>
            <View style={styles.bankCell}>
              <Text style={styles.bankLabel}>Branch</Text>
              <Text style={styles.bankValue}>
                {employee.bank_branch || "-"}
              </Text>
            </View>
            <View style={[styles.bankCell, styles.bankCellLast]}>
              <Text style={styles.bankLabel}>Account no.</Text>
              <Text style={styles.bankValue}>
                {employee.account_number || "-"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.signatures}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Employee signature</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Authorised signature</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          {reference ? `Ref ${reference}. ` : ""}
          {COMPANY.queryNote}
        </Text>
      </Page>
    </Document>
  );
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}
