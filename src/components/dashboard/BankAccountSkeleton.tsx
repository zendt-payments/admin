import { Shimmer } from "../motion";

export default function BankAccountSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3">
          <Shimmer className="rounded-[28px] h-[140px] p-5" bg="bg-[#1E1E1E]" rounded="rounded-[28px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/10" />
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-white/10 rounded" />
                  <div className="h-3 w-16 bg-white/5 rounded" />
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/10" />
            </div>
            <div className="h-3 w-32 bg-white/5 rounded" />
          </Shimmer>

          <div className="flex gap-3 px-1">
            <Shimmer className="flex-1 h-12" bg="bg-[#1E1E1E]" rounded="rounded-[14px]" />
            <Shimmer className="flex-1 h-12" bg="bg-[#1E1E1E]" rounded="rounded-[14px]" />
          </div>
        </div>
      ))}
    </div>
  );
}
