import { useState } from "react";
import { User } from "lucide-react";

/** Counterparty avatar for transaction rows — photo URL if present; default silhouette otherwise. */
export function CounterpartyAvatar({ avatarUrl }: { avatarUrl?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(avatarUrl && !imgFailed);

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[8.67px] bg-white/10 ring-1 ring-white/10">
      {showPhoto ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <User className="h-[22px] w-[22px] text-white/45" strokeWidth={1.35} aria-hidden />
      )}
    </div>
  );
}
