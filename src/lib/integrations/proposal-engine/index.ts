// Proposal-engine integration — the self-hosted PandaDoc replacement
// (Cloudflare Worker; see the proposal-engine/ project). Implements the same
// contract seam as the PandaDoc module so the contracts facade can swap
// providers per deployment via CONTRACT_PROVIDER. The stored document id is
// the engine's proposal id; acceptance is click-wrap (name + timestamp + IP).
import { entityConfig } from "@/lib/config";

function baseUrl(): string {
  const url = process.env.PROPOSAL_ENGINE_URL;
  if (!url) throw new Error("Proposal engine is not configured (PROPOSAL_ENGINE_URL missing).");
  return url.replace(/\/+$/, "");
}

function headers(): Record<string, string> {
  const token = process.env.PROPOSAL_ENGINE_API_TOKEN;
  if (!token) throw new Error("PROPOSAL_ENGINE_API_TOKEN is not configured.");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Proposal engine ${init?.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 300)}`,
    );
  }
  return res;
}

// Engine statuses (sent | viewed | accepted | declined | expired) mapped onto
// the PandaDoc vocabulary the onboarding flow already branches on.
const STATUS_MAP: Record<string, string> = {
  sent: "document.sent",
  viewed: "document.viewed",
  accepted: "document.completed",
  declined: "document.declined",
  expired: "document.expired",
};

export async function getDocumentStatus(documentId: string): Promise<string> {
  const res = await api(`/api/proposals/${documentId}`);
  const doc = (await res.json()) as { status: string };
  return STATUS_MAP[doc.status] ?? doc.status;
}

/**
 * Create the service agreement as an engine proposal, filled from the client
 * record and the agreed quote. Returns the proposal id (stored in
 * onboarding_state.pandadoc_document_id, which holds whichever provider's
 * document id this deployment uses).
 */
export async function createContractDocument(
  client: {
    id: string;
    company_name: string;
    contact_name: string | null;
    contact_email: string;
  },
  quote: { name: string; price: number; channels: string },
): Promise<string> {
  const res = await api(`/api/proposals`, {
    method: "POST",
    body: JSON.stringify({
      data: {
        brand: { name: entityConfig.brandName },
        proposal: {
          title: `Service Agreement — ${client.company_name}`,
          currency: entityConfig.currency,
        },
        client: {
          name: client.contact_name ?? "",
          company: client.company_name,
          email: client.contact_email,
        },
        prepared_by: { name: entityConfig.legalName },
        intro: `This agreement covers ${quote.name} for ${client.company_name}, delivered on ${quote.channels}. The scope, monthly fee, and terms below reflect what we discussed.`,
        pricing: {
          items: [
            {
              label: quote.name,
              detail: quote.channels,
              amount: quote.price,
              period: "monthly",
            },
          ],
          notes: "Management runs month to month and can be cancelled with 30 days written notice.",
        },
        terms: [
          "Management runs month to month and can be cancelled with 30 days written notice.",
          "Ad spend is paid directly to the advertising platforms via your own billing profile.",
          "All accounts, containers, and data remain your property.",
          `This agreement is with ${entityConfig.legalName}.`,
        ],
        accept: {
          enabled: true,
          button: "Accept agreement",
          note: `Accepting confirms the scope and monthly fee above on behalf of ${client.company_name}.`,
        },
      },
    }),
  });
  const { id } = (await res.json()) as { id: string };
  return id;
}

/** Engine proposals are live from creation — nothing to (re)send. */
export async function ensureDocumentSent(_documentId: string): Promise<void> {}

/**
 * The "signing session" is the proposal's permanent unguessable URL —
 * iframe-embeddable, does not expire, acceptance is recorded in the engine.
 */
export async function createSigningSession(
  documentId: string,
  _recipientEmail: string,
): Promise<string> {
  const res = await api(`/api/proposals/${documentId}`);
  const { url } = (await res.json()) as { url: string };
  return url;
}
