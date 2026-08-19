import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staff/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Movement = "DEBIT" | "CREDIT" | "NEUTRAL";

type Candidate = {
  id: string;
  scope: string;
  title: string;
  subtitle: string;
  details: string;
  amount?: unknown;
  debit?: unknown;
  credit?: unknown;
  status?: unknown;
  reference?: unknown;
  date?: unknown;
  movement: Movement;
  urls: string[];
};

type PreviewContext = {
  companyName: string;
  companyCode: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  staffName: string;
  staffEmail: string;
};

function clean(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function safeArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function unique(values: unknown[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function escapeHtml(value: unknown): string {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function numeric(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function money(value: unknown): string {
  return new Intl.NumberFormat("en-TZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric(value));
}

function dateLabel(value: unknown): string {
  if (!value) return "—";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return clean(value) || "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Dar_es_Salaam",
  }).format(parsed);
}

function yearLabel(value: unknown): string {
  if (!value) return String(new Date().getFullYear());
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? String(new Date().getFullYear())
    : new Intl.DateTimeFormat("en", {
        year: "numeric",
        timeZone: "Africa/Dar_es_Salaam",
      }).format(parsed);
}

function contentTypeFromName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function initials(value: string): string {
  const parts = value.split(/\s+/).filter(Boolean);
  if (!parts.length) return "SI";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? "S"}${parts[1][0] ?? "I"}`.toUpperCase();
}

function movementValues(candidate: Candidate) {
  const amount = numeric(candidate.amount);
  const debit = numeric(candidate.debit) || (candidate.movement === "DEBIT" ? amount : 0);
  const credit = numeric(candidate.credit) || (candidate.movement === "CREDIT" ? amount : 0);
  return {
    debit,
    credit,
    balance: credit - debit,
  };
}

function securePreviewUrl(request: NextRequest, candidate: Candidate, source: string): string {
  const query = new URLSearchParams({
    scope: candidate.scope,
    id: candidate.id,
    raw: "1",
  });
  if (source) query.set("source", source);
  return `${request.nextUrl.origin}/api/staff/preview?${query.toString()}`;
}

function reportPreviewHtml(
  candidate: Candidate,
  context: PreviewContext,
  request: NextRequest,
  source: string,
  sourceAvailable: boolean,
): Response {
  const values = movementValues(candidate);
  const rawUrl = sourceAvailable && source
    ? securePreviewUrl(request, candidate, source)
    : "";
  const status = clean(candidate.status || "RECORDED");
  const companyInitials = initials(context.companyName || "Simamia Float Company");
  const generatedNote = sourceAvailable
    ? "The verified transaction report is shown first. The original attached document is available below."
    : "Secure document preview regenerated from the verified database transaction record.";

  const attachment = rawUrl
    ? `
      <section class="attachment">
        <div class="section-title">
          <div><span>ATTACHMENT</span><strong>Original uploaded document</strong></div>
          <a href="${escapeHtml(rawUrl)}" target="_blank" rel="noreferrer">Open original</a>
        </div>
        <iframe src="${escapeHtml(rawUrl)}" title="Original uploaded document"></iframe>
      </section>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(candidate.title)}</title>
<style>
  :root{--green:#157a43;--green2:#2f8d3b;--ink:#10261f;--muted:#5c7169;--line:#aebdb7;--paper:#fff;--bg:#edf4f1;--soft:#f5faf7;--gold:#f2c965}
  *{box-sizing:border-box}html{background:var(--bg)}body{margin:0;color:var(--ink);background:radial-gradient(circle at 10% 0%,rgba(21,122,67,.08),transparent 28%),linear-gradient(180deg,#edf5f2,#f8fbfa);font-family:Arial,Helvetica,sans-serif}
  .screenbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 18px;border-bottom:1px solid #d9e5e0;background:rgba(255,255,255,.92);backdrop-filter:blur(16px);box-shadow:0 8px 24px rgba(20,73,56,.07)}
  .screenbar div{display:flex;align-items:center;gap:10px;min-width:0}.screenbar b{font-size:13px}.screenbar span{display:block;color:var(--muted);font-size:10px}.screenbar button{border:0;border-radius:10px;padding:9px 12px;color:#fff;background:linear-gradient(135deg,var(--green),#0d5d34);font-weight:800;cursor:pointer}
  .paper{width:min(1120px,calc(100% - 28px));margin:20px auto 34px;overflow:hidden;border:1px solid #d7e1dd;border-radius:8px;background:var(--paper);box-shadow:0 24px 70px rgba(20,62,49,.15)}
  .report-head{min-height:145px;display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:28px;align-items:center;padding:26px 56px;color:#fff;background:var(--green)}
  .brand{display:flex;align-items:center;gap:20px}.logo{width:76px;height:76px;display:grid;place-items:center;flex:0 0 auto;color:var(--green);background:#fff;font-size:26px;font-weight:900}.brand h1,.brand p,.brand small{margin:0;display:block}.brand h1{font-size:29px;line-height:1.05}.brand p{margin-top:10px;font-size:15px}.brand small{margin-top:13px;font-size:11px;font-weight:800}.company-meta{font-size:10px;line-height:1.52}.company-meta strong{display:block;margin-bottom:10px;font-size:11px}.company-meta span{display:block}.report-summary{display:grid;grid-template-columns:minmax(0,1fr) 425px;gap:55px;align-items:start;padding:26px 56px 32px}.staff h2,.staff p{margin:0}.staff h2{font-size:24px}.staff p{margin-top:10px;color:#36584d;font-size:13px;font-weight:700}.staff .safe-note{margin-top:15px;padding:10px 12px;border-left:4px solid var(--green);border-radius:0 8px 8px 0;color:#345c4f;background:#edf8f2;font-size:10px;line-height:1.5;font-weight:600}.totals{display:grid;gap:12px;padding-top:2px}.totals div{display:flex;justify-content:space-between;gap:18px;font-size:14px}.totals strong{font-weight:900}.totals .balance{padding-top:3px;font-size:15px}.table-area{padding:16px 56px 34px}.table-wrap{overflow:auto;border:1px solid #9fb1aa}.report-table{width:100%;min-width:820px;border-collapse:collapse}.report-table th{padding:10px 8px;border-right:1px solid #236a31;color:#fff;background:var(--green2);font-size:11px;text-align:left}.report-table td{padding:13px 8px;border-top:1px solid #aebdb7;border-right:1px solid #aebdb7;font-size:10px;vertical-align:top}.report-table th:last-child,.report-table td:last-child{border-right:0}.report-table td:nth-child(4){color:#682020}.report-table td:nth-child(5){color:#087034}.report-table td:last-child{color:#073c22;font-weight:900}.details{max-width:430px;line-height:1.42}.statusline{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.pill{display:inline-flex;align-items:center;padding:6px 9px;border-radius:999px;color:#0d6840;background:#e2f5ea;font-size:9px;font-weight:900}.section-title{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}.section-title span,.section-title strong{display:block}.section-title span{color:var(--green);font-size:9px;font-weight:900;letter-spacing:.11em}.section-title strong{margin-top:3px;font-size:15px}.section-title a{padding:8px 10px;border-radius:9px;color:#fff;background:var(--green);font-size:10px;font-weight:800;text-decoration:none}.attachment{padding:0 56px 48px}.attachment iframe{width:100%;height:620px;border:1px solid #cbd9d4;border-radius:10px;background:#f2f6f4}.footer{display:flex;justify-content:space-between;gap:16px;padding:14px 56px;border-top:1px solid #e1e9e6;color:#6a7f77;background:#fafcfb;font-size:9px}
  @media(max-width:760px){.screenbar{align-items:flex-start}.paper{width:100%;margin:0;border:0;border-radius:0}.report-head{grid-template-columns:1fr;padding:22px}.company-meta{padding-left:96px}.report-summary{grid-template-columns:1fr;padding:22px}.table-area,.attachment{padding-left:14px;padding-right:14px}.brand{align-items:flex-start}.brand h1{font-size:22px}.logo{width:64px;height:64px}.footer{padding:14px 18px;flex-direction:column}.attachment iframe{height:520px}}
  @media print{.screenbar{display:none}.paper{width:100%;margin:0;border:0;box-shadow:none}.attachment{display:none}}
</style>
</head>
<body>
  <div class="screenbar">
    <div><b>Secure transaction preview</b><span>Signed-in staff data only · generated from SIMAMIA records</span></div>
    <button type="button" onclick="window.print()">Print preview</button>
  </div>
  <main class="paper">
    <header class="report-head">
      <div class="brand">
        <div class="logo">${escapeHtml(companyInitials)}</div>
        <div>
          <h1>${escapeHtml(context.companyName || "Simamia Float Company")}</h1>
          <p>Staff Transaction Preview</p>
          <small>Period: ${escapeHtml(yearLabel(candidate.date))}</small>
        </div>
      </div>
      <div class="company-meta">
        <strong>Page 1</strong>
        <span>Code: ${escapeHtml(context.companyCode || "SIMAMIA")}</span>
        <span>Tel: ${escapeHtml(context.companyPhone || "—")}</span>
        <span>Email: ${escapeHtml(context.companyEmail || "—")}</span>
        <span>Address: ${escapeHtml(context.companyAddress || "Dar es Salaam, Tanzania")}</span>
      </div>
    </header>

    <section class="report-summary">
      <div class="staff">
        <h2>${escapeHtml(context.staffName || "Staff Officer")}</h2>
        <p>Staff financial activity · ${escapeHtml(context.companyName || "Simamia Float Company")}</p>
        <div class="statusline"><span class="pill">${escapeHtml(status.replaceAll("_", " "))}</span><span class="pill">Reference ${escapeHtml(candidate.reference || candidate.id)}</span></div>
        <div class="safe-note">${escapeHtml(generatedNote)}</div>
      </div>
      <div class="totals">
        <div><span>Total Credit:</span><span>${escapeHtml(money(values.credit))} TZS</span></div>
        <div><span>Total Debit:</span><span>${escapeHtml(money(values.debit))} TZS</span></div>
        <div class="balance"><strong>Transaction Balance:</strong><strong>${escapeHtml(money(values.balance))} TZS</strong></div>
      </div>
    </section>

    <section class="table-area">
      <div class="table-wrap">
        <table class="report-table">
          <thead><tr><th>Posting Date</th><th>Details</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
          <tbody><tr>
            <td>${escapeHtml(dateLabel(candidate.date))}</td>
            <td class="details">${escapeHtml(candidate.details || candidate.subtitle || candidate.title)}</td>
            <td>${escapeHtml(candidate.reference || candidate.id)}</td>
            <td>${escapeHtml(money(values.debit))}</td>
            <td>${escapeHtml(money(values.credit))}</td>
            <td>${escapeHtml(money(values.balance))}</td>
          </tr></tbody>
        </table>
      </div>
    </section>
    ${attachment}
    <footer class="footer"><span>Generated ${escapeHtml(dateLabel(new Date()))}</span><span>${escapeHtml(context.staffEmail || "Authenticated staff account")}</span></footer>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'self' https:; connect-src 'self'; frame-ancestors 'self'",
    },
  });
}

async function findOwnCandidates(companyId: string, staffId: string): Promise<Candidate[]> {
  const db = prisma as any;
  const candidates: Candidate[] = [];
  const tasks: Array<Promise<void>> = [];

  if (db.staffFundingReceipt?.findMany) {
    tasks.push(
      db.staffFundingReceipt.findMany({
        where: { companyId, staffId }, orderBy: { issuedAt: "desc" }, take: 1000,
      }).then((rows: any[]) => {
        for (const row of safeArray(rows)) {
          const amount = numeric(row.floatAmount) + numeric(row.cashAmount);
          candidates.push({
            id: String(row.id), scope: "transaction", title: "Accountant funding preview",
            subtitle: clean(row.referenceNo) || "Accountant to staff funding",
            details: `ACCOUNTANT TO STAFF - FLOAT ${money(row.floatAmount)}; CASH ${money(row.cashAmount)}`,
            amount, debit: 0, credit: amount, movement: "CREDIT",
            status: row.status, reference: row.referenceNo ?? row.id, date: row.confirmedAt ?? row.issuedAt ?? row.createdAt,
            urls: unique([row.receiptUrl, row.proofUrl, row.documentUrl]),
          });
        }
      }).catch(() => undefined),
    );
  }

  if (db.bankDeposit?.findMany) {
    tasks.push(
      db.bankDeposit.findMany({
        where: { companyId, staffId },
        orderBy: { depositDate: "desc" },
        take: 1000,
      }).then((rows: any[]) => {
        for (const row of safeArray(rows)) {
          const amount = numeric(row.amount);
          candidates.push({
            id: String(row.id), scope: "deposit", title: "Bank deposit preview",
            subtitle: clean(row.bankAccount) || "Staff bank deposit",
            details: `BANK DEPOSIT - FROM STAFF TO ${clean(row.bankAccount) || "BANK"}`,
            amount, debit: amount, credit: 0, movement: "DEBIT",
            status: row.status, reference: row.referenceNo ?? row.id, date: row.depositDate,
            urls: unique([row.bankReceiptUrl, row.depositSlipUrl]),
          });
        }
      }).catch(() => undefined),
    );
  }

  if (db.floatTransaction?.findMany) {
    tasks.push(
      db.floatTransaction.findMany({
        where: { companyId, OR: [{ fromUserId: staffId }, { toUserId: staffId }] },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }).then((rows: any[]) => {
        for (const row of safeArray(rows)) {
          const amount = numeric(row.returnedAmount ?? row.amount);
          const outgoing = String(row.fromUserId) === staffId;
          const type = clean(row.transactionType).toUpperCase();
          candidates.push({
            id: String(row.id), scope: "transaction",
            title: type === "STAFF_RETURN_TO_ACCOUNTANT" ? "Deposit to accountant preview" : "Float transaction preview",
            subtitle: clean(row.purpose) || clean(row.transactionType) || "Staff transaction",
            details: [clean(row.transactionType), clean(row.purpose)].filter(Boolean).join(" - ") || "STAFF FLOAT TRANSACTION",
            amount, debit: outgoing ? amount : 0, credit: outgoing ? 0 : amount,
            movement: outgoing ? "DEBIT" : "CREDIT",
            status: row.status, reference: row.referenceNo ?? row.id,
            date: row.returnedAt ?? row.confirmedAt ?? row.issuedAt ?? row.createdAt,
            urls: unique([row.receiptUrl, row.proofUrl]),
          });
        }
      }).catch(() => undefined),
    );
  }

  if (db.staffCollection?.findMany) {
    tasks.push(
      db.staffCollection.findMany({
        where: { companyId, staffId }, orderBy: { collectionDate: "desc" }, take: 1000,
      }).then((rows: any[]) => {
        for (const row of safeArray(rows)) {
          const amount = numeric(row.amount);
          candidates.push({
            id: String(row.id), scope: "transaction", title: "Collection transaction preview",
            subtitle: clean(row.description) || "Broker collection",
            details: `BROKER COLLECTION${clean(row.description) ? ` - ${clean(row.description)}` : ""}`,
            amount, debit: 0, credit: amount, movement: "CREDIT",
            status: row.status, reference: row.referenceNo ?? row.id, date: row.collectionDate,
            urls: unique([row.receiptUrl, row.proofUrl]),
          });
        }
      }).catch(() => undefined),
    );
  }

  if (db.expense?.findMany) {
    tasks.push(
      db.expense.findMany({
        where: { companyId, employeeId: staffId }, orderBy: { expenseDate: "desc" }, take: 1000,
      }).then((rows: any[]) => {
        for (const row of safeArray(rows)) {
          const amount = numeric(row.amount);
          const category = clean(row.otherCategory || row.category);
          candidates.push({
            id: String(row.id), scope: "expense", title: "Expense receipt preview",
            subtitle: clean(row.description) || category || "Staff expense",
            details: `EXPENSE ${clean(row.requestMode) || "REIMBURSEMENT"}${category ? ` - ${category}` : ""}${clean(row.description) ? ` - ${clean(row.description)}` : ""}`,
            amount, debit: amount, credit: 0, movement: "DEBIT",
            status: row.status, reference: row.referenceNo ?? row.id, date: row.expenseDate,
            urls: unique([row.receiptUrl, row.proofUrl, row.documentUrl]),
          });
        }
      }).catch(() => undefined),
    );
  }

  if (db.staffProofSubmission?.findMany) {
    tasks.push(
      db.staffProofSubmission.findMany({
        where: { companyId, staffId }, orderBy: { createdAt: "desc" }, take: 1000,
      }).then((rows: any[]) => {
        for (const row of safeArray(rows)) {
          const amount = numeric(row.amount);
          const direction = clean(row.direction).toUpperCase();
          const outgoing = direction.includes("STAFF_TO") || direction === "EXPENSE_PAYMENT";
          const incoming = direction.includes("TO_STAFF") || direction === "BROKER_TO_STAFF";
          candidates.push({
            id: String(row.id), scope: "proof", title: "Payment proof preview",
            subtitle: `${clean(row.senderName) || "Sender"} → ${clean(row.receiverName) || "Receiver"}`,
            details: `${clean(row.direction) || "PAYMENT PROOF"} - FROM ${clean(row.senderName) || "SENDER"} TO ${clean(row.receiverName) || "RECEIVER"}`,
            amount, debit: outgoing ? amount : 0, credit: incoming ? amount : 0,
            movement: outgoing ? "DEBIT" : incoming ? "CREDIT" : "NEUTRAL",
            status: row.status, reference: row.referenceNo ?? row.id,
            date: row.transactionAt ?? row.createdAt,
            urls: unique([row.proofUrl, row.documentUrl, row.receiptUrl]),
          });
        }
      }).catch(() => undefined),
    );
  }

  if (db.staffFile?.findMany) {
    tasks.push(
      db.staffFile.findMany({
        where: { companyId, ownerUserId: staffId }, orderBy: { createdAt: "desc" }, take: 1000,
      }).then((rows: any[]) => {
        for (const row of safeArray(rows)) {
          const id = String(row.id);
          candidates.push({
            id, scope: "file", title: "Staff document preview",
            subtitle: clean(row.originalName) || clean(row.kind) || "Private staff document",
            details: `${clean(row.kind) || "STAFF DOCUMENT"} - ${clean(row.originalName) || id}`,
            amount: 0, debit: 0, credit: 0, movement: "NEUTRAL",
            status: row.status || "STORED", reference: row.referenceNo ?? id, date: row.createdAt ?? row.updatedAt,
            urls: unique([`/api/staff/files/${encodeURIComponent(id)}`, row.publicUrl, row.url]),
          });
        }
      }).catch(() => undefined),
    );
  }

  await Promise.all(tasks);
  return candidates;
}

async function previewContext(session: any): Promise<PreviewContext> {
  const db = prisma as any;
  const companyId = String(session.companyId || "");
  let company: any = null;

  try {
    company = await db.company?.findFirst?.({ where: { id: companyId } });
  } catch {
    company = null;
  }

  return {
    companyName: clean(company?.name) || "Simamia Float Company",
    companyCode: clean(company?.code) || "SIMAMIA",
    companyPhone: clean(company?.phone) || clean(company?.telephone),
    companyEmail: clean(company?.email),
    companyAddress: clean(company?.address) || clean(company?.location) || "Dar es Salaam, Tanzania",
    staffName: clean(session.name || session.username || session.email) || "Staff Officer",
    staffEmail: clean(session.email),
  };
}

async function staffPrivateFile(
  fileId: string,
  companyId: string,
  staffId: string,
): Promise<{ absolute: string; mime: string; name: string } | null> {
  const db = prisma as any;
  let record: any = null;
  try {
    record = await db.staffFile?.findFirst?.({
      where: { id: fileId, companyId, ownerUserId: staffId },
    });
  } catch {
    record = null;
  }
  if (!record) return null;

  const normalized = clean(record.storagePath).replaceAll("\\", "/");
  const prefix = "storage/private/staff/";
  if (!normalized.startsWith(prefix)) return null;

  const root = path.resolve(process.cwd(), "storage", "private", "staff");
  const absolute = path.resolve(root, normalized.slice(prefix.length));
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return null;

  try {
    await access(absolute);
  } catch {
    return null;
  }

  return {
    absolute,
    mime: clean(record.mimeType) || contentTypeFromName(clean(record.originalName) || absolute),
    name: clean(record.originalName) || path.basename(absolute),
  };
}

async function legacyLocalFile(source: string): Promise<{ absolute: string; mime: string; name: string } | null> {
  const cleaned = source.split("?")[0].split("#")[0].replaceAll("\\", "/");
  if (!cleaned.startsWith("/")) return null;
  const relative = cleaned.replace(/^\/+/, "");
  const roots = [path.resolve(process.cwd(), "public"), path.resolve(process.cwd())];

  for (const root of roots) {
    const absolute = path.resolve(root, relative);
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) continue;
    try {
      await access(absolute);
      return { absolute, mime: contentTypeFromName(absolute), name: path.basename(absolute) };
    } catch {
      // Keep looking in another safe local root.
    }
  }
  return null;
}

async function resolveLocalSource(
  source: string,
  companyId: string,
  staffId: string,
): Promise<{ absolute: string; mime: string; name: string } | null> {
  const privateMatch = source.match(/^\/api\/staff\/files\/([^/?#]+)/i);
  if (privateMatch) {
    return staffPrivateFile(decodeURIComponent(privateMatch[1]), companyId, staffId);
  }
  return legacyLocalFile(source);
}

async function sourceExists(source: string, companyId: string, staffId: string): Promise<boolean> {
  if (!source) return false;
  if (/^https?:\/\//i.test(source)) return true;
  return Boolean(await resolveLocalSource(source, companyId, staffId));
}

async function rawSourceResponse(source: string, companyId: string, staffId: string): Promise<Response | null> {
  if (/^https?:\/\//i.test(source)) {
    return NextResponse.redirect(source, { status: 307 });
  }

  const file = await resolveLocalSource(source, companyId, staffId);
  if (!file) return null;
  const content = await readFile(file.absolute);

  return new Response(
    content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer,
    {
      status: 200,
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(content.length),
        "Content-Disposition": `inline; filename="${file.name.replaceAll('"', "") || "staff-document"}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireStaff();
    const companyId = String(session.companyId);
    const staffId = String(session.id);
    const scope = clean(request.nextUrl.searchParams.get("scope")).toLowerCase();
    const id = clean(request.nextUrl.searchParams.get("id"));
    const requestedSource = clean(request.nextUrl.searchParams.get("source"));
    const raw = request.nextUrl.searchParams.get("raw") === "1";

    const candidates = await findOwnCandidates(companyId, staffId);
    const candidate =
      (id
        ? candidates.find((item) =>
            item.id === id &&
            (!scope || item.scope === scope) &&
            (!requestedSource || item.urls.includes(requestedSource)),
          )
        : null) ||
      (requestedSource ? candidates.find((item) => item.urls.includes(requestedSource)) : null);

    if (!candidate) {
      return NextResponse.json(
        {
          success: false,
          message: "This preview does not belong to the currently logged-in Staff Officer or the transaction no longer exists.",
        },
        { status: 403 },
      );
    }

    const source = requestedSource && candidate.urls.includes(requestedSource)
      ? requestedSource
      : candidate.urls[0] || "";

    if (raw) {
      if (!source) {
        return NextResponse.json({ success: false, message: "No original file is attached to this transaction." }, { status: 404 });
      }
      const response = await rawSourceResponse(source, companyId, staffId);
      return response ?? NextResponse.json(
        { success: false, message: "The original upload is unavailable." },
        { status: 404 },
      );
    }

    const [context, available] = await Promise.all([
      previewContext(session),
      sourceExists(source, companyId, staffId),
    ]);

    return reportPreviewHtml(candidate, context, request, source, available);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    console.error("STAFF_PREVIEW_ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          status === 401
            ? "Your session has expired. Sign in again."
            : status === 403
              ? "Staff access is required."
              : "The secure staff preview could not be generated.",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status },
    );
  }
}
