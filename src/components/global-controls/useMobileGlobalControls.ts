import { useEffect, useState, type RefObject } from "react";

export const MOBILE_CONTROLS_MAX_WIDTH = 640;

export function useMobileGlobalControls(ref: RefObject<HTMLElement | null>) {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileControlsSticky, setIsMobileControlsSticky] = useState(false);
  const [isMobileControlsOverlayOpen, setIsMobileControlsOverlayOpen] = useState(false);

  useEffect(() => {
    function syncMobileControlsState() {
      const isMobile = window.innerWidth <= MOBILE_CONTROLS_MAX_WIDTH;
      const isSticky =
        isMobile && ref.current
          ? ref.current.getBoundingClientRect().top <= 8
          : false;

      setIsMobileViewport(isMobile);
      setIsMobileControlsSticky(isSticky);

      if (!isMobile) {
        setIsMobileControlsOverlayOpen(false);
      }
    }

    syncMobileControlsState();
    window.addEventListener("scroll", syncMobileControlsState, { passive: true });
    window.addEventListener("resize", syncMobileControlsState);

    return () => {
      window.removeEventListener("scroll", syncMobileControlsState);
      window.removeEventListener("resize", syncMobileControlsState);
    };
  }, [ref]);

  useEffect(() => {
    if (!(isMobileViewport && isMobileControlsOverlayOpen)) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileControlsOverlayOpen, isMobileViewport]);

  function handleMobileControlsToggle() {
    setIsMobileControlsOverlayOpen((currentValue) => !currentValue);
  }

  function closeMobileControlsOverlay() {
    setIsMobileControlsOverlayOpen(false);
  }

  return {
    isMobileViewport,
    isMobileControlsSticky,
    isMobileControlsOverlayOpen,
    showMobileControlsSummary: isMobileViewport,
    showMobileControlsOverlay: isMobileViewport && isMobileControlsOverlayOpen,
    showInlineGlobalControlsRow: !isMobileViewport,
    handleMobileControlsToggle,
    closeMobileControlsOverlay
  };
}
