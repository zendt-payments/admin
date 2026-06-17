/**
 * Section 6 — Freelancer Proof Submission (Zendt Onboarding Flow v1).
 * Keep in sync with product PDF / legal.
 */

export const FREELANCER_PROOF_INTRO =
  "Before your account is fully approved, submit proof that you genuinely receive international payments for freelancing work. This is a regulatory requirement.";

export const optionACopy = {
  title: "Option A — Bank statement",
  summary: "Last three months bank statement showing inward international payments.",
  bullets: [
    "Upload one bank statement PDF covering the last 3 months.",
    "At least one credit entry must be identifiable as an international remittance during the period.",
  ],
};

export type OptionBDocument = {
  title: string;
  description: string;
  formats: string;
};

export const optionBCopy = {
  title: "Option B — Two approved documents",
  intro:
    "Upload two documents from the approved list below. Both must clearly identify you by name and reference international work or payment.",
  documents: [
    {
      title: "Contractual agreement",
      description:
        "A signed contract or service agreement with an overseas client that includes both parties' names and the agreed payment terms.",
      formats: "PDF, JPG, PNG",
    },
    {
      title: "Platform screenshot",
      description:
        "A screenshot of your profile or earnings page on a recognised platform such as Upwork, Fiverr, or Toptal, clearly showing the account name and activity.",
      formats: "JPG, PNG",
    },
    {
      title: "Invoice generated",
      description:
        "An invoice issued to an overseas client showing your name, the client's name, and the amount in a foreign currency.",
      formats: "PDF, JPG, PNG",
    },
    {
      title: "FIRC / FIRA",
      description:
        "A Foreign Inward Remittance Certificate or Foreign Inward Remittance Advice from a previous payment received from an overseas client.",
      formats: "PDF",
    },
    {
      title: "Client communication",
      description:
        "An email thread or written communication with an overseas client confirming an engagement or payment, with both parties' names visible.",
      formats: "PDF, JPG, PNG",
    },
  ] as OptionBDocument[],
};

export const uploadRulesCopy = [
  "Maximum file size per document: 10 MB.",
  "Accepted formats: PDF, JPG, JPEG, PNG, DOC, DOCX (where applicable per document type above).",
];
