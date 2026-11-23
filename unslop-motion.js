/*
 * Dark Anime Walls / Unslop motion controller.
 * Scroll progress communicates position. Observers reveal content once.
 * No RAF loop when idle; no auto-playing artwork, parallax, or scroll hijacking.
 * Unslop by Damir Sokolovsky, CC BY 4.0: https://github.com/heydamir/unslop
 */
(() => {
  "use strict";
  const body = document.body;
  if (!body.matches(".preview-home,.preview-collection,.preview-studio")) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canReveal = !reducedMotion.matches && "IntersectionObserver" in window;
  const isHome = body.classList.contains("preview-home");
  const isCollection = body.classList.contains("preview-collection");

  // The line indicates actual reading progress, not an endless decorative timer.
  if (isHome || isCollection) {
    const track = document.createElement("div");
    track.className = "daw-scroll-progress";
    track.setAttribute("aria-hidden", "true");
    const bar = document.createElement("span");
    track.append(bar);
    body.append(track);

    let frame = 0;
    const updateScroll = () => {
      frame = 0;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const progress = maxScroll ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
      bar.style.transform = "scaleX(" + progress.toFixed(4) + ")";
      body.classList.toggle("motion-scrolled", window.scrollY > 32);
    };
    const requestScrollUpdate = () => {
      if (!frame) frame = requestAnimationFrame(updateScroll);
    };
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate, { passive: true });
    window.addEventListener("pageshow", requestScrollUpdate);
    requestScrollUpdate();
  }

  if (canReveal) {
    body.classList.add("motion-ready");

    const sections = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("motion-section-entered");
        sections.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -20px 0px" });

    const cards = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("motion-entered");
        cards.unobserve(entry.target);
      });
    }, { threshold: 0.06, rootMargin: "0px 0px -12px 0px" });

    if (isCollection) {
      document.querySelectorAll(".hero,.headrow,.info").forEach((el) => {
        el.classList.add("motion-section");
        sections.observe(el);
      });
    }

    // Gallery cards may be rebuilt after searching, sorting, or changing pages.
    // Attach once to each new card, with a tiny stagger on only the first six.
    const gallerySelectors = isHome
      ? ["#galleryGrid", "#mobileGrid", "#desktopGrid"]
      : isCollection ? ["#items"] : ["#list"];
    gallerySelectors.forEach((selector) => {
      const container = document.querySelector(selector);
      if (!container) return;
      const attach = () => {
        const items = Array.from(container.children).filter((el) => el.matches(".card,.item"));
        items.forEach((el, index) => {
          if (el.dataset.motionObserved === "yes") return;
          el.dataset.motionObserved = "yes";
          el.style.setProperty("--daw-stagger", Math.min(index, 5) * 45 + "ms");
          cards.observe(el);
        });
      };
      const mutationObserver = new MutationObserver(attach);
      mutationObserver.observe(container, { childList: true });
      attach();
    });
  }

  // The only hero animation after loading is explicitly initiated by the visitor.
  if (isHome) {
    window.addEventListener("daw:spotlight-changed", () => {
      if (reducedMotion.matches || !Element.prototype.animate) return;
      ["heroDesktopImage", "heroMobileImage"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.animate([
          { opacity: 0.66, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0)" }
        ], { duration: 360, easing: "cubic-bezier(.22,1,.36,1)" });
      });
    });
  }
})();
