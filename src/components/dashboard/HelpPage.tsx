import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, MessageCircle } from "lucide-react";
import BackButton from "./BackButton";
import { performAppBack } from "../../lib/appBack";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import { dataService } from "../../services/dataService";
import { DashboardPageTitle, DashboardSectionTitle } from "./DashboardTitles";
import { useAppResumeTick } from "../../hooks/useAppResumeTick";
import { openWhatsAppSupport, whatsappSupportCopy } from "../../utils/whatsappSupport";

const SUPPORT_EMAIL = "hello@zendtpayments.com";
const SUPPORT_PHONE_E164 = "+917356004147";

type Faq = {
  question: string;
  answer: string;
  category?: string;
};

function groupFaqsByCategory(items: Faq[]): { category: string | null; items: Faq[] }[] {
  const groups: { category: string | null; items: Faq[] }[] = [];

  for (const faq of items) {
    const cat = faq.category?.trim() || null;
    const last = groups[groups.length - 1];
    if (!last || last.category !== cat) {
      groups.push({ category: cat, items: [faq] });
    } else {
      last.items.push(faq);
    }
  }
  return groups;
}

export default function HelpPage() {
  const navigate = useNavigate();
  const resumeTick = useAppResumeTick();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [faqsLoading, setFaqsLoading] = useState(true);
  const [view, setView] = useState<"menu" | "faqs">("menu");
  const [isContactExpanded, setIsContactExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setFaqsLoading(true);
      try {
        const data = await dataService.getFaqs();
        if (!cancelled) setFaqs(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setFaqs([]);
      } finally {
        if (!cancelled) setFaqsLoading(false);
      }
    };
    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [resumeTick]);

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
          <BackButton
            onClick={() => {
              if (view === "faqs") {
                setView("menu");
                return;
              }
              performAppBack(navigate);
            }}
          />
        </div>
      </div>

      <section className="relative rounded-t-3xl bg-[#141414] pb-24 pb-safe-nav p-6 space-y-6 flex-1">
        {view === "menu" ? (
          <div className="mt-10 space-y-8">
            {/* Contact Support */}
            <div className="group relative z-0 rounded-[23px] bg-gradient-to-r from-[#1A1A1A] to-[#141414] border border-white/5 hover:border-white/10 transition-all overflow-hidden">
              <div
                className="flex items-center justify-between p-8 cursor-pointer min-h-[140px]"
                onClick={() => setIsContactExpanded(!isContactExpanded)}
              >
                <GradientBlob
                  className="pointer-events-none absolute opacity-40 blur-2xl -z-10 group-hover:opacity-60 transition-opacity duration-500"
                  style={{
                    right: 0,
                    top: 0,
                    transform: "translate(35%, -55%)",
                    width: "300px",
                    height: "200px",
                  }}
                />
                <span className="text-callout font-light text-white z-10 max-w-[70%]">Contact Support</span>
                <div className="w-12 h-24 rounded-[10px] bg-[#1F1F1F] flex items-center justify-center group-hover:bg-[#2A2A2A] transition-colors z-10 mr-[-12px]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="21"
                    fill="none"
                    className={`transition-transform duration-300 ${isContactExpanded ? "rotate-90" : ""}`}
                  >
                    <path
                      d="M0.5 0.5L7.67158 7.67158C9.23367 9.23367 9.23367 11.7663 7.67157 13.3284L0.5 20.5"
                      stroke="#5B5B5B"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
              {/* Contact Options - Expanded */}
              {isContactExpanded && (
                <div className="px-6 pb-4 space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-3">
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="flex-1 flex flex-col items-center gap-1.5 p-4 rounded-[16px] bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                    >
                      <Mail size={18} className="text-white/60" />
                      <span className="text-caption text-white/60">Email</span>
                    </a>

                    <a
                      href={`tel:${SUPPORT_PHONE_E164}`}
                      className="flex-1 flex flex-col items-center gap-1.5 p-4 rounded-[16px] bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                    >
                      <Phone size={18} className="text-white/60" />
                      <span className="text-caption text-white/60">Call</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => openWhatsAppSupport(whatsappSupportCopy.general)}
                      className="flex-1 flex flex-col items-center gap-1.5 p-4 rounded-[16px] bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                    >
                      <MessageCircle size={18} className="text-white/60" />
                      <span className="text-caption text-white/60">Chat</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* FAQs */}
            <div
              className="group relative z-0 flex items-center justify-between p-8 rounded-[23px] bg-gradient-to-r from-[#1A1A1A] to-[#141414] border border-white/5 hover:border-white/10 transition-all cursor-pointer overflow-hidden min-h-[140px]"
              onClick={() => setView("faqs")}
            >
              <GradientBlob
                className="pointer-events-none absolute opacity-40 blur-2xl -z-10 group-hover:opacity-60 transition-opacity duration-500"
                style={{
                  right: 0,
                  top: 0,
                  transform: "translate(35%, -55%)",
                  width: "300px",
                  height: "200px",
                }}
              />
              <span className="text-callout font-light text-white z-10 max-w-[70%]">
                Frequently Asked Questions
              </span>
              <div className="w-12 h-24 rounded-[10px] bg-[#1F1F1F] flex items-center justify-center group-hover:bg-[#2A2A2A] transition-colors z-10 mr-[-12px]">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="21" fill="none">
                  <path
                    d="M0.5 0.5L7.67158 7.67158C9.23367 9.23367 9.23367 11.7663 7.67157 13.3284L0.5 20.5"
                    stroke="#5B5B5B"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            <DashboardPageTitle as="h2">FAQs</DashboardPageTitle>
            {faqsLoading ? (
              <p className="text-body text-white/50">Loading…</p>
            ) : faqs.length === 0 ? (
              <p className="text-body text-white/50">No FAQs available right now.</p>
            ) : (
              <div className="space-y-8">
                {groupFaqsByCategory(faqs).map((group, groupIndex) => (
                  <div key={group.category ?? `general-${groupIndex}`} className="space-y-4">
                    {group.category ? (
                      <p className="text-caption text-white/50 uppercase tracking-wider">
                        {group.category}
                      </p>
                    ) : null}
                    {group.items.map((faq) => (
                      <div
                        key={faq.question}
                        className="rounded-[23px] border border-white/10 bg-[#1E1E1E] p-6"
                      >
                        <DashboardSectionTitle as="h3" className="text-white/90 mb-3">
                          {faq.question}
                        </DashboardSectionTitle>
                        <p className="text-body text-white/70 leading-relaxed">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
