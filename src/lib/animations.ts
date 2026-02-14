import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Scroll-triggered fade-in-up animation */
export function fadeInUp(
  elements: string | Element | Element[],
  options: { stagger?: number; delay?: number; y?: number; start?: string } = {},
) {
  if (prefersReducedMotion()) return;

  const { stagger = 0.12, delay = 0, y = 20, start = 'top 80%' } = options;

  gsap.from(elements, {
    scrollTrigger: {
      trigger: typeof elements === 'string' ? elements : (Array.isArray(elements) ? elements[0] : elements),
      start,
      toggleActions: 'play none none reverse',
    },
    y,
    opacity: 0,
    duration: 0.8,
    stagger,
    delay,
    ease: 'power3.out',
  });
}

/** Hero staggered entrance (no scroll trigger, plays on load) */
export function heroEntrance(selectors: string[], delay = 0.3) {
  if (prefersReducedMotion()) return;

  gsap.from(selectors, {
    y: 30,
    opacity: 0,
    duration: 0.9,
    stagger: 0.15,
    delay,
    ease: 'power3.out',
  });
}

/** Animated number count-up */
export function countUp(
  element: Element,
  endValue: number,
  options: { suffix?: string; prefix?: string; duration?: number; decimals?: number } = {},
) {
  const { suffix = '', prefix = '', duration = 1.5, decimals = 0 } = options;

  if (prefersReducedMotion()) {
    element.textContent = `${prefix}${decimals > 0 ? endValue.toFixed(decimals) : endValue.toLocaleString()}${suffix}`;
    return;
  }

  const obj = { val: 0 };

  gsap.to(obj, {
    val: endValue,
    duration,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: element,
      start: 'top 85%',
      toggleActions: 'play none none none',
    },
    onUpdate() {
      element.textContent = `${prefix}${decimals > 0 ? obj.val.toFixed(decimals) : Math.round(obj.val).toLocaleString()}${suffix}`;
    },
  });
}

/** Staggered children reveal within a container */
export function staggerReveal(
  container: string,
  children: string,
  options: { stagger?: number; y?: number } = {},
) {
  if (prefersReducedMotion()) return;

  const { stagger = 0.08, y = 20 } = options;

  gsap.from(`${container} ${children}`, {
    scrollTrigger: {
      trigger: container,
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
    y,
    opacity: 0,
    duration: 0.6,
    stagger,
    ease: 'power3.out',
  });
}

/** Refresh ScrollTrigger (call on view transition) */
export function refreshTriggers() {
  ScrollTrigger.refresh();
}
