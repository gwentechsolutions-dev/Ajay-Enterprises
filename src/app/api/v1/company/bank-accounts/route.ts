import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { bankAccountSchema } from "@/lib/schemas/company";
import { maskAccountNumber } from "@/lib/utils";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getSession();
    await requirePermission(session, "company", "view");

    const accounts = await db.bankAccount.findMany({
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    // Mask account number for non-owners/non-accountants or display partial
    const safeAccounts = accounts.map((acc) => ({
      ...acc,
      accountNumberMasked: maskAccountNumber(acc.accountNumber),
      // Owner or accountant sees full account number when editing
      accountNumber: session?.role === "OWNER" || session?.role === "ACCOUNTANT" ? acc.accountNumber : maskAccountNumber(acc.accountNumber),
    }));

    return NextResponse.json({ success: true, data: safeAccounts });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "company", "edit");

    const company = await db.companyProfile.findFirst();
    if (!company) {
      return NextResponse.json({ success: false, error: { message: "Company profile missing" } }, { status: 404 });
    }

    const body = await req.json();
    const parsed = bankAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Invalid bank account details", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // If marked primary, unset other primaries
    if (data.isPrimary) {
      await db.bankAccount.updateMany({
        where: { companyId: company.id },
        data: { isPrimary: false },
      });
    }

    const newAccount = await db.bankAccount.create({
      data: {
        companyId: company.id,
        bankName: data.bankName,
        accountHolderName: data.accountHolderName,
        accountNumber: data.accountNumber,
        ifscCode: data.ifscCode.toUpperCase(),
        branchName: data.branchName || null,
        accountType: data.accountType,
        upiId: data.upiId || null,
        qrAssetUrl: data.qrAssetUrl || null,
        isPrimary: data.isPrimary,
        isActive: data.isActive,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "CREATE",
      module: "COMPANY",
      entityType: "BankAccount",
      entityId: newAccount.id,
      afterState: newAccount,
      notes: `Added bank account: ${newAccount.bankName} (${maskAccountNumber(newAccount.accountNumber)})`,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...newAccount,
        accountNumberMasked: maskAccountNumber(newAccount.accountNumber),
      },
      message: "Bank account added successfully",
    }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "company", "edit");

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: { message: "Account ID required" } }, { status: 400 });
    }

    const existing = await db.bankAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Account not found" } }, { status: 404 });
    }

    await db.bankAccount.delete({ where: { id } });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "DELETE",
      module: "COMPANY",
      entityType: "BankAccount",
      entityId: id,
      beforeState: existing,
      notes: `Deleted bank account: ${existing.bankName} (${maskAccountNumber(existing.accountNumber)})`,
    });

    return NextResponse.json({ success: true, message: "Bank account deleted successfully" });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

