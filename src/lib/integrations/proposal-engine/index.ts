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
 * Create the Managed Paid Search Services Agreement as an engine proposal,
 * filled from the client record, the agreed quote, and the entity config.
 * Wording mirrors the WMI PandaDoc template (clauses 1-11); the signature
 * block is replaced by the engine's click-wrap acceptance. Returns the
 * proposal id (stored in onboarding_state.pandadoc_document_id, which holds
 * whichever provider's document id this deployment uses).
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
  const fee = new Intl.NumberFormat("en", {
    style: "currency",
    currency: entityConfig.currency,
    maximumFractionDigits: 0,
  }).format(quote.price);
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const provider = entityConfig.registrationInfo
    ? `${entityConfig.legalName}, ${entityConfig.registrationInfo} ("Provider")`
    : `${entityConfig.legalName} ("Provider")`;
  const representative = client.contact_name
    ? `represented by ${client.contact_name} (${client.contact_email})`
    : `represented by ${client.contact_email}`;
  const law = entityConfig.governingLaw;

  const res = await api(`/api/proposals`, {
    method: "POST",
    body: JSON.stringify({
      data: {
        brand: { name: entityConfig.brandName },
        proposal: {
          title: "Managed Paid Search Services Agreement",
          currency: entityConfig.currency,
        },
        client: {
          name: client.contact_name ?? "",
          company: client.company_name,
          email: client.contact_email,
        },
        prepared_by: { name: entityConfig.legalName },
        intro: `This Services Agreement ("Agreement") is entered into on ${today} between:\n\n${provider}, and\n\n${client.company_name}, ${representative} ("Client").`,
        pricing: {
          items: [
            {
              label: quote.name,
              detail: `${quote.channels}, billed monthly in advance`,
              amount: quote.price,
              period: "monthly",
            },
          ],
          notes:
            "Exclusive of applicable taxes. Advertising spend is paid by the Client directly to the advertising platforms and is not included in the fee.",
        },
        terms: [
          `Services. The Provider will deliver managed paid search advertising services covering ${quote.channels} only, comprising: campaign strategy, setup, and structure; ongoing optimisation; budget monitoring; and weekly written performance reports. Services are delivered using the Provider's internal platform and workflows. Services for other advertising platforms or channels are not included and require a separate agreement.`,
          `Service plan and fees. Plan: ${quote.name}. Fee: ${fee} per month, exclusive of applicable taxes (VAT or equivalent will be added where applicable). The fee is a fixed monthly fee agreed with the Client for the services described above; it does not vary with advertising spend. If the scope of services or the Client's advertising activity changes materially, the parties will agree a revised fee in writing before it takes effect. Advertising spend itself is paid by the Client directly to the advertising platforms (e.g. Google, Microsoft) and is not included in the fee.`,
          "Billing. The fee is billed monthly in advance, starting on the date of signup and recurring on the same date of each subsequent month, collected automatically via the payment method provided by the Client. Failed payments may result in suspension of the services until payment is restored.",
          "Term and cancellation. This Agreement runs on a one-month rolling basis with no long-term commitment. Either party may cancel with 31 days' written notice (email or Slack message is sufficient). Any renewal payment falling due within the notice period remains payable. In practice this means one final monthly payment is collected after notice is given, and services continue until the end of the notice period.",
          "Communication (zero-calls service). The fee reflects an asynchronous, Slack-only service. All communication, reporting, and support take place in writing via the Client's dedicated Slack channel. Phone or video calls are not included. If the Client requires calls or meetings, the parties will agree a separate premium package with a tailored quote before any calls take place.",
          "Account access and authorisation. The Client authorises the Provider to access and manage the Client's advertising accounts for the purpose of delivering the services. Access is granted through the advertising platforms' own account-linking mechanisms (e.g. a Google Ads manager-account link approved by the Client inside Google Ads). The Client confirms they are authorised to grant such access. The Client retains ownership of their advertising accounts and data at all times. No changes are made to the Client's campaigns without review and approval by a qualified Provider specialist.",
          "Client responsibilities. The Client will: (a) maintain a valid payment method; (b) keep sufficient budget with the advertising platforms; (c) provide timely access, materials, and approvals reasonably needed to deliver the services; (d) ensure their website, products, and landing pages comply with the advertising platforms' policies.",
          `Data protection. The Provider processes Client data in accordance with its Privacy Policy (${entityConfig.privacyUrl}) and applicable data protection law. Advertising account data is used solely to deliver the services and is never sold or shared with third parties for advertising, profiling, or resale purposes. Data is retained for the duration of the engagement plus 12 months.`,
          "No guarantee of results. The Provider will perform the services with reasonable skill and care. Advertising performance depends on factors outside the Provider's control; the Provider does not guarantee specific results, rankings, traffic, or return on ad spend.",
          "Limitation of liability. To the maximum extent permitted by law, the Provider's total liability under this Agreement is limited to the fees paid by the Client in the three (3) months preceding the event giving rise to the claim. Neither party is liable for indirect, incidental, or consequential damages, including loss of advertising revenue or data.",
          `Governing law. This Agreement is governed by the laws of ${law}. Any disputes are subject to the exclusive jurisdiction of the courts of ${law}.`,
        ],
        accept: {
          enabled: true,
          button: "Accept agreement",
          note: `By accepting, you confirm you have read this Agreement, have authority to enter into it on behalf of ${client.company_name}, and agree to its terms. Your typed name, the date and time, and your network address are recorded as your acceptance.`,
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
