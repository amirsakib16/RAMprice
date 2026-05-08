/* ═══════════════════════════════════════════════════════════════
   RAM Price Predictor — script.js
   Handles: form validation, loading state, result animations
═══════════════════════════════════════════════════════════════ */

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const CIRCUMFERENCE = 2 * Math.PI * 28; // matches r="28" in SVG

// ── Init on DOM ready ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initFormValidation();
  initLoadingState();
  animateResultIfPresent();
  scrollToResultIfPresent();
  restoreCheckboxesFromURL();
});

// ── 1. FORM VALIDATION ─────────────────────────────────────────────────────
function initFormValidation() {
  const form = document.getElementById('predict-form');
  if (!form) return;

  const rules = {
    capacity_gb:   { min: 1,    max: 4096,  label: 'Capacity' },
    bus_speed_mhz: { min: 100,  max: 12000, label: 'Bus Speed' },
    demand_ratio:  { min: 0,    max: 1,     label: 'Demand Ratio', optional: true },
    brand:         { notEmpty: true,        label: 'Brand' },
  };

  // Validate on blur per field
  Object.keys(rules).forEach(name => {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return;
    input.addEventListener('blur', () => validateField(input, rules[name]));
    input.addEventListener('input', () => clearError(input));
  });

  // Validate all on submit
  form.addEventListener('submit', (e) => {
    let hasError = false;
    Object.keys(rules).forEach(name => {
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) return;
      if (!validateField(input, rules[name])) hasError = true;
    });
    if (hasError) {
      e.preventDefault();
      // Focus first invalid field
      const firstError = form.querySelector('.field__input.is-error');
      if (firstError) firstError.focus();
    }
  });
}

/**
 * Validates a single input against a rule object.
 * @returns {boolean} true = valid
 */
function validateField(input, rule) {
  const val = input.value.trim();
  const errorEl = input.closest('.field')?.querySelector('.field__error');
  let message = '';

  if (rule.optional && val === '') {
    clearError(input);
    return true;
  }

  if (!val) {
    message = `${rule.label} is required.`;
  } else if (rule.min !== undefined || rule.max !== undefined) {
    const num = parseFloat(val);
    if (isNaN(num)) {
      message = `${rule.label} must be a number.`;
    } else if (rule.min !== undefined && num < rule.min) {
      message = `${rule.label} must be ≥ ${rule.min}.`;
    } else if (rule.max !== undefined && num > rule.max) {
      message = `${rule.label} must be ≤ ${rule.max}.`;
    }
  }

  if (message) {
    input.classList.add('is-error');
    if (errorEl) errorEl.textContent = message;
    return false;
  }

  clearError(input);
  return true;
}

function clearError(input) {
  input.classList.remove('is-error');
  const errorEl = input.closest('.field')?.querySelector('.field__error');
  if (errorEl) errorEl.textContent = '';
}

// ── 2. LOADING STATE ───────────────────────────────────────────────────────
function initLoadingState() {
  const form = document.getElementById('predict-form');
  const btn  = document.getElementById('submit-btn');
  if (!form || !btn) return;

  form.addEventListener('submit', (e) => {
    // Only show spinner if form is actually submitting (no validation errors)
    if (form.querySelector('.field__input.is-error')) return;
    btn.classList.add('is-loading');
    btn.disabled = true;

    // Safety fallback: remove after 10 s in case of network error
    setTimeout(() => {
      btn.classList.remove('is-loading');
      btn.disabled = false;
    }, 10000);
  });
}

// ── 3. RESULT ANIMATIONS ───────────────────────────────────────────────────
function animateResultIfPresent() {
  animateProbBars();
  animateConfidenceRing();
}

/**
 * Animates probability bar fills from 0 → target width.
 * Data-target attribute holds the final % value.
 */
function animateProbBars() {
  const bars = document.querySelectorAll('.prob-bar-fill[data-target]');
  if (!bars.length) return;

  bars.forEach((bar, i) => {
    const target = parseFloat(bar.dataset.target);
    const valueEl = document.getElementById(`prob-val-${i + 1}`);

    // Small stagger per bar
    setTimeout(() => {
      // Animate the width
      bar.style.width = `${target}%`;

      // Animate the counter
      animateCounter(valueEl, target, 900, (v) => `${v.toFixed(1)}%`);
    }, i * 120);
  });
}

/**
 * Animates the SVG ring stroke from 0 → confidence %.
 */
function animateConfidenceRing() {
  const ring    = document.getElementById('confidence-ring');
  const fill    = document.getElementById('ring-fill');
  const label   = document.getElementById('ring-label');
  if (!ring || !fill || !label) return;

  const targetPct = parseFloat(ring.dataset.value); // e.g. 94.5

  // Dash formula: dasharray = (pct/100) * circumference, rest
  const targetDash = (targetPct / 100) * CIRCUMFERENCE;

  setTimeout(() => {
    fill.style.strokeDasharray = `${targetDash} ${CIRCUMFERENCE}`;
    animateCounter(label, targetPct, 1000, (v) => `${Math.round(v)}%`);
  }, 200);
}

/**
 * Generic counter animation.
 * @param {Element} el  - DOM element to update textContent
 * @param {number}  end - Final value
 * @param {number}  dur - Duration in ms
 * @param {Function} fmt - Formatter function
 */
function animateCounter(el, end, dur, fmt) {
  if (!el) return;
  const start = performance.now();
  const from  = 0;

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / dur, 1);
    const eased = easeOutCubic(progress);
    const current = from + (end - from) * eased;
    el.textContent = fmt(current);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

