import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import GradientBlob from "./icons/GradientBlob";
import { useAuth } from "../context/AuthContext";
import { setSessionItem } from "../lib/storage";

export default function LaunchScreen() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on mount
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Mark that user has seen the splash screen in this session
      setSessionItem("hasSeenSplash", "true");

      // Navigate based on authentication status
      if (isAuthenticated) {
        navigate("/dashboard/home");
      } else {
        navigate("/splash");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate, isAuthenticated]);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center overflow-hidden overflow-y-auto pt-safe pb-safe"
    >
      {/* Gradient Blob */}
      <GradientBlob
        className="absolute opacity-40 blur-3xl"
        style={{
          width: "400px",
          height: "400px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1">
        <img
          src="/z-logo-nobg.png"
          alt="Zendt Logo"
          className="w-32 h-32 object-contain animate-in fade-in zoom-in-95 duration-700"
        />
      </div>

      {/* Bottom Text */}
      <div className="relative z-10 pb-12">
        <h1 className="text-white text-headline font-light tracking-[0.3em] uppercase animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          zendt
        </h1>
      </div>
    </div>
  );
}
