// Deliver the signed agreement to the client and to the provider.
//
// This lives on its own, away from any one provider or webhook, because the
// signature can be DETECTED by four different paths (the PandaDoc webhook, the
// proposal-engine webhook, and two "contract-return" status polls in the
// onboarding wizard). Wiring delivery into one of them means the copy silently
// depends on which path happens to win the race, which is exactly how the
// first real run sent nothing. markContractSigned is the one chokepoint every
// path passes through, and it only transitions once, so calling this from
// there sends exactly one copy however the signature was noticed.
//
// Best-effort throughout: a missing copy must never break signing or payment.
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const usingEngine = () => process.env.CONTRACT_PROVIDER === "proposal-engine";

export async function deliverSignedCopy(clientId: string): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data: state } = await supabase
      .from("onboarding_state")
      .select("pandadoc_document_id")
      .eq("client_id", clientId)
      .single();
    const documentId = state?.pandadoc_document_id as string | undefined;
    if (!documentId) {
      console.error("Signed copy skipped: no document id for client", clientId);
      return;
    }

    if (usingEngine()) {
      // Engine documents live at a permanent URL both parties can open.
      const { internalDocumentUrl } = await import("@/lib/integrations/proposal-engine");
      const { sendContractCopyFor } = await import("@/lib/email");
      const url = await internalDocumentUrl(documentId);
      await sendContractCopyFor(clientId, url);
      return;
    }

    // PandaDoc: no link both parties can open, so the PDF travels with the
    // message. The file can lag the completed status by a second or two, so
    // give it two attempts before giving up.
    const { downloadDocumentPdf } = await import("@/lib/integrations/pandadoc");
    const { sendSignedPdfCopyFor } = await import("@/lib/email");
    let pdf = await downloadDocumentPdf(documentId);
    if (!pdf) {
      await new Promise((r) => setTimeout(r, 2500));
      pdf = await downloadDocumentPdf(documentId);
    }
    if (!pdf) {
      console.error("Signed copy skipped: PDF unavailable for document", documentId);
      return;
    }
    await sendSignedPdfCopyFor(clientId, pdf);
  } catch (e) {
    console.error("Signed copy delivery failed:", e);
  }
}
