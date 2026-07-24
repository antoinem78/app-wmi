// Contract-provider facade. The onboarding flow imports from here, never from
// a provider module directly. app.wmiltd.com leaves CONTRACT_PROVIDER unset
// (PandaDoc, the default — zero behaviour change); entity clones set
// CONTRACT_PROVIDER=proposal-engine to use the self-hosted engine instead.
// markContractSigned is provider-neutral portal logic (Supabase + activity
// log) and is shared regardless of provider.
import * as pandadoc from "@/lib/integrations/pandadoc";
import * as proposalEngine from "@/lib/integrations/proposal-engine";

const impl =
  process.env.CONTRACT_PROVIDER === "proposal-engine" ? proposalEngine : pandadoc;

export const getDocumentStatus = impl.getDocumentStatus;
export const createContractDocument = impl.createContractDocument;
export const ensureDocumentSent = impl.ensureDocumentSent;
export const createSigningSession = impl.createSigningSession;
export const markContractSigned = pandadoc.markContractSigned;
