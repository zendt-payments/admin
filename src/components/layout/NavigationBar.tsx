import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAvatar } from "../../context/AvatarContext";
import { DEFAULT_AVATAR_RADIUS_CLASS, isDefaultAvatar } from "../../constants/avatar";
import GradientBlob from "../icons/GradientBlob";

interface NavigationBarProps {
  className?: string;
  centerContent?: ReactNode;
}

export default function NavigationBar({ className, centerContent }: NavigationBarProps) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const { avatarSrc } = useAvatar();
  const showDefaultShape = isDefaultAvatar(avatarSrc);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <header className={["relative z-[999]", className].filter(Boolean).join(" ")}>
      <div className="mx-auto flex max-w-4xl items-center justify-between rounded-[28px] py-3 gap-4">
        {/* Logo on the left */}
        <div className="flex items-center">
          <img src="/z-logo-nobg.png" alt="Zendt Logo" className="h-10 w-10 object-contain" />
        </div>

        <div className="relative">
          {/* Hamburger menu removed */}
          <GradientBlob
            className="absolute blur-2xl -z-10"
            style={{
              right: "0px",
              top: "-50px",
              width: "321px",
              height: "262px",
              zIndex: "0",
              opacity: "0.5",
            }}
          />
        </div>

        {centerContent && <div className="hidden md:flex flex-1 justify-center">{centerContent}</div>}

        <Link
          to="/dashboard/profile"
          className={["h-14 w-14 overflow-hidden shadow-lg", DEFAULT_AVATAR_RADIUS_CLASS].join(" ")}
        >
          <img
            src={avatarSrc}
            alt="Profile"
            className={showDefaultShape ? "h-full w-full object-contain" : "h-full w-full object-cover"}
          />
        </Link>
      </div>
    </header>
  );
}
