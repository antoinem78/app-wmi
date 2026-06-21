# PandaDoc contract template — reference (WMI)

The live template is **"WMI Managed Paid Media Agreement"** (id
`WmDuggXFG4wkXZQ98nLu38`, env `PANDADOC_TEMPLATE_ID`) in WMI's PandaDoc account
on `ppc@wmiltd.com`. This file mirrors its content for version control.
("Paid Media" rather than "Paid Search" so the scope can include Meta.)

> ⚠️ **Draft — not legal advice.** This wording is adapted from the prior
> template and must be reviewed by a qualified solicitor (England & Wales)
> before the first real client signs.

## How the merge works

PandaDoc variables use **[square brackets]** (pasting bracketed text registers
a variable; `{{curly}}` is ignored). Paste the agreement text below into the
template editor — the bracketed names become variables automatically.

| Variable | Filled by |
|---|---|
| `[Client.FirstName]` `[Client.LastName]` `[Client.Email]` | built-in recipient variables — auto-filled from the signer the portal attaches |
| `[Client.Company]` | built-in recipient variable — resolves from the PandaDoc contact record, which the portal upserts before generating |
| `[agreement.date]` `[entity.legal_name]` `[quote.tier_name]` `[quote.monthly_price]` `[quote.channels]` | custom tokens — passed by the portal in the create-document API call (`src/lib/integrations/pandadoc/index.ts`). `[entity.legal_name]` resolves to **WEB MARKETING INTERNATIONAL LTD**; `[quote.monthly_price]` is formatted in **GBP**; `[quote.channels]` is e.g. "Google Ads & Microsoft Ads". |

Plus one **signature field** and one **date field**, both assigned to the
`Client` role.

> Sandbox note: documents created with a sandbox API key get a "[DEV]" name
> prefix and can only be sent to in-organisation emails. A production API key is
> required before real clients.

---

## Agreement text (paste into the template)

# Managed Paid Media Services Agreement

This Services Agreement ("Agreement") is entered into on [agreement.date] between:

[entity.legal_name], a company registered in England & Wales (company number 10264568), registered office 124 City Road, London, England, EC1V 2NX, VAT registration GB266586851 ("Provider"), and

[Client.Company], represented by [Client.FirstName] [Client.LastName] ([Client.Email]) ("Client").

## 1. Services

The Provider will deliver managed paid media advertising services covering [quote.channels] only, comprising: campaign strategy, setup, and structure; ongoing optimisation; budget monitoring; and weekly written performance reports. Services are delivered using the Provider's internal platform and workflows. Services for other advertising platforms or channels are not included and require a separate agreement.

## 2. Service plan and fees

Plan: [quote.tier_name]

Fee: [quote.monthly_price] per month. For clients in the United Kingdom this fee is inclusive of UK VAT at the prevailing rate. No UK VAT is charged to clients outside the United Kingdom.

The fee is a fixed monthly fee agreed with the Client for the services described above; it does not vary with advertising spend. If the scope of services or the Client's advertising activity changes materially, the parties will agree a revised fee in writing before it takes effect.

Advertising spend itself is paid by the Client directly to the advertising platforms (e.g. Google, Microsoft) and is not included in the fee.

## 3. Billing

The fee is billed monthly in advance, starting on the date of signup and recurring on the same date of each subsequent month, collected automatically via the payment method provided by the Client. Failed payments may result in suspension of the services until payment is restored.

## 4. Term and cancellation

This Agreement runs on a one-month rolling basis with no long-term commitment. Either party may cancel with 31 days' written notice (email or Slack message is sufficient). Any renewal payment falling due within the notice period remains payable — in practice this means one final monthly payment is collected after notice is given, and services continue until the end of the notice period.

## 5. Communication — zero-calls service

The fee reflects an asynchronous, Slack-only service. All communication, reporting, and support take place in writing via the Client's dedicated Slack channel. Phone or video calls are not included. If the Client requires calls or meetings, the parties will agree a separate premium package with a tailored quote before any calls take place.

## 6. Account access and authorisation

The Client authorises the Provider to access and manage the Client's advertising accounts for the purpose of delivering the services. Access is granted through the advertising platforms' own account-linking mechanisms (e.g. a Google Ads manager-account link approved by the Client inside Google Ads). The Client confirms they are authorised to grant such access. The Client retains ownership of their advertising accounts and data at all times. No changes are made to the Client's campaigns without review and approval by a qualified Provider specialist.

## 7. Client responsibilities

The Client will: (a) maintain a valid payment method; (b) keep sufficient budget with the advertising platforms; (c) provide timely access, materials, and approvals reasonably needed to deliver the services; (d) ensure their website, products, and landing pages comply with the advertising platforms' policies.

## 8. Data protection

The Provider processes Client data in accordance with its Privacy Policy (https://app.wmiltd.com/privacy) and applicable data protection law (including the UK GDPR and the Data Protection Act 2018). Advertising account data is used solely to deliver the services and is never sold or shared with third parties for advertising, profiling, or resale purposes. Data is retained for the duration of the engagement plus 12 months.

## 9. No guarantee of results

The Provider will perform the services with reasonable skill and care. Advertising performance depends on factors outside the Provider's control; the Provider does not guarantee specific results, rankings, traffic, or return on ad spend.

## 10. Limitation of liability

To the maximum extent permitted by law, the Provider's total liability under this Agreement is limited to the fees paid by the Client in the three (3) months preceding the event giving rise to the claim. Neither party is liable for indirect, incidental, or consequential damages, including loss of advertising revenue or data.

## 11. Governing law

This Agreement is governed by the laws of England and Wales. Any disputes are subject to the exclusive jurisdiction of the courts of England and Wales.

## 12. Signatures

Name: [Client.FirstName] [Client.LastName]
_Signature field (role: Client)_

Company: [Client.Company]
_Date field (role: Client)_
