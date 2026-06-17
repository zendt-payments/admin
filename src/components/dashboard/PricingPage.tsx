import type { ReactNode } from "react";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import { DashboardPageTitle } from "./DashboardTitles";

const CURRENCY_TAGS = [
  "AED",
  "SAR",
  "QAR",
  "OMR",
  "BHD",
  "KWD",
  "USD",
  "GBP",
  "EUR",
  "AUD",
  "CAD",
] as const;

type RateRow = { label: string; value: string };

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-caption text-white/50 uppercase tracking-wider">{children}</p>;
}

function RateTierList({ rows }: { rows: RateRow[] }) {
  return (
    <ul className="mt-3 space-y-2 border-t border-white/5 pt-3">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center justify-between gap-3 text-body">
          <span className="text-white/70">{row.label}</span>
          <span className="shrink-0 font-light text-white">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

function PricingCard({
  title,
  subtitle,
  rate,
  rateNote,
  rows,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  rate: ReactNode;
  rateNote?: string;
  rows?: RateRow[];
  footer?: string;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-[10px] bg-[#1E1E1E] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-body font-light text-white">{title}</h3>
          <p className="mt-0.5 text-body text-white/70">{subtitle}</p>
        </div>
        <div className="shrink-0 text-right">
          {rate}
          {rateNote ? <p className="mt-0.5 text-caption text-white/40">{rateNote}</p> : null}
        </div>
      </div>
      {rows && rows.length > 0 ? <RateTierList rows={rows} /> : null}
      {children}
      {footer ? <p className="mt-4 text-caption text-white/40">{footer}</p> : null}
    </article>
  );
}

function RateHighlight({ children }: { children: ReactNode }) {
  return <span className="text-callout font-light leading-tight text-white">{children}</span>;
}

export default function PricingPage() {
  return (
    <PageContainer className="text-white space-y-6">
      <div className="flex items-center justify-between px-4 pt-12 pt-safe-header z-0">
        <GradientBlob
          className="absolute opacity-60 blur-2xl -z-10"
          style={{
            right: "82px",
            top: "-50px",
            width: "321px",
            height: "262px",
            zIndex: "0",
          }}
        />
        <div className="flex justify-between w-full z-1">
          <BackButton />
        </div>
      </div>

      <div className="pt-6 relative rounded-t-3xl px-4 pb-25 bg-[#141414] z-1 flex-1">
        <div className="space-y-6">
          <div className="space-y-1 pt-4">
            <DashboardPageTitle as="h2">Pricing</DashboardPageTitle>
            <p className="text-body text-white/70">Transparent fees. No subscriptions.</p>
          </div>

          <div className="space-y-4">
            <SectionLabel>Domestic payments</SectionLabel>
            <div className="space-y-3">
              <PricingCard
                title="UPI"
                subtitle="GPay, PhonePe, Paytm, any UPI app"
                rate={<RateHighlight>0.60%</RateHighlight>}
                footer="T+1 settlement"
              />

              <PricingCard
                title="Debit card"
                subtitle="Visa • Mastercard • RuPay"
                rate={<RateHighlight>1.5 – 1.9%</RateHighlight>}
                rows={[
                  { label: "Below ₹2,000", value: "1.5%" },
                  { label: "Above ₹2,000", value: "1.9%" },
                ]}
                footer="T+1 settlement"
              />

              <PricingCard
                title="Credit card"
                subtitle="All major networks"
                rate={<RateHighlight>2.2 – 3.0%</RateHighlight>}
                rows={[
                  { label: "Visa / Mastercard / RuPay", value: "2.2%" },
                  { label: "Corporate cards", value: "2.6%" },
                  { label: "Amex / Diners Club", value: "3.0%" },
                ]}
                footer="T+1 settlement"
              />

              <PricingCard
                title="Netbanking"
                subtitle="All Indian banks"
                rate={<RateHighlight>1.9 – 2.1%</RateHighlight>}
                rows={[
                  { label: "HDFC • ICICI • Kotak", value: "2.1%" },
                  { label: "All other banks", value: "1.9%" },
                ]}
                footer="T+1 settlement"
              />
            </div>
          </div>

          <div className="space-y-4">
            <SectionLabel>International payments</SectionLabel>
            <PricingCard
              title="International card"
              subtitle="Visa and Mastercard • 150+ currencies"
              rate={<RateHighlight>4%</RateHighlight>}
              rateNote="+ live FX rate"
            >
              <div className="mt-4 flex flex-wrap gap-2">
                {CURRENCY_TAGS.map((code) => (
                  <span
                    key={code}
                    className="rounded-[10px] border border-white/5 bg-[#141414] px-2.5 py-1 text-caption font-light text-white/90"
                  >
                    {code}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-caption font-light text-white/70">+140 more</p>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-3 text-caption text-white/40">
                <span>Settlement</span>
                <span className="text-right">T+3 working days • paid in INR</span>
              </div>
            </PricingCard>
          </div>

          <div className="rounded-[10px] bg-[#1E1E1E] px-4 py-3.5">
            <p className="text-caption leading-relaxed text-white/60">
              GST at 18% is charged additionally on all paid payment methods.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
