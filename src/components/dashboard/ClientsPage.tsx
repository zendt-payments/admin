import { useNavigate } from "react-router-dom";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import { StaggeredList, StaggerItem } from "../motion";
import { dashboardPageTitleClass } from "./DashboardTitles";

export default function ClientsPage() {
  const navigate = useNavigate();

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

      <section className="relative rounded-t-3xl bg-[#141414] pb-24 pb-safe-nav p-6 space-y-6 flex-1">
        <StaggeredList className="mt-10 space-y-8">
          <StaggerItem
            onClick={() => navigate("/dashboard/add-client")}
            className="group relative z-0 flex items-center justify-between p-8 rounded-[23px] bg-gradient-to-r from-[#1A1A1A] to-[#141414] border border-white/5 hover:border-white/10 transition-all cursor-pointer overflow-hidden min-h-[140px]"
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
            <span className={`${dashboardPageTitleClass} z-10 max-w-[70%]`}>Add Client</span>
            <div className="w-12 h-24 rounded-[10px] bg-[#1F1F1F] flex items-center justify-center group-hover:bg-[#2A2A2A] transition-colors z-10 mr-[-12px]">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="21" fill="none">
                <path
                  d="M0.5 0.5L7.67158 7.67158C9.23367 9.23367 9.23367 11.7663 7.67157 13.3284L0.5 20.5"
                  stroke="#5B5B5B"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </StaggerItem>

          <StaggerItem
            onClick={() => navigate("/dashboard/update-client")}
            className="group relative z-0 flex items-center justify-between p-8 rounded-[23px] bg-gradient-to-r from-[#1A1A1A] to-[#141414] border border-white/5 hover:border-white/10 transition-all cursor-pointer overflow-hidden min-h-[140px]"
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
            <span className={`${dashboardPageTitleClass} z-10 max-w-[70%]`}>Update Client</span>
            <div className="w-12 h-24 rounded-[10px] bg-[#1F1F1F] flex items-center justify-center group-hover:bg-[#2A2A2A] transition-colors z-10 mr-[-12px]">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="21" fill="none">
                <path
                  d="M0.5 0.5L7.67158 7.67158C9.23367 9.23367 9.23367 11.7663 7.67157 13.3284L0.5 20.5"
                  stroke="#5B5B5B"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </StaggerItem>
        </StaggeredList>
      </section>
    </PageContainer>
  );
}
