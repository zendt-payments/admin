import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import AuthBackground from "./AuthBackground";

import "swiper/css";
import "swiper/css/pagination";

export default function SplashScreen() {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const swiperRef = useRef<any>(null);

  const slides = [
    {
      id: 1,
      category: "Built For Freelancers",
      description:
        "India's complete financial stack for creators, developers, designers, and professionals.",
    },
    {
      id: 2,
      category: "Get Paid From Anywhere",
      description:
        "Receive money from 190+ countries Including GCC currencies (QAR, AED, SAR, OMR, BHD, KWD)",
    },
    {
      id: 3,
      category: "Know Your Money",
      description: "Track earnings, clients, invoices, and cash flow — all in one dashboard.",
    },
  ];

  const handleSkip = () => {
    navigate("/login");
  };

  return (
    <AuthBackground showNavigation={false}>
      {/* Skip Button */}
      <div className="absolute right-6 top-safe-6 z-30">
        {activeIndex < slides.length - 1 && (
          <button
            onClick={handleSkip}
            className="text-white/60 hover:text-white text-body font-medium transition-colors"
          >
            Skip
          </button>
        )}
      </div>

      {/* FIXED TITLE — Moved further down */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <div className="flex flex-col h-full w-full justify-end items-center">
          {/* Adjust pb-[280px] to move it up or down. 
              Higher number = moves UP
              Lower number = moves DOWN 
          */}
          <div className="text-center pb-[350px]">
            <h1 className="text-display font-medium text-white mb-2 tracking-wide uppercase">ZENDT</h1>
            <h2 className="text-title text-white/90 font-light">Global Payments. Reimagined.</h2>
          </div>
        </div>
      </div>

      {/* Swiper */}
      <div className="absolute inset-0 z-10">
        <Swiper
          modules={[Pagination]}
          onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
          ref={swiperRef}
          className="h-full w-full"
        >
          {slides.map((slide) => (
            <SwiperSlide key={slide.id}>
              <div className="flex flex-col h-full w-full">
                {/* Spacer — replaces heading area exactly */}
                <div className="flex-1" />

                {/* Content Area */}
                <div className="pb-12 w-full">
                  <div className="flex flex-col items-center justify-end px-8 text-center pb-4">
                    {/* Category Heading */}
                    <div className="mb-4">
                      <span className="text-caption uppercase tracking-[0.2em] text-white/60">
                        {slide.category}
                      </span>
                    </div>

                    {/* Description - Fixed height ensures the category above doesn't move */}
                    <div className="h-[60px] flex items-start justify-center">
                      <p className="text-white/50 text-body leading-relaxed max-w-[280px]">
                        {slide.description}
                      </p>
                    </div>
                  </div>

                  {/* Footer spacer */}
                  <div className="h-[120px]" />
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* FIXED FOOTER */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-12 pointer-events-none">
        {/* Pagination */}
        <div className="flex justify-center gap-1.5 mt-4 mb-8">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === activeIndex ? "w-1.5 bg-white" : "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>

        {/* Get Started Button */}
        <div className="h-12 flex justify-center items-center px-8 pointer-events-auto">
          {activeIndex === slides.length - 1 && (
            <button
              onClick={() => navigate("/login")}
              className="w-full max-w-xs bg-white text-black font-medium py-3 rounded-full hover:bg-gray-100 transition-all animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              Get Started
            </button>
          )}
        </div>
      </div>

      {/* Disable default Swiper pagination */}
      <style>{`
        .swiper-pagination {
          display: none;
        }
      `}</style>
    </AuthBackground>
  );
}
