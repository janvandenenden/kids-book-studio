import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { BookPDF, LegacyBookPDF } from "@/lib/pdf-generator";
import type { Storyboard } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { story } = body;

    if (!story || !story.pages) {
      return NextResponse.json(
        { error: "Invalid story data" },
        { status: 400 }
      );
    }

    console.log(`Generating PDF for: ${story.title}`);

    // Determine if this is the new Storyboard format or legacy Story format
    const isNewFormat = story.pages[0]?.page !== undefined;

    // Generate PDF buffer
    let pdfBuffer;
    if (isNewFormat) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pdfBuffer = await renderToBuffer(BookPDF({ story: story as Storyboard }) as any);
    } else {
      // Legacy format support
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pdfBuffer = await renderToBuffer(LegacyBookPDF({ story }) as any);
    }

    // Return PDF as downloadable file
    const sanitizedTitle = story.title
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "-");
    const filename = `${sanitizedTitle}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