/** Easing function for smooth deceleration */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// ── 4. SCROLL TO RESULT ────────────────────────────────────────────────────
function scrollToResultIfPresent() {
  const resultCard = document.getElementById('result-card');
  if (!resultCard) return;

  // On mobile (single column), scroll to the result after submit
  if (window.innerWidth <= 900) {
    setTimeout(() => {
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}

// ── 5. RESTORE CHECKBOXES ──────────────────────────────────────────────────
/**
 * Flask re-renders the page with form data on POST.
 * Checkbox `checked` state is handled server-side in the template.
 * This function adds a visual "active" state to checked toggles.
 */
function restoreCheckboxesFromURL() {
  document.querySelectorAll('.toggle__input').forEach(cb => {
    updateToggleStyle(cb);
    cb.addEventListener('change', () => updateToggleStyle(cb));
  });
}

function updateToggleStyle(cb) {
  const toggle = cb.closest('.toggle');
  if (!toggle) return;
  if (cb.checked) {
    toggle.style.borderColor = 'var(--blue)';
    toggle.style.background  = 'var(--blue-pale)';
  } else {
    toggle.style.borderColor = '';
    toggle.style.background  = '';
  }
}

// ── 6. DEMAND RATIO HINT ───────────────────────────────────────────────────
// Show a live human-readable interpretation as the user types
(function initDemandHint() {
  const input = document.getElementById('demand_ratio');
  if (!input) return;

  const hints = [
    [0,   0.2,  'Very low demand'],
    [0.2, 0.4,  'Low demand'],
    [0.4, 0.6,  'Moderate demand'],
    [0.6, 0.8,  'High demand'],
    [0.8, 1.01, 'Very high demand'],
  ];

  const hintEl = document.createElement('span');
  hintEl.style.cssText = `
    font-size:.68rem; color:var(--blue); font-weight:600;
    display:block; margin-top:.15rem; min-height:1rem;
    font-family:var(--font-mono);
    transition:opacity .2s;
  `;
  input.parentElement.appendChild(hintEl);

  function updateHint() {
    const v = parseFloat(input.value);
    if (isNaN(v) || input.value === '') { hintEl.textContent = ''; return; }
    const match = hints.find(([lo, hi]) => v >= lo && v < hi);
    hintEl.textContent = match ? `→ ${match[2]}` : '';
  }

  input.addEventListener('input', updateHint);
  updateHint();
})();

// ── 7. CAPACITY QUICK PRESETS ──────────────────────────────────────────────
(function initCapacityPresets() {
  const input = document.getElementById('capacity_gb');
  if (!input) return;

  const presets = [4, 8, 16, 32, 64, 128];
  const wrap    = document.createElement('div');
  wrap.style.cssText = 'display:flex; gap:.35rem; flex-wrap:wrap; margin-top:.35rem;';

  presets.forEach(v => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = `${v} GB`;
    chip.style.cssText = `
      font-size:.68rem; font-weight:600; padding:.2rem .55rem;
      border:1px solid var(--border); border-radius:4px;
      background:var(--bg); color:var(--ink-mid);
      cursor:pointer; font-family:var(--font-mono);
      transition:background .15s, border-color .15s, color .15s;
    `;
    chip.addEventListener('mouseenter', () => {
      chip.style.background    = 'var(--blue-pale)';
      chip.style.borderColor   = 'var(--blue)';
      chip.style.color         = 'var(--blue)';
    });
    chip.addEventListener('mouseleave', () => {
      chip.style.background    = 'var(--bg)';
      chip.style.borderColor   = 'var(--border)';
      chip.style.color         = 'var(--ink-mid)';
    });
    chip.addEventListener('click', () => {
      input.value = v;
      input.dispatchEvent(new Event('input'));
      input.focus();
    });
    wrap.appendChild(chip);
  });

  input.parentElement.appendChild(wrap);
})();

// ── 8. BRAND SEARCH FILTER ─────────────────────────────────────────────────
(function initBrandSearch() {
  const searchInput = document.getElementById('brand-search');
  const select      = document.getElementById('brand');
  if (!searchInput || !select) return;

  // Create no-match message
  const noMatch = document.createElement('span');
  noMatch.className = 'brand-no-match';
  noMatch.textContent = 'No brands match your search.';
  select.parentElement.appendChild(noMatch);

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    Array.from(select.options).forEach(opt => {
      if (!opt.value) return;                        // keep placeholder
      const matches = opt.text.toLowerCase().includes(query);
      opt.classList.toggle('hidden', !matches);
      if (matches) visibleCount++;
    });

    // If selected option is now hidden, reset selection
    const selectedOpt = select.options[select.selectedIndex];
    if (selectedOpt && selectedOpt.classList.contains('hidden')) {
      select.selectedIndex = 0;
    }

    noMatch.classList.toggle('visible', visibleCount === 0);
  });

  // Clear search box when a brand is chosen
  select.addEventListener('change', () => {
    searchInput.value = '';
    // Show all options again
    Array.from(select.options).forEach(opt => opt.classList.remove('hidden'));
    noMatch.classList.remove('visible');

    // Visual feedback — flash border green briefly
    select.style.borderColor = 'var(--green)';
    setTimeout(() => { select.style.borderColor = ''; }, 800);
  });

  // Sync validation with the brand select
  select.addEventListener('change', () => {
    const errorEl = document.getElementById('brand-error');
    if (select.value && errorEl) errorEl.textContent = '';
    select.classList.remove('is-error');
  });
})();