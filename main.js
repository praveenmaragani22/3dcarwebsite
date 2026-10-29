/**
 * NOCTIS — Scrollytelling Engine
 * Pure Vanilla JavaScript: 60fps canvas scrollytelling, progressive preloading,
 * custom headlight cursor, film-grain overlay, and responsive accordion.
 */

(function () {
  'use strict';

  const CFG = window.NOCTIS_CONFIG;
  if (!CFG) {
    console.error('NOCTIS_CONFIG not found.');
    return;
  }

  // Check prefers-reduced-motion
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let isReducedMotion = reducedMotionQuery.matches;
  reducedMotionQuery.addEventListener('change', (e) => {
    isReducedMotion = e.matches;
  });

  // Check pointer fine (desktop)
  const pointerFineQuery = window.matchMedia('(pointer: fine)');
  let isPointerFine = pointerFineQuery.matches;

  // Utility math functions
  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
  const lerp = (start, end, factor) => start + (end - start) * factor;

  /* ==========================================================================
     1. Progressive Frame Preloader & Frame Cache
     ========================================================================== */
  class SequenceLoader {
    constructor(key, config) {
      this.key = key;
      this.count = config.count;
      this.desktopPattern = config.desktopPath;
      this.mobilePattern = config.mobilePath;
      this.preloadInitial = config.preloadInitial || 30;
      this.lerpSpeed = config.lerpSpeed || 0.15;

      this.images = new Array(this.count);
      this.loadedIndices = new Set();
      this.totalLoaded = 0;
      this.isMobile = window.innerWidth < 768;

      window.addEventListener('resize', () => {
        const newMobile = window.innerWidth < 768;
        if (newMobile !== this.isMobile) {
          this.isMobile = newMobile;
          this.reloadFrames();
        }
      });
    }

    getFramePath(index) {
      const padNum = String(index + 1).padStart(4, '0');
      const pattern = this.isMobile ? this.mobilePattern : this.desktopPattern;
      return pattern.replace('{index}', padNum);
    }

    loadSingleFrame(index) {
      return new Promise((resolve) => {
        if (this.images[index] && this.images[index].complete) {
          resolve(this.images[index]);
          return;
        }

        const img = new Image();
        img.src = this.getFramePath(index);
        
        img.decode().then(() => {
          this.images[index] = img;
          this.loadedIndices.add(index);
          this.totalLoaded++;
          resolve(img);
        }).catch(() => {
          // Fallback if decode fails
          img.onload = () => {
            this.images[index] = img;
            this.loadedIndices.add(index);
            this.totalLoaded++;
            resolve(img);
          };
          img.onerror = () => {
            resolve(null);
          };
        });
      });
    }

    // Load initial critical frames for preloader
    async loadInitial(onProgress) {
      const promises = [];
      for (let i = 0; i < this.preloadInitial; i++) {
        promises.push(
          this.loadSingleFrame(i).then(() => {
            if (onProgress) {
              const pct = Math.round((this.totalLoaded / this.preloadInitial) * 100);
              onProgress(clamp(pct, 0, 100));
            }
          })
        );
      }
      await Promise.all(promises);
    }

    // Background progressive loader for the remaining frames
    async loadRemaining(onProgress) {
      for (let i = this.preloadInitial; i < this.count; i++) {
        await this.loadSingleFrame(i);
        if (onProgress) {
          onProgress(this.totalLoaded, this.count);
        }
      }
    }

    reloadFrames() {
      // Refresh current frame cache on mobile/desktop boundary switch
      for (let i = 0; i < this.count; i++) {
        if (this.images[i]) {
          const img = new Image();
          img.src = this.getFramePath(i);
          this.images[i] = img;
        }
      }
    }

    // Return exact image or nearest loaded frame to eliminate black frames
    getFrame(index) {
      const targetIdx = clamp(Math.round(index), 0, this.count - 1);
      if (this.images[targetIdx] && this.images[targetIdx].complete) {
        return this.images[targetIdx];
      }

      // Nearest loaded frame search
      let delta = 1;
      while (targetIdx - delta >= 0 || targetIdx + delta < this.count) {
        if (targetIdx - delta >= 0 && this.images[targetIdx - delta] && this.images[targetIdx - delta].complete) {
          return this.images[targetIdx - delta];
        }
        if (targetIdx + delta < this.count && this.images[targetIdx + delta] && this.images[targetIdx + delta].complete) {
          return this.images[targetIdx + delta];
        }
        delta++;
      }
      return null;
    }
  }

  const heroLoader = new SequenceLoader('hero', CFG.frames.hero);
  const dismantleLoader = new SequenceLoader('dismantle', CFG.frames.dismantle);

  /* ==========================================================================
     2. Preloader Logic
     ========================================================================== */
  const preloaderEl = document.getElementById('preloader');
  const preloaderLine = document.getElementById('preloader-line');
  const preloaderCounter = document.getElementById('preloader-counter');

  function updatePreloader(percent) {
    if (preloaderLine) preloaderLine.style.width = `${percent}%`;
    if (preloaderCounter) {
      preloaderCounter.textContent = String(percent).padStart(3, '0');
    }
    if (preloaderEl) {
      preloaderEl.setAttribute('aria-valuenow', percent);
    }
  }

  async function startPreloader() {
    updatePreloader(5);
    
    // Load hero frames 1–40 first
    await heroLoader.loadInitial((pct) => {
      updatePreloader(pct);
    });

    // On exit: line turns brighter for 120ms then fades to hero
    if (preloaderLine) {
      preloaderLine.style.backgroundColor = '#FFFFFF';
    }

    setTimeout(() => {
      if (preloaderEl) {
        preloaderEl.classList.add('is-hidden');
      }

      // Initial line reveals
      triggerLineReveals();

      // Background load: remaining hero frames, then dismantle frames
      heroLoader.loadRemaining().then(() => {
        dismantleLoader.loadRemaining();
      });
    }, 200);
  }

  /* ==========================================================================
     3. Film-Grain Overlay (Noise Tile Offscreen Canvas, No Vignette)
     ========================================================================== */
  function initFilmGrain() {
    const canvas = document.getElementById('grain-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Generate small offscreen noise tile (128x128)
    const tileSize = 128;
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = tileSize;
    tileCanvas.height = tileSize;
    const tileCtx = tileCanvas.getContext('2d');
    const imgData = tileCtx.createImageData(tileSize, tileSize);
    const buf = new Uint32Array(imgData.data.buffer);

    // Flat grayscale noise
    for (let i = 0; i < buf.length; i++) {
      const val = Math.floor(Math.random() * 255);
      // 0xAABBGGRR in little endian
      buf[i] = (255 << 24) | (val << 16) | (val << 8) | val;
    }
    tileCtx.putImageData(imgData, 0, 0);

    let pattern;
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      pattern = ctx.createPattern(tileCanvas, 'repeat');
    }
    window.addEventListener('resize', resize);
    resize();

    // Shift randomly ~8 times per second (125ms interval)
    let lastShift = 0;
    let shiftX = 0;
    let shiftY = 0;

    function renderGrain(timestamp) {
      if (timestamp - lastShift > 125) {
        lastShift = timestamp;
        shiftX = Math.floor(Math.random() * tileSize);
        shiftY = Math.floor(Math.random() * tileSize);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(shiftX, shiftY);
        ctx.fillStyle = pattern;
        ctx.fillRect(-shiftX, -shiftY, canvas.width + tileSize, canvas.height + tileSize);
        ctx.restore();
      }
      requestAnimationFrame(renderGrain);
    }
    requestAnimationFrame(renderGrain);
  }

  /* ==========================================================================
     4. Custom Headlight Cursor (Desktop Only)
     ========================================================================== */
  function initCustomCursor() {
    const cursor = document.getElementById('custom-cursor');
    const label = document.getElementById('cursor-label');
    if (!cursor || !isPointerFine || isReducedMotion) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let currentX = mouseX;
    let currentY = mouseY;
    let isVisible = false;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isVisible) {
        isVisible = true;
        cursor.style.display = 'flex';
      }
    });

    window.addEventListener('mousedown', () => {
      cursor.classList.add('is-active');
      setTimeout(() => cursor.classList.remove('is-active'), 120);
    });

    // Morphing over links, buttons, and lineup slides
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('.interactive, a, button, .accordion-slide');
      if (target) {
        cursor.classList.add('is-hovering');
        
        let labelText = target.getAttribute('data-cursor') || 'VIEW';
        if (target.classList.contains('accordion-slide')) {
          const isOpen = target.getAttribute('aria-expanded') === 'true';
          labelText = isOpen ? 'CONFIGURE' : 'OPEN';
        }
        if (label) label.textContent = labelText;
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('.interactive, a, button, .accordion-slide');
      if (target) {
        cursor.classList.remove('is-hovering');
      }
    });

    function updateCursor() {
      currentX = lerp(currentX, mouseX, 0.18);
      currentY = lerp(currentY, mouseY, 0.18);
      cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(updateCursor);
    }
    requestAnimationFrame(updateCursor);
  }

  /* ==========================================================================
     5. Header Navigation Scroll Tracking
     ========================================================================== */
  function initNavbar() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 100 && currentScrollY > lastScrollY) {
        navbar.classList.add('nav-hidden');
      } else {
        navbar.classList.remove('nav-hidden');
      }
      lastScrollY = currentScrollY;
    }, { passive: true });
  }

  /* ==========================================================================
     6. Section 1 — Hero Canvas & Scrollytelling
     ========================================================================== */
  const heroWrapper = document.getElementById('hero-wrapper');
  const heroCanvas = document.getElementById('hero-canvas');
  const heroOverlay = document.getElementById('hero-fade-overlay');
  const heroProgressLine = document.getElementById('hero-progress-line');
  const hudChapterText = document.getElementById('hud-chapter-text');
  const hudSpeed = document.getElementById('hud-speed');
  const hudDistance = document.getElementById('hud-distance');

  let heroCtx = null;
  let heroCurrentFrame = 0;
  let heroTargetFrame = 0;
  let heroLastDrawnFrame = -1;

  function initHeroCanvas() {
    if (!heroCanvas) return;
    heroCtx = heroCanvas.getContext('2d', { alpha: false });
    resizeHeroCanvas();
    window.addEventListener('resize', resizeHeroCanvas);
  }

  function resizeHeroCanvas() {
    if (!heroCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    heroCanvas.width = window.innerWidth * dpr;
    heroCanvas.height = window.innerHeight * dpr;
    heroLastDrawnFrame = -1; // force redraw
  }

  function drawHeroFrame(frameIndex) {
    if (!heroCtx || !heroCanvas) return;
    const img = heroLoader.getFrame(frameIndex);
    if (!img) return;

    const cw = heroCanvas.width;
    const ch = heroCanvas.height;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    const isPortrait = ch > cw;

    heroCtx.fillStyle = '#07080A';
    heroCtx.fillRect(0, 0, cw, ch);

    if (!isPortrait) {
      // Landscape: cover fit
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;
      heroCtx.drawImage(img, dx, dy, dw, dh);
    } else {
      // Portrait: contain fit vertically centered so car is never cropped
      const scale = Math.min(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;
      heroCtx.drawImage(img, dx, dy, dw, dh);
    }
  }

  function updateHeroScrollytelling() {
    if (!heroWrapper) return;
    const rect = heroWrapper.getBoundingClientRect();
    const scrollDist = heroWrapper.offsetHeight - window.innerHeight;
    const rawProgress = -rect.top / (scrollDist || 1);
    const progress = clamp(rawProgress, 0, 1);

    // Target frame based on progress
    heroTargetFrame = Math.round(progress * (CFG.frames.hero.count - 1));

    // Lerp smoothing
    heroCurrentFrame += (heroTargetFrame - heroCurrentFrame) * CFG.frames.hero.lerpSpeed;
    const roundedFrame = Math.round(heroCurrentFrame);

    if (roundedFrame !== heroLastDrawnFrame) {
      drawHeroFrame(roundedFrame);
      heroLastDrawnFrame = roundedFrame;
    }

    // Progress line at bottom
    if (heroProgressLine) {
      heroProgressLine.style.transform = `scaleX(${progress})`;
    }

    // Last 5% fade to solid black
    if (heroOverlay) {
      if (progress >= 0.95) {
        heroOverlay.style.opacity = String((progress - 0.95) / 0.05);
      } else {
        heroOverlay.style.opacity = '0';
      }
    }

    // Chapters management
    CFG.heroChapters.forEach((ch) => {
      const el = document.getElementById(ch.id);
      if (!el) return;
      const inRange = progress >= ch.start && progress <= ch.end;
      if (inRange) {
        if (!el.classList.contains('is-active')) {
          el.classList.add('is-active');
          el.querySelectorAll('.line-inner').forEach((line) => line.classList.add('revealed'));
        }
        if (hudChapterText) hudChapterText.textContent = ch.hudChapter;
      } else {
        if (el.classList.contains('is-active')) {
          el.classList.remove('is-active');
          el.querySelectorAll('.line-inner').forEach((line) => line.classList.remove('revealed'));
        }
      }
    });

    // Left HUD Telemetry updates
    const speed = Math.round(progress * CFG.heroHUD.maxSpeedKmH);
    const distance = (progress * CFG.heroHUD.maxDistanceKm).toFixed(1);
    if (hudSpeed) hudSpeed.textContent = `${String(speed).padStart(3, '0')} KM/H`;
    if (hudDistance) hudDistance.textContent = `${distance} KM`;
  }

  /* ==========================================================================
     7. Section 2 — Statement (Word by Word Opacity Reveal, 100vh)
     ========================================================================== */
  const statementSection = document.getElementById('statement-section');
  const statementQuote = document.getElementById('statement-quote');
  let statementWords = [];

  function initStatementWords() {
    if (!statementQuote) return;
    const text = statementQuote.textContent.trim();
    statementQuote.innerHTML = '';
    const words = text.split(/\s+/);
    statementWords = words.map((word) => {
      const span = document.createElement('span');
      span.className = 'statement-word';
      span.textContent = word + ' ';
      statementQuote.appendChild(span);
      return span;
    });
  }

  function updateStatementScrollytelling() {
    if (!statementSection || statementWords.length === 0) return;
    const rect = statementSection.getBoundingClientRect();
    const vh = window.innerHeight;
    // Word by word progress as section crosses center of viewport
    const progress = clamp((vh * 0.85 - rect.top) / (vh * 0.9), 0, 1);

    const totalWords = statementWords.length;
    statementWords.forEach((span, i) => {
      const wordThreshold = i / (totalWords - 1);
      // Opacity goes from 0.15 to 1.0
      if (progress >= wordThreshold) {
        span.style.opacity = '1.0';
      } else {
        span.style.opacity = '0.15';
      }
    });
  }

  /* ==========================================================================
     8. Section 3 — Dismantle Canvas & Dynamic Hairline Callouts
     ========================================================================== */
  const dismantleWrapper = document.getElementById('dismantle-wrapper');
  const dismantleCanvas = document.getElementById('dismantle-canvas');
  const dismantleProgressLine = document.getElementById('dismantle-progress-line');
  const dismantleCalloutsContainer = document.getElementById('dismantle-callouts-container');

  let dismantleCtx = null;
  let dismantleCurrentFrame = 0;
  let dismantleTargetFrame = 0;
  let dismantleLastDrawnFrame = -1;

  function initDismantleCanvas() {
    if (!dismantleCanvas) return;
    dismantleCtx = dismantleCanvas.getContext('2d', { alpha: false });
    resizeDismantleCanvas();
    window.addEventListener('resize', resizeDismantleCanvas);
    buildDismantleCallouts();
  }

  function resizeDismantleCanvas() {
    if (!dismantleCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dismantleCanvas.width = window.innerWidth * dpr;
    dismantleCanvas.height = window.innerHeight * dpr;
    dismantleLastDrawnFrame = -1;
    renderDismantleCalloutLines();
  }

  function drawDismantleFrame(frameIndex) {
    if (!dismantleCtx || !dismantleCanvas) return;
    const img = dismantleLoader.getFrame(frameIndex);
    if (!img) return;

    const cw = dismantleCanvas.width;
    const ch = dismantleCanvas.height;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    const isPortrait = ch > cw;

    dismantleCtx.fillStyle = '#07080A';
    dismantleCtx.fillRect(0, 0, cw, ch);

    if (!isPortrait) {
      // Landscape: cover fit
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;
      dismantleCtx.drawImage(img, dx, dy, dw, dh);
    } else {
      // Portrait: contain fit
      const scale = Math.min(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;
      dismantleCtx.drawImage(img, dx, dy, dw, dh);
    }
  }

  function buildDismantleCallouts() {
    if (!dismantleCalloutsContainer) return;
    dismantleCalloutsContainer.innerHTML = '';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'dismantle-svg');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';

    CFG.dismantleCallouts.forEach((callout) => {
      const g = document.createElement('div');
      g.className = 'callout-group';
      g.id = `callout-${callout.id}`;

      // Dot
      const dot = document.createElement('div');
      dot.className = 'callout-dot';
      dot.style.left = `${callout.dot.x}%`;
      dot.style.top = `${callout.dot.y}%`;

      // Text box
      const box = document.createElement('div');
      box.className = 'callout-text-box';
      box.style.left = `${callout.text.x}%`;
      box.style.top = `${callout.text.y}%`;
      box.innerHTML = `
        <span class="callout-mono-label font-hud">${callout.label}</span>
        <span class="callout-desc">${callout.title}</span>
      `;

      // Hairline SVG line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('id', `line-${callout.id}`);
      line.setAttribute('class', 'callout-hairline');
      svg.appendChild(line);

      g.appendChild(dot);
      g.appendChild(box);
      dismantleCalloutsContainer.appendChild(g);
    });

    dismantleCalloutsContainer.appendChild(svg);
    renderDismantleCalloutLines();
  }

  function renderDismantleCalloutLines() {
    const stage = document.getElementById('dismantle-stage');
    if (!stage) return;
    const w = stage.clientWidth;
    const h = stage.clientHeight;

    CFG.dismantleCallouts.forEach((callout) => {
      const line = document.getElementById(`line-${callout.id}`);
      if (line) {
        line.setAttribute('x1', String((callout.dot.x / 100) * w));
        line.setAttribute('y1', String((callout.dot.y / 100) * h));
        line.setAttribute('x2', String((callout.text.x / 100) * w));
        line.setAttribute('y2', String((callout.text.y / 100) * h));
      }
    });
  }

  function updateDismantleScrollytelling() {
    if (!dismantleWrapper) return;
    const rect = dismantleWrapper.getBoundingClientRect();
    const scrollDist = dismantleWrapper.offsetHeight - window.innerHeight;
    const rawProgress = -rect.top / (scrollDist || 1);
    const progress = clamp(rawProgress, 0, 1);

    dismantleTargetFrame = Math.round(progress * (CFG.frames.dismantle.count - 1));
    dismantleCurrentFrame += (dismantleTargetFrame - dismantleCurrentFrame) * CFG.frames.dismantle.lerpSpeed;
    const roundedFrame = Math.round(dismantleCurrentFrame);

    if (roundedFrame !== dismantleLastDrawnFrame) {
      drawDismantleFrame(roundedFrame);
      dismantleLastDrawnFrame = roundedFrame;
    }

    if (dismantleProgressLine) {
      dismantleProgressLine.style.transform = `scaleX(${progress})`;
    }

    // Callouts appear sequentially after 70% progress
    CFG.dismantleCallouts.forEach((callout) => {
      const el = document.getElementById(`callout-${callout.id}`);
      const line = document.getElementById(`line-${callout.id}`);
      if (!el || !line) return;
      if (progress >= callout.triggerProgress) {
        el.classList.add('is-visible');
        line.style.opacity = '1';
      } else {
        el.classList.remove('is-visible');
        line.style.opacity = '0';
      }
    });
  }

  /* ==========================================================================
     9. Section 4 — Lineup Hover Accordion (Desktop + Mobile Tap)
     ========================================================================== */
  function initLineupAccordion() {
    const accordion = document.getElementById('lineup-accordion');
    if (!accordion) return;
    accordion.innerHTML = '';

    CFG.cars.forEach((car, index) => {
      const isOpen = index === 0; // GT-E open by default

      const slide = document.createElement('button');
      slide.className = 'accordion-slide stagger-init interactive';
      slide.setAttribute('role', 'tab');
      slide.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      slide.setAttribute('aria-selected', isOpen ? 'true' : 'false');
      slide.setAttribute('aria-label', `${car.num} ${car.name} — ${car.tagline}`);
      slide.setAttribute('data-index', String(index));
      slide.setAttribute('data-cursor', isOpen ? 'CONFIGURE' : 'OPEN');
      slide.tabIndex = 0;

      // Closed state presentation
      const closedView = document.createElement('div');
      closedView.className = 'slide-closed-view';
      closedView.innerHTML = `
        <span class="slide-closed-number font-hud">${car.num}</span>
        <div class="slide-closed-name-wrap">
          <span class="slide-closed-name font-hud">${car.name}</span>
        </div>
      `;

      // Car image
      const imgContainer = document.createElement('div');
      imgContainer.className = 'slide-image-container';
      const img = document.createElement('img');
      img.className = 'slide-car-img';
      img.src = car.image;
      img.alt = car.alt;
      img.loading = 'lazy';
      imgContainer.appendChild(img);

      // Open state details presentation
      const openView = document.createElement('div');
      openView.className = 'slide-open-view';
      openView.innerHTML = `
        <div class="slide-top-details">
          <span class="font-hud">${car.num} — NOCTIS</span>
          <h3 class="slide-model-name font-display">${car.name}</h3>
        </div>
        <div class="slide-bottom-details">
          <p class="slide-tagline">${car.tagline}</p>
          <div class="slide-specs-row">
            <div class="spec-column">
              <span class="spec-key font-hud">RANGE</span>
              <span class="spec-value">${car.specs.range}</span>
            </div>
            <div class="spec-column">
              <span class="spec-key font-hud">0–100 KM/H</span>
              <span class="spec-value">${car.specs.accel}</span>
            </div>
            <div class="spec-column">
              <span class="spec-key font-hud">POWER</span>
              <span class="spec-value">${car.specs.power}</span>
            </div>
          </div>
          <div class="slide-actions-row">
            <div class="swatch-group" aria-label="Color swatches">
              ${car.swatches.map((color, sIdx) => `
                <span class="swatch-box ${sIdx === 0 ? 'is-active' : ''}" style="background-color: ${color};" aria-label="Color option ${sIdx + 1}"></span>
              `).join('')}
            </div>
            <a href="#reserve-section" class="slide-configure-link interactive" data-cursor="RESERVE">
              Configure →
            </a>
          </div>
        </div>
      `;

      slide.appendChild(closedView);
      slide.appendChild(imgContainer);
      slide.appendChild(openView);
      accordion.appendChild(slide);
    });

    // Slides selection logic with 80ms hover debounce
    const slides = accordion.querySelectorAll('.accordion-slide');
    let hoverTimeout = null;

    function openSlide(index) {
      slides.forEach((s, idx) => {
        const isCurrent = idx === index;
        s.setAttribute('aria-expanded', isCurrent ? 'true' : 'false');
        s.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
        s.setAttribute('data-cursor', isCurrent ? 'CONFIGURE' : 'OPEN');
      });
    }

    slides.forEach((slide, index) => {
      // Hover for desktop
      slide.addEventListener('mouseenter', () => {
        if (!isPointerFine) return;
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          openSlide(index);
        }, 80);
      });

      // Tap / Click for mobile and accessibility
      slide.addEventListener('click', (e) => {
        if (e.target.closest('.slide-configure-link')) return;
        openSlide(index);
      });

      // Keyboard arrow navigation
      slide.addEventListener('keydown', (e) => {
        let newIdx = index;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          newIdx = (index + 1) % slides.length;
          e.preventDefault();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          newIdx = (index - 1 + slides.length) % slides.length;
          e.preventDefault();
        }
        if (newIdx !== index) {
          openSlide(newIdx);
          slides[newIdx].focus();
        }
      });
    });

    // Swatches selection
    accordion.addEventListener('click', (e) => {
      const swatch = e.target.closest('.swatch-box');
      if (swatch) {
        const group = swatch.closest('.swatch-group');
        group.querySelectorAll('.swatch-box').forEach((s) => s.classList.remove('is-active'));
        swatch.classList.add('is-active');
      }
    });

    // Stagger entrance on scroll into view
    const lineupObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          slides.forEach((slide, i) => {
            setTimeout(() => {
              slide.classList.remove('stagger-init');
              slide.classList.add('stagger-in');
            }, i * 80);
          });
          lineupObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    lineupObserver.observe(accordion);
  }

  /* ==========================================================================
     10. Line Reveal Mask Animation Helper
     ========================================================================== */
  function triggerLineReveals() {
    const heroCh1 = document.getElementById('hero-ch1');
    if (heroCh1) {
      heroCh1.querySelectorAll('.line-inner').forEach((line) => {
        line.classList.add('revealed');
      });
    }
  }

  /* ==========================================================================
     11. Master RequestAnimationFrame Render Loop
     ========================================================================== */
  function onScroll() {
    updateHeroScrollytelling();
    updateStatementScrollytelling();
    updateDismantleScrollytelling();
  }

  function masterLoop() {
    onScroll();
    requestAnimationFrame(masterLoop);
  }

  /* ==========================================================================
     12. Reduced Motion Fallback
     ========================================================================== */
  function applyReducedMotionFallback() {
    if (!isReducedMotion) return;
    drawHeroFrame(0);
    drawDismantleFrame(0);
    document.querySelectorAll('.line-inner').forEach((line) => line.classList.add('revealed'));
  }

  /* ==========================================================================
     13. Initialization Entrypoint
     ========================================================================== */
  window.addEventListener('DOMContentLoaded', () => {
    initFilmGrain();
    initCustomCursor();
    initNavbar();
    initHeroCanvas();
    initStatementWords();
    initDismantleCanvas();
    initLineupAccordion();

    startPreloader();
    applyReducedMotionFallback();

    requestAnimationFrame(masterLoop);
  });

})();

