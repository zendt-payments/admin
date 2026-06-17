import { Shimmer } from "../../motion";

type Props = {
  rows?: number;
  className?: string;
};

/** Shimmer rows for transaction / payment-link / invoice lists. */
export default function ListRowsSkeleton({ rows = 5, className = "" }: Props) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Shimmer
          key={i}
          className="flex h-14 w-full items-center justify-between gap-3 px-3"
          bg="bg-white/5"
          rounded="rounded-[12px]"
        >
          <div className="h-4 w-32 rounded bg-white/10" />
          <div className="h-4 w-16 rounded bg-white/10" />
        </Shimmer>
      ))}
    </div>
  );
}
