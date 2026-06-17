import { useNavigate } from "react-router-dom";
import { performAppBack } from "../../lib/appBack";
import { PressableButton } from "../motion";

interface BackButtonProps {
  onClick?: () => void;
}

export default function BackButton({ onClick }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    performAppBack(navigate);
  };

  return (
    <PressableButton
      type="button"
      onClick={handleClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.9, x: -2 }}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:text-white focus-visible:outline-none"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="27" viewBox="0 0 13 27" fill="none">
        <path
          d="M11.8433 26.5L1.67169 16.3284C0.109592 14.7663 0.109592 12.2337 1.67169 10.6716L11.8433 0.499999"
          stroke="currentColor"
          strokeLinecap="round"
        />
      </svg>
    </PressableButton>
  );
}
