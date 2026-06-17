import type { ReactNode } from "react";
import BackButton from "../../dashboard/BackButton";
import GradientBlob from "../../icons/GradientBlob";
import PageContainer from "../../dashboard/PageContainer";
import { Shimmer } from "../../motion";
import ListRowsSkeleton from "./ListRowsSkeleton";

const blobStyle = {
  right: "82px",
  top: "-50px",
  width: "321px",
  height: "262px",
  zIndex: "0" as const,
};

export function PageHeaderSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <header className="mb-6 space-y-2">
      <Shimmer className="h-8 w-40" bg="bg-white/10" rounded="rounded-lg" />
      {lines > 1 && <Shimmer className="h-4 w-64 max-w-full" bg="bg-white/5" rounded="rounded-lg" />}
    </header>
  );
}

export function ToggleListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading settings">
      {Array.from({ length: rows }, (_, i) => (
        <Shimmer
          key={i}
          className="flex items-start justify-between gap-4 px-4 py-3"
          bg="bg-white/5"
          rounded="rounded-[16px]"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-36 rounded bg-white/10" />
            <div className="h-3 w-full max-w-xs rounded bg-white/5" />
          </div>
          <div className="h-8 w-14 shrink-0 rounded-full bg-white/10" />
        </Shimmer>
      ))}
    </div>
  );
}

function ProfileHeroSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4" aria-busy="true" aria-label="Loading profile">
      <Shimmer className="h-24 w-24" bg="bg-white/10" rounded="rounded-full" />
      <Shimmer className="h-5 w-40" bg="bg-white/10" rounded="rounded-lg" />
      <Shimmer className="h-4 w-52" bg="bg-white/5" rounded="rounded-lg" />
    </div>
  );
}

export function MenuLinksSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="mt-8 flex flex-col gap-4" aria-busy="true" aria-label="Loading menu">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 h-10">
          <Shimmer className="h-5 w-5 shrink-0" bg="bg-white/10" rounded="rounded" />
          <Shimmer className="h-5 flex-1 max-w-[180px]" bg="bg-white/5" rounded="rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function FormCardsSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading form">
      {Array.from({ length: cards }, (_, i) => (
        <Shimmer key={i} className="p-5 space-y-4" bg="bg-[#1E1E1E]" rounded="rounded-[20px]">
          <div className="h-5 w-32 rounded bg-white/10" />
          <div className="h-10 w-full rounded bg-white/5" />
          <div className="h-10 w-full rounded bg-white/5" />
          <div className="h-10 w-3/4 rounded bg-white/5" />
        </Shimmer>
      ))}
    </div>
  );
}

export function KycStepsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading verification">
      {Array.from({ length: rows }, (_, i) => (
        <Shimmer key={i} className="p-4 space-y-3" bg="bg-[#1E1E1E]" rounded="rounded-3xl">
          <div className="h-4 w-20 rounded bg-white/10" />
          <div className="h-6 w-56 rounded bg-white/10" />
          <div className="h-4 w-72 max-w-full rounded bg-white/5" />
        </Shimmer>
      ))}
    </div>
  );
}

export function DropdownRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="px-2 py-1 space-y-1" aria-busy="true" aria-label="Loading options">
      {Array.from({ length: rows }, (_, i) => (
        <Shimmer key={i} className="h-10 w-full px-3" bg="bg-white/5" rounded="rounded-[8px]">
          <div className="h-3 w-24 rounded bg-white/10" />
        </Shimmer>
      ))}
    </div>
  );
}

export function ReferralBodySkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading referral data">
      <div className="text-center space-y-2 pt-4">
        <Shimmer className="mx-auto h-8 w-48" bg="bg-white/10" rounded="rounded-lg" />
        <Shimmer className="mx-auto h-4 w-64" bg="bg-white/5" rounded="rounded-lg" />
      </div>
      <Shimmer className="h-36 w-full" bg="bg-[#1E1E1E]" rounded="rounded-[28px]" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Shimmer key={i} className="h-20" bg="bg-[#1E1E1E]" rounded="rounded-2xl" />
        ))}
      </div>
      <ListRowsSkeleton rows={4} />
    </div>
  );
}

function PageShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <PageContainer className="text-white space-y-6">
      <div className="flex items-center justify-between px-4 pt-12 pt-safe-header z-0">
        <GradientBlob className="absolute opacity-60 blur-2xl -z-10" style={blobStyle} />
        <div className="flex w-full z-1">
          <BackButton />
        </div>
      </div>
      <section className="relative z-1 flex-1 rounded-t-3xl bg-[#141414] p-6 pb-24 pb-safe-nav shadow-[0_35px_65px_rgba(4,4,7,0.55)]">
        {children}
      </section>
    </PageContainer>
  );
}

export function ProfileSettingsSkeleton() {
  return (
    <PageShellSkeleton>
      <div className="flex flex-col items-center gap-4 mb-8">
        <ProfileHeroSkeleton />
      </div>
      <FormCardsSkeleton cards={2} />
    </PageShellSkeleton>
  );
}

export function BusinessProfileSkeleton() {
  return (
    <PageShellSkeleton>
      <div className="flex items-center gap-4 mb-8">
        <Shimmer className="h-16 w-16 shrink-0" bg="bg-white/10" rounded="rounded-xl" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-6 w-40" bg="bg-white/10" rounded="rounded-lg" />
          <Shimmer className="h-4 w-56" bg="bg-white/5" rounded="rounded-lg" />
        </div>
      </div>
      <FormCardsSkeleton cards={3} />
    </PageShellSkeleton>
  );
}

export function AdminProfileSkeleton() {
  return (
    <div className="grid lg:grid-cols-2 gap-8" aria-busy="true" aria-label="Loading admin profile">
      <Shimmer className="p-5 space-y-4" bg="bg-[#1E1E1E]" rounded="rounded-2xl">
        <div className="h-5 w-24 rounded bg-white/10" />
        <div className="flex gap-4">
          <div className="h-20 w-20 rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-10 w-full rounded bg-white/5" />
            <div className="h-3 w-32 rounded bg-white/5" />
          </div>
        </div>
        <div className="h-10 w-full rounded bg-white/5" />
        <div className="h-10 w-full rounded bg-white/5" />
      </Shimmer>
      <Shimmer className="p-5 space-y-4" bg="bg-[#1E1E1E]" rounded="rounded-2xl">
        <div className="h-5 w-32 rounded bg-white/10" />
        <div className="h-10 w-full rounded bg-white/5" />
        <div className="h-10 w-full rounded bg-white/5" />
        <div className="h-10 w-32 rounded bg-white/10" />
      </Shimmer>
    </div>
  );
}
