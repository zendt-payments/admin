import DoubleBgBox from "../doubleBgBox";

type Props = {
  completedDateLine?: string;
  completedTimeLine?: string;
};

export default function LastSuccessfulCreditCard({ completedDateLine, completedTimeLine }: Props) {
  const hasCredit = Boolean(completedDateLine?.trim());

  return (
    <DoubleBgBox fitContent layout="between" arcColor="#272727" className="h-full">
      <div className="flex h-full flex-col justify-between gap-4 text-left text-white">
        <div className="flex shrink-0 flex-col gap-1">
          <p className="text-caption uppercase tracking-[0.2em]">Last</p>
          <p className="text-title font-semibold leading-tight">PAYMENT</p>
        </div>
        {hasCredit ? (
          <div className="shrink-0 space-y-1.5">
            <p className="text-title font-semibold leading-snug text-white">{completedDateLine}</p>
            {completedTimeLine ? (
              <p className="text-body font-light leading-snug text-white/75">at {completedTimeLine}</p>
            ) : null}
          </div>
        ) : (
          <p className="shrink-0 text-body leading-snug text-white/40">No payment yet</p>
        )}
      </div>
    </DoubleBgBox>
  );
}
