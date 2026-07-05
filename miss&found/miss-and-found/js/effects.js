const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const getCssVarNumber = (name, fallback) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw.replace("px", ""));
  return Number.isFinite(value) ? value : fallback;
};

const initFadeIn = () => {
  document.body.classList.add("page-fade");
  requestAnimationFrame(() => {
    document.body.classList.add("page-fade--ready");
  });
};

const initStaggerReveal = () => {
  const items = [...document.querySelectorAll(".fade-in-up, .item-card, .postcard")];
  if (!items.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const delay = Number(el.dataset.revealDelay || 0);
          window.setTimeout(() => el.classList.add("is-visible"), delay);
          observer.unobserve(el);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach((el, i) => {
    if (!el.dataset.revealDelay) {
      el.dataset.revealDelay = String(i * 80);
    }
    observer.observe(el);
  });
};

const initParallax = () => {
  const root = document.querySelector("[data-parallax-root]");
  if (!root || prefersReducedMotion()) return;

  const layers = [...document.querySelectorAll("[data-parallax-depth]")];
  if (!layers.length) return;

  const state = {
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    rafId: null,
    active: true
  };

  const mainRange = getCssVarNumber("--parallax-main-range", 8);
  const depthRange = getCssVarNumber("--parallax-depth-range", 12);

  const tick = () => {
    if (!state.active) return;
    state.currentX += (state.targetX - state.currentX) * 0.08;
    state.currentY += (state.targetY - state.currentY) * 0.08;

    root.style.transform = `translate3d(${state.currentX * mainRange}px, ${state.currentY * mainRange}px, 0)`;
    layers.forEach((layer) => {
      const depth = Number(layer.dataset.parallaxDepth || 1);
      const moveX = state.currentX * depthRange * depth * -1;
      const moveY = state.currentY * depthRange * depth * -1;
      layer.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
    });

    state.rafId = requestAnimationFrame(tick);
  };

  const onMove = (event) => {
    const nx = event.clientX / window.innerWidth - 0.5;
    const ny = event.clientY / window.innerHeight - 0.5;
    state.targetX = nx * 2;
    state.targetY = ny * 2;
  };

  const onVisibility = () => {
    state.active = !document.hidden;
    if (state.active && !state.rafId) {
      state.rafId = requestAnimationFrame(tick);
    }
    if (!state.active && state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  };

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseleave", () => {
    state.targetX = 0;
    state.targetY = 0;
  });
  document.addEventListener("visibilitychange", onVisibility);
  state.rafId = requestAnimationFrame(tick);
};

const initPageEffects = () => {
  initFadeIn();
  initParallax();
  initStaggerReveal();
};

export { initPageEffects };
