import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  markOperationalAttendance,
} from "@/lib/staff/attendance";
import {
  sendNoticeToRoles,
} from "@/lib/staff/notify";
import {
  requireStaff,
} from "@/lib/staff/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type StaffSession = {
  id: string;
  name: string;
  companyId: string;
};

type WarningItem = {
  task: string;
  message: string;
};

const ACTIONS = [
  "CONFIRM_FLOAT_RECEIVED",
  "ISSUE_FLOAT",
  "RECORD_COLLECTION",
  "RETURN_MONEY",
  "DEPOSIT_TO_BANK",
  "UPLOAD_PROOF_OF_PAYMENT",
  "SUBMIT_EXPENSE",
  "RECORD_SERVICE_VISIT",
  "MARK_NOTIFICATION_READ",
  "MARK_ALL_NOTIFICATIONS_READ",
] as const;

function cleanText(
  value: unknown,
): string {
  return value === null ||
    value === undefined
    ? ""
    : String(value).trim();
}

function requiredText(
  value: unknown,
  field: string,
): string {
  const result = cleanText(value);

  if (!result) {
    throw new Error(
      `REQUIRED:${field}`,
    );
  }

  return result;
}

function positiveAmount(
  value: unknown,
): number {
  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "INVALID_AMOUNT",
    );
  }

  return amount;
}

function optionalNumber(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      "INVALID_NUMBER",
    );
  }

  return parsed;
}

function dateAtLocalNoon(
  value: unknown,
): Date {
  const text =
    requiredText(
      value,
      "date",
    );

  const match =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})$/,
    );

  if (!match) {
    throw new Error(
      "INVALID_DATE",
    );
  }

  const year = Number(
    match[1],
  );
  const month = Number(
    match[2],
  );
  const day = Number(
    match[3],
  );

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      9,
      0,
      0,
    ),
  );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    throw new Error(
      "INVALID_DATE",
    );
  }

  return date;
}

