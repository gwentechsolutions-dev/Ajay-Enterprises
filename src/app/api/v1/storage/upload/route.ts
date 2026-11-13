import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { savePrivateFile } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "general";

    if (!file) {
      return NextResponse.json({ success: false, error: { message: "No file provided" } }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await savePrivateFile(buffer, file.name, file.type, folder);

    await logAuditEvent({
      userId: session.id,
      userName: session.name,
      userRole: session.role,
      action: "UPLOAD",
      module: "STORAGE",
      entityType: "File",
      notes: `Uploaded private file ${result.fileName} (${(result.fileSize / 1024).toFixed(1)} KB) to ${folder}`,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: "File uploaded successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message || "Failed to upload file" } },
      { status: 400 }
    );
  }
}

