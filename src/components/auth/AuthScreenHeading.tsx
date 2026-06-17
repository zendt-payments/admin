/** Eyebrow + headline for login / signup / forgot-password */
export default function AuthScreenHeading({
  eyebrow,
  title,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  className?: string;
}) {
  return (
    <header className={["mx-auto mb-8 max-w-sm text-center", className].filter(Boolean).join(" ")}>
      {eyebrow ? (
        <p className="mb-3 text-caption font-medium uppercase tracking-[0.28em] text-emerald-200/45">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-headline sm:text-headline font-extralight tracking-[-0.03em] text-white leading-[1.15] text-balance">
        {title}
      </h2>
    </header>
  );
}