function numberValue(
  value: unknown,
): number {
  const parsed = Number(
    value ?? 0,
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function createReference(
  prefix: string,
): string {
  return `${prefix}-${Date.now()
    .toString(36)
    .toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

function normalizeReference(
  value: unknown,
  prefix: string,
): string {
  const supplied = cleanText(value)
    .toUpperCase()
    .replace(
      /[^A-Z0-9/_-]+/g,
      "-",
    )
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 150);

  return supplied ||
    createReference(prefix);
}

function prismaCode(
  error: unknown,
): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    return String(
      (error as {
        code?: unknown;
      }).code ?? "",
    );
  }

  return "";
}

function errorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(
        error ?? "Unknown error",
      );
}

function serialize<T>(
  value: T,
): T {
  return JSON.parse(
    JSON.stringify(
      value,
      (_key, item) => {
        if (
          typeof item ===
          "bigint"
        ) {
          return Number(item);
        }

        if (
          item &&
          typeof item ===
            "object" &&
          typeof item.toNumber ===
            "function"
        ) {
          return item.toNumber();
        }

        return item;
      },
    ),
  );
}

async function safeTask(
  task: string,
  warnings: WarningItem[],
  operation: () => Promise<unknown>,
) {
  try {
    await operation();
  } catch (error) {
    const message =
      errorMessage(error)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500);

    warnings.push({
      task,
      message,
    });

    console.warn(
      `STAFF_OPTIONAL_${task.toUpperCase()}:`,
      error,
    );
  }
}

async function uniqueReference(
  model:
    | "float"
    | "collection",
  companyId: string,
  requested: unknown,
  prefix: string,
): Promise<string> {
  const base =
    normalizeReference(
      requested,
      prefix,
    );

  for (
    let attempt = 0;
    attempt < 30;
    attempt += 1
  ) {
    const candidate =
      attempt === 0
        ? base
        : `${base.slice(
            0,
            140,
          )}-${attempt + 1}`;

    const exists =
      model === "float"
        ? await prisma.floatTransaction.findFirst(
            {
              where: {
                companyId,
                referenceNo:
                  candidate,
              },
              select: {
                id: true,
              },
            },
          )
        : await prisma.staffCollection.findFirst(
            {
              where: {
                companyId,
                referenceNo:
                  candidate,
              },
              select: {
                id: true,
              },
            },
          );

    if (!exists) {
      return candidate;
    }
  }

  return createReference(prefix);
}

async function requireBroker(
  companyId: string,
  id: string,
) {
  const broker =
    await prisma.brokerCustomer.findFirst(
      {
        where: {
          id,
          companyId,
          status: "ACTIVE",
        },
      },
    );

  if (!broker) {
    throw new Error(
      "BROKER_NOT_FOUND",
    );
  }

  return broker;
}

async function requireCustomer(
  companyId: string,
  id: string,
) {
  const customer =
    await prisma.customer.findFirst({
      where: {
        id,
        companyId,
        status: "ACTIVE",
      },
    });

  if (!customer) {
    throw new Error(
      "CUSTOMER_NOT_FOUND",
    );
  }

  return customer;
}

async function requireAccountant(
  companyId: string,
  id: string,
) {
  const accountant =
    await prisma.user.findFirst({
      where: {
        id,
        companyId,
        role: "ACCOUNTANT",
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

  if (!accountant) {
    throw new Error(
      "ACCOUNTANT_NOT_FOUND",
    );
  }

  return accountant;
}

async function requireOwnedFileUrl(
  companyId: string,
  staffId: string,
  url: string | null,
  allowedKinds: string[],
) {
  if (!url) {
    return null;
  }

  const match =
    url.match(
      /^\/api\/staff\/files\/([^/?#]+)$/,
    );

  if (!match) {
    throw new Error(
      "FILE_NOT_OWNED",
    );
  }

  const file =
    await prisma.staffFile.findFirst({
      where: {
        id: match[1],
        companyId,
        ownerUserId:
          staffId,
        kind: {
          in: allowedKinds as any,
        },
      },
      select: {
        id: true,
      },
    });

  if (!file) {
    throw new Error(
      "FILE_NOT_OWNED",
    );
  }

  return url;
}

async function availableBalance(
  companyId: string,
  staffId: string,
): Promise<number> {
  const [
    floats,
    collections,
    deposits,
  ] = await Promise.all([
    prisma.floatTransaction.findMany({
      where: {
        companyId,
        OR: [
          {
            fromUserId:
              staffId,
          },
          {
            toUserId:
              staffId,
          },
        ],
      },
    }),

    prisma.staffCollection.findMany({
      where: {
        companyId,
        staffId,
      },
    }),

    prisma.bankDeposit.findMany({
      where: {
        companyId,
        staffId,
      },
    }),
  ]);

  const received =
    floats
      .filter(
        (item) =>
          item.transactionType ===
            "ACCOUNTANT_TO_STAFF" &&
          item.toUserId ===
            staffId &&
          [
            "CONFIRMED",
            "APPROVED",
            "RETURNED",
            "DEPOSITED",
          ].includes(
            item.status,
          ),
      )
      .reduce(
        (sum, item) =>
          sum +
          numberValue(
            item.amount,
          ),
        0,
      );

  const issued =
    floats
      .filter(
        (item) =>
          item.transactionType ===
            "STAFF_TO_BROKER" &&
          item.fromUserId ===
            staffId &&
          item.status !==
            "REJECTED",
      )
      .reduce(
        (sum, item) =>
          sum +
          numberValue(
            item.amount,
          ),
        0,
      );

  const collectionCash =
    collections
      .filter(
        (item) =>
          item.status !==
            "REJECTED",
      )
      .reduce(
        (sum, item) =>
          sum +
          numberValue(
            item.amount,
          ),
        0,
      );

  const returned =
    floats
      .filter(
        (item) =>
          item.transactionType ===
            "STAFF_RETURN_TO_ACCOUNTANT" &&
          item.fromUserId ===
            staffId &&
          item.status !==
            "REJECTED",
      )
      .reduce(
        (sum, item) =>
          sum +
          numberValue(
            item.returnedAmount ??
              item.amount,
          ),
        0,
      );

  const banked =
    deposits
      .filter(
        (item) =>
          item.status !==
            "DUPLICATE_DEPOSIT",
      )
      .reduce(
        (sum, item) =>
          sum +
          numberValue(
            item.amount,
          ),
        0,
      );

  return Math.max(
    0,
    received +
      collectionCash -
      issued -
      returned -
      banked,
  );
}

async function followUps(
  session: StaffSession,
  input: {
    attendanceAction?:
      | "FLOAT_RECEIVED"
      | "FLOAT_ISSUED"
      | "COLLECTION_RETURNED"
      | "MONEY_RETURNED";

    notice?: {
      title: string;
      message: string;
      type:
        | "INFO"
        | "SUCCESS"
        | "WARNING"
        | "ERROR";
    };

    audit: {
      action: string;
      details: string;
    };
  },
) {
  const warnings:
    WarningItem[] = [];

  if (input.attendanceAction) {
    await safeTask(
      "attendance",
      warnings,
      () =>
        markOperationalAttendance({
          companyId:
            session.companyId,
          userId:
            session.id,
          action:
            input.attendanceAction!,
        }),
    );
  }

  if (input.notice) {
    await safeTask(
      "notifications",
      warnings,
      () =>
        sendNoticeToRoles({
          companyId:
            session.companyId,
          roles: [
            "ACCOUNTANT",
            "COMPANY_ADMIN",
          ],
          title:
            input.notice!.title,
          message:
            input.notice!.message,
          type:
            input.notice!.type,
        }),
    );
  }

  await safeTask(
    "audit",
    warnings,
    () =>
      prisma.auditLog.create({
        data: {
          companyId:
            session.companyId,
          userId:
            session.id,
          action:
            input.audit.action,
          module:
            "STAFF_PORTAL",
          details:
            input.audit.details,
        },
      }),
  );

  return warnings;
}

function actionError(
  error: unknown,
) {
  const code =
    prismaCode(error);

  const details =
    errorMessage(error)
      .replace(/\s+/g, " ")
      .trim();

  if (
    details.startsWith(
      "REQUIRED:",
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        message: `${
          details
            .split(":")
            .slice(1)
            .join(":")
        } is required.`,
      },
      { status: 400 },
    );
  }

  const known: Record<
    string,
    [number, string]
  > = {
    INVALID_AMOUNT: [
      400,
      "Enter an amount greater than zero.",
    ],
    INVALID_NUMBER: [
      400,
      "One of the numeric values is invalid.",
    ],
    INVALID_DATE: [
      400,
      "Enter a valid date.",
    ],
    BROKER_NOT_FOUND: [
      404,
      "The selected active broker was not found in your company.",
    ],
    CUSTOMER_NOT_FOUND: [
      404,
      "The selected active customer was not found in your company.",
    ],
    ACCOUNTANT_NOT_FOUND: [
      404,
      "The selected active accountant was not found in your company.",
    ],
    TRANSACTION_NOT_FOUND: [
      404,
      "The selected staff transaction was not found.",
    ],
    DEPOSIT_NOT_FOUND: [
      404,
      "The selected staff deposit was not found.",
    ],
    INSUFFICIENT_FLOAT: [
      409,
      "The amount exceeds your available float balance.",
    ],
    FINANCIAL_HOLD: [
      409,
      "A financial hold must be resolved before another bank deposit is submitted.",
    ],
    FILE_NOT_OWNED: [
      403,
      "Use a file uploaded from your own staff account.",
    ],
    REQUIRED_ENTITY: [
      400,
      "Choose a broker or a customer.",
    ],
    UNSUPPORTED_ACTION: [
      400,
      "This staff operation is not supported.",
    ],
  };

  if (known[details]) {
    const [
      status,
      message,
    ] = known[details];

    return NextResponse.json(
      {
        success: false,
        message,
        code: details,
      },
      { status },
    );
  }

  if (code === "P2002") {
    return NextResponse.json(
      {
        success: false,
        message:
          "A transaction with the same reference already exists. Leave the reference blank or submit again.",
        code,
        details,
      },
      { status: 409 },
    );
  }

  if (
    code === "P2021" ||
    code === "P2022"
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The staff database is not synchronized with Prisma.",
        code,
        details:
          "Run npx prisma db push, regenerate Prisma Client, remove .next and restart.",
        originalError:
          details,
      },
      { status: 503 },
    );
  }

  console.error(
    "STAFF_ACTION_FATAL:",
    error,
  );

  return NextResponse.json(
    {
      success: false,
      message:
        "The staff operation could not be completed.",
      code:
        code ||
        "STAFF_ACTION_FAILED",
      details,
    },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const session =
      await requireStaff();

    return NextResponse.json({
      success: true,
      message:
        "The unified Staff Actions route is active.",
      staffId: session.id,
      companyId:
        session.companyId,
      methods: [
        "GET",
        "POST",
      ],
      actions: ACTIONS,
    });
  } catch (error) {
    return actionError(error);
  }
}

export async function POST(
  request: Request,
) {
  try {
    const current =
      await requireStaff();

    const session:
      StaffSession = {
      id: String(current.id),
      name: String(
        current.name ||
          "Staff officer",
      ),
      companyId: String(
        current.companyId,
      ),
    };

    let body: Record<
      string,
      unknown
    >;

    try {
      body =
        (await request.json()) as Record<
          string,
          unknown
        >;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "The request body must contain valid JSON.",
        },
        { status: 400 },
      );
    }

    const action =
      requiredText(
        body.action,
        "action",
      ).toUpperCase();

    if (
      action ===
      "CONFIRM_FLOAT_RECEIVED"
    ) {
      const transactionId =
        requiredText(
          body.transactionId,
          "transactionId",
        );

      const existing =
        await prisma.floatTransaction.findFirst(
          {
            where: {
              id: transactionId,
              companyId:
                session.companyId,
              toUserId:
                session.id,
              transactionType:
                "ACCOUNTANT_TO_STAFF",
            },
          },
        );

      if (!existing) {
        throw new Error(
          "TRANSACTION_NOT_FOUND",
        );
      }

      if (
        ![
          "PENDING",
          "ISSUED",
        ].includes(
          existing.status,
        )
      ) {
        return NextResponse.json({
          success: true,
          message:
            "The float was already confirmed or locked.",
          transaction:
            serialize(existing),
        });
      }

      const transaction =
        await prisma.floatTransaction.update(
          {
            where: {
              id:
                existing.id,
            },
            data: {
              status:
                "CONFIRMED",
              confirmedAt:
                new Date(),
            },
            include: {
              fromUser: true,
              toUser: true,
            },
          },
        );

      const warnings =
        await followUps(
          session,
          {
            attendanceAction:
              "FLOAT_RECEIVED",
            audit: {
              action:
                "CONFIRM_FLOAT_RECEIVED",
              details:
                `Confirmed float ${transaction.id}.`,
            },
          },
        );

      return NextResponse.json({
        success: true,
        message:
          "Morning float confirmed successfully.",
        transaction:
          serialize(transaction),
        warnings,
      });
    }

    if (
      action ===
      "ISSUE_FLOAT"
    ) {
      const broker =
        await requireBroker(
          session.companyId,
          requiredText(
            body.brokerCustomerId ??
              body.brokerId,
            "brokerId",
          ),
        );

      const amount =
        positiveAmount(
          body.amount,
        );

      if (
        amount >
        (await availableBalance(
          session.companyId,
          session.id,
        ))
      ) {
        throw new Error(
          "INSUFFICIENT_FLOAT",
        );
      }

      const receiptUrl =
        await requireOwnedFileUrl(
          session.companyId,
          session.id,
          cleanText(
            body.receiptUrl,
          ) || null,
          [
            "RECEIPT",
            "PROOF",
            "OTHER",
          ],
        );

      let referenceNo =
        await uniqueReference(
          "float",
          session.companyId,
          body.referenceNo,
          "SFB",
        );

      let transaction:
        any = null;

      for (
        let attempt = 0;
        attempt < 5;
        attempt += 1
      ) {
        try {
          transaction =
            await prisma.floatTransaction.create(
              {
                data: {
                  companyId:
                    session.companyId,
                  fromUserId:
                    session.id,
                  toUserId: null,
                  approvedById:
                    null,
                  brokerCustomerId:
                    broker.id,
                  transactionType:
                    "STAFF_TO_BROKER",
                  referenceNo,
                  amount,
                  purpose:
                    requiredText(
                      body.purpose,
                      "purpose",
                    ),
                  receiptUrl,
                  notes:
                    cleanText(
                      body.notes,
                    ) || null,
                  status:
                    "ISSUED",
                  issuedAt:
                    new Date(),
                },
                include: {
                  brokerCustomer:
                    true,
                },
              },
            );

          break;
        } catch (error) {
          if (
            prismaCode(error) !==
            "P2002"
          ) {
            throw error;
          }

          referenceNo =
            createReference(
              "SFB",
            );
        }
      }

      if (!transaction) {
        throw Object.assign(
          new Error(
            "Could not generate a unique float reference.",
          ),
          {
            code: "P2002",
          },
        );
      }

      const warnings =
        await followUps(
          session,
          {
            attendanceAction:
              "FLOAT_ISSUED",
            notice: {
              title:
                "Float issued to registered broker",
              message:
                `${session.name} issued TZS ${amount.toLocaleString()} to ${broker.name}.`,
              type: "INFO",
            },
            audit: {
              action:
                "ISSUE_FLOAT_TO_BROKER",
              details:
                `Issued ${amount} to BrokerCustomer ${broker.id} using ${referenceNo}.`,
            },
          },
        );

      return NextResponse.json({
        success: true,
        message:
          `Float issued successfully with reference ${referenceNo}.`,
        transaction:
          serialize(transaction),
        warnings,
      });
    }

    if (
      action ===
      "RECORD_COLLECTION"
    ) {
      const broker =
        await requireBroker(
          session.companyId,
          requiredText(
            body.brokerCustomerId ??
              body.brokerId,
            "brokerId",
          ),
        );

      const amount =
        positiveAmount(
          body.amount,
        );

      const receiptUrl =
        await requireOwnedFileUrl(
          session.companyId,
          session.id,
          cleanText(
            body.receiptUrl,
          ) || null,
          [
            "RECEIPT",
            "PROOF",
            "OTHER",
          ],
        );

      let referenceNo =
        await uniqueReference(
          "collection",
          session.companyId,
          body.referenceNo,
          "COL",
        );

      let collection:
        any = null;

      for (
        let attempt = 0;
        attempt < 5;
        attempt += 1
      ) {
        try {
          collection =
            await prisma.staffCollection.create(
              {
                data: {
                  companyId:
                    session.companyId,
                  staffId:
                    session.id,
                  brokerId: null,
                  brokerCustomerId:
                    broker.id,
                  reviewedById:
                    null,
                  referenceNo,
                  amount,
                  collectionDate:
                    dateAtLocalNoon(
                      body.collectionDate,
                    ),
                  description:
                    cleanText(
                      body.description,
                    ) || null,
                  receiptUrl,
                  status:
                    "PENDING",
                },
                include: {
                  brokerCustomer:
                    true,
                },
              },
            );

          break;
        } catch (error) {
          if (
            prismaCode(error) !==
            "P2002"
          ) {
            throw error;
          }

          referenceNo =
            createReference(
              "COL",
            );
        }
      }

      if (!collection) {
        throw Object.assign(
          new Error(
            "Could not generate a unique collection reference.",
          ),
          {
            code: "P2002",
          },
        );
      }

      const warnings =
        await followUps(
          session,
          {
            attendanceAction:
              "COLLECTION_RETURNED",
            notice: {
              title:
                "Broker collection awaiting verification",
              message:
                `${session.name} recorded TZS ${amount.toLocaleString()} from ${broker.name}.`,
              type: "INFO",
            },
            audit: {
              action:
                "RECORD_BROKER_COLLECTION",
              details:
                `Recorded collection ${collection.id} using ${referenceNo}.`,
            },
          },
        );

      return NextResponse.json({
        success: true,
        message:
          `Collection saved successfully with reference ${referenceNo}.`,
        collection:
          serialize(collection),
        warnings,
      });
    }

    if (
      action ===
      "RETURN_MONEY"
    ) {
      const accountant =
        await requireAccountant(
          session.companyId,
          requiredText(
            body.accountantId,
            "accountantId",
          ),
        );

      const amount =
        positiveAmount(
          body.amount,
        );

      if (
        amount >
        (await availableBalance(
          session.companyId,
          session.id,
        ))
      ) {
        throw new Error(
          "INSUFFICIENT_FLOAT",
        );
      }

      const receiptUrl =
        await requireOwnedFileUrl(
          session.companyId,
          session.id,
          cleanText(
            body.receiptUrl,
          ) || null,
          [
            "RECEIPT",
            "PROOF",
            "OTHER",
          ],
        );

      let referenceNo =
        await uniqueReference(
          "float",
          session.companyId,
          body.referenceNo,
          "SRA",
        );

      let transaction:
        any = null;

      for (
        let attempt = 0;
        attempt < 5;
        attempt += 1
      ) {
        try {
          transaction =
            await prisma.floatTransaction.create(
              {
                data: {
                  companyId:
                    session.companyId,
                  fromUserId:
                    session.id,
                  toUserId:
                    accountant.id,
                  approvedById:
                    null,
                  brokerCustomerId:
                    null,
                  transactionType:
                    "STAFF_RETURN_TO_ACCOUNTANT",
                  referenceNo,
                  amount,
                  returnedAmount:
                    amount,
                  purpose:
                    cleanText(
                      body.purpose,
                    ) ||
                    "Staff float and collection return",
                  receiptUrl,
                  notes:
                    cleanText(
                      body.notes,
                    ) || null,
                  status:
                    "RETURNED",
                  returnedAt:
                    new Date(),
                },
                include: {
                  fromUser: true,
                  toUser: true,
                },
              },
            );

          break;
        } catch (error) {
          if (
            prismaCode(error) !==
            "P2002"
          ) {
            throw error;
          }

          referenceNo =
            createReference(
              "SRA",
            );
        }
      }

      if (!transaction) {
        throw Object.assign(
          new Error(
            "Could not generate a unique return reference.",
          ),
          {
            code: "P2002",
          },
        );
      }

      const warnings =
        await followUps(
          session,
          {
            attendanceAction:
              "MONEY_RETURNED",
            notice: {
              title:
                "Staff return awaiting verification",
              message:
                `${session.name} returned TZS ${amount.toLocaleString()} to ${accountant.name}.`,
              type: "INFO",
            },
            audit: {
              action:
                "RETURN_MONEY_TO_ACCOUNTANT",
              details:
                `Returned ${amount} using ${referenceNo}.`,
            },
          },
        );

      return NextResponse.json({
        success: true,
        message:
          `Money returned successfully with reference ${referenceNo}.`,
        transaction:
          serialize(transaction),
        warnings,
      });
    }

    if (
      action ===
      "DEPOSIT_TO_BANK"
    ) {
      const hold =
        await prisma.bankDeposit.findFirst(
          {
            where: {
              companyId:
                session.companyId,
              staffId:
                session.id,
              holdActive:
                true,
            },
            select: {
              id: true,
            },
          },
        );

      if (hold) {
        throw new Error(
          "FINANCIAL_HOLD",
        );
      }

      const amount =
        positiveAmount(
          body.amount,
        );

      if (
        amount >
        (await availableBalance(
          session.companyId,
          session.id,
        ))
      ) {
        throw new Error(
          "INSUFFICIENT_FLOAT",
        );
      }

      const receiptUrl =
        await requireOwnedFileUrl(
          session.companyId,
          session.id,
          requiredText(
            body.receiptUrl,
            "receiptUrl",
          ),
          [
            "BANK",
            "RECEIPT",
            "PROOF",
          ],
        );

      const deposit =
        await prisma.bankDeposit.create(
          {
            data: {
              companyId:
                session.companyId,
              staffId:
                session.id,
              accountantId:
                null,
              amount,
              referenceNo:
                requiredText(
                  body.referenceNo,
                  "referenceNo",
                ),
              bankAccount:
                requiredText(
                  body.bankAccount,
                  "bankAccount",
                ),
              depositDate:
                dateAtLocalNoon(
                  body.depositDate,
                ),
              depositSlipUrl:
                receiptUrl,
              bankReceiptUrl:
                receiptUrl,
              status:
                "PENDING",
              holdActive:
                false,
            },
          },
        );

      const warnings =
        await followUps(
          session,
          {
            notice: {
              title:
                "Bank deposit awaiting verification",
              message:
                `${session.name} submitted TZS ${amount.toLocaleString()} for bank verification.`,
              type: "INFO",
            },
            audit: {
              action:
                "DEPOSIT_TO_BANK",
              details:
                `Created bank deposit ${deposit.id}.`,
            },
          },
        );

      return NextResponse.json({
        success: true,
        message:
          "Bank deposit submitted successfully.",
        deposit:
          serialize(deposit),
        warnings,
      });
    }

    if (
      action ===
      "UPLOAD_PROOF_OF_PAYMENT"
    ) {
      const depositId =
        requiredText(
          body.depositId,
          "depositId",
        );

      const receiptUrl =
        await requireOwnedFileUrl(
          session.companyId,
          session.id,
          requiredText(
            body.receiptUrl,
            "receiptUrl",
          ),
          [
            "BANK",
            "RECEIPT",
            "PROOF",
          ],
        );

      const existing =
        await prisma.bankDeposit.findFirst(
          {
            where: {
              id: depositId,
              companyId:
                session.companyId,
              staffId:
                session.id,
            },
          },
        );

      if (!existing) {
        throw new Error(
          "DEPOSIT_NOT_FOUND",
        );
      }

      if (
        existing.status ===
        "VERIFIED"
      ) {
        return NextResponse.json({
          success: true,
          message:
            "The verified deposit is locked and was not changed.",
          deposit:
            serialize(existing),
        });
      }

      const deposit =
        await prisma.bankDeposit.update(
          {
            where: {
              id:
                existing.id,
            },
            data: {
              bankReceiptUrl:
                receiptUrl,
              depositSlipUrl:
                receiptUrl,
              status:
                existing.status ===
                "MISSING_RECEIPT"
                  ? "PENDING"
                  : existing.status,
            },
          },
        );

      return NextResponse.json({
        success: true,
        message:
          "Proof of payment uploaded successfully.",
        deposit:
          serialize(deposit),
      });
    }

    if (
      action ===
      "SUBMIT_EXPENSE"
    ) {
      const receiptUrl =
        await requireOwnedFileUrl(
          session.companyId,
          session.id,
          cleanText(
            body.receiptUrl,
          ) || null,
          [
            "EXPENSE",
            "RECEIPT",
            "PROOF",
          ],
        );

      const expense =
        await prisma.expense.create({
          data: {
            companyId:
              session.companyId,
            employeeId:
              session.id,
            reviewedById:
              null,
            expenseDate:
              dateAtLocalNoon(
                body.expenseDate,
              ),
            category:
              requiredText(
                body.category,
                "category",
              ),
            amount:
              positiveAmount(
                body.amount,
              ),
            description:
              requiredText(
                body.description,
                "description",
              ),
            receiptUrl,
            status:
              "PENDING",
          },
        });

      return NextResponse.json({
        success: true,
        message:
          "Expense request submitted successfully.",
        expense:
          serialize(expense),
      });
    }

    if (
      action ===
      "RECORD_SERVICE_VISIT"
    ) {
      const brokerCustomerId =
        cleanText(
          body.brokerCustomerId ??
            body.brokerId,
        ) || null;

      const customerId =
        cleanText(
          body.customerId,
        ) || null;

      if (
        !brokerCustomerId &&
        !customerId
      ) {
        throw new Error(
          "REQUIRED_ENTITY",
        );
      }

      const broker =
        brokerCustomerId
          ? await requireBroker(
              session.companyId,
              brokerCustomerId,
            )
          : null;

      const customer =
        customerId
          ? await requireCustomer(
              session.companyId,
              customerId,
            )
          : null;

      const latitude =
        optionalNumber(
          body.latitude,
        );

      const longitude =
        optionalNumber(
          body.longitude,
        );

      if (
        latitude !== null &&
        (
          latitude < -90 ||
          latitude > 90
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Latitude must be between -90 and 90.",
          },
          { status: 400 },
        );
      }

      if (
        longitude !== null &&
        (
          longitude < -180 ||
          longitude > 180
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Longitude must be between -180 and 180.",
          },
          { status: 400 },
        );
      }

      const activity =
        await prisma.serviceActivity.create(
          {
            data: {
              companyId:
                session.companyId,
              staffId:
                session.id,
              brokerId: null,
              brokerCustomerId:
                broker?.id ??
                null,
              customerId:
                customer?.id ??
                null,
              serviceType:
                requiredText(
                  body.serviceType,
                  "serviceType",
                ),
              amount:
                optionalNumber(
                  body.amount,
                ) ?? 0,
              status:
                "COMPLETED",
              servedAt:
                new Date(),
              latitude,
              longitude,
              locationName:
                cleanText(
                  body.locationName,
                ) || null,
              notes:
                cleanText(
                  body.notes,
                ) || null,
            },
            include: {
              brokerCustomer:
                true,
              customer: true,
            },
          },
        );

      return NextResponse.json({
        success: true,
        message:
          "Service visit recorded successfully.",
        activity:
          serialize(activity),
      });
    }

    if (
      action ===
      "MARK_NOTIFICATION_READ"
    ) {
      const notificationId =
        requiredText(
          body.notificationId,
          "notificationId",
        );

      const notification =
        await prisma.notification.findFirst(
          {
            where: {
              id:
                notificationId,
              companyId:
                session.companyId,
              userId:
                session.id,
            },
          },
        );

      if (!notification) {
        return NextResponse.json(
          {
            success: false,
            message:
              "The notification was not found.",
          },
          { status: 404 },
        );
      }

      await prisma.notification.update(
        {
          where: {
            id:
              notification.id,
          },
          data: {
            isRead: true,
          },
        },
      );

      return NextResponse.json({
        success: true,
        message:
          "Notification marked as read.",
      });
    }

    if (
      action ===
      "MARK_ALL_NOTIFICATIONS_READ"
    ) {
      await prisma.notification.updateMany(
        {
          where: {
            companyId:
              session.companyId,
            userId:
              session.id,
            isRead:
              false,
          },
          data: {
            isRead: true,
          },
        },
      );

      return NextResponse.json({
        success: true,
        message:
          "All notifications were marked as read.",
      });
    }

    throw new Error(
      "UNSUPPORTED_ACTION",
    );
  } catch (error) {
    return actionError(error);
  }
}
