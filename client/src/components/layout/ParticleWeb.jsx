import { useEffect, useRef } from 'react';

/**
 * The web behind the sign-in form.
 *
 * Nodes drift, and any two close enough are joined by a line — the usual
 * constellation. What makes it worth having on this app in particular is the
 * wave: every so often, and whenever the cursor settles somewhere new, a
 * breadth-first search runs from the node nearest the pointer and the edges
 * light up ring by ring as it discovers them. It is the same traversal the
 * roadmap spends a whole pattern on, drawn at rest.
 *
 * Everything is one canvas and one rAF loop. It draws nothing that can be read,
 * so it is aria-hidden and pointer-events: none — the form above it is never
 * affected.
 */

/*
  Link distance and node density are one decision, not two: the graph has to
  stay connected or a breadth-first search dies two rings out and the whole
  point of the effect goes with it. At roughly one node per 9,500px² and a
  145px reach, the average node has about seven neighbours — dense enough that
  a wave crosses the panel, sparse enough to still read as a web.
*/
const LINK_DIST = 145;
const NODE_AREA = 9500;
const CURSOR_DIST = 190; // the pointer links to nodes this close
const PULL_DIST = 200;
const PULL_MAX = 16; // px a node leans toward the pointer at most

const WAVE_STEP = 95; // ms before the search reaches the next ring
/*
  Deliberately only a few rings' worth. Hold a node lit for longer than the
  search takes to cross the panel and every edge ends up lit at once — a flood,
  not a traversal, and bright enough to argue with the form. Fading in about
  four rings keeps a visible front travelling outward instead.
*/
const WAVE_FADE = 380;
const WAVE_COOLDOWN = 700; // ms before pointer movement may start another
const WAVE_IDLE = 3200; // ms before one starts on its own

/** Squared distance — the hot loops compare against a constant, so no sqrt. */
const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
const LINK_D2 = LINK_DIST * LINK_DIST;

/** `#abc` / `#aabbcc` / `rgb(...)` → `[r, g, b]`, falling back to mid grey. */
function parseColor(value) {
  const text = (value || '').trim();
  if (text.startsWith('#')) {
    const hex = text.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex;
    const n = Number.parseInt(full.slice(0, 6), 16);
    if (Number.isFinite(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const match = text.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (match) return [+match[1], +match[2], +match[3]];
  return [128, 128, 128];
}

export function ParticleWeb() {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let nodes = [];
    let raf = 0;
    let last = 0;
    // Cached rather than measured per pointermove: reading it on every move is a
    // forced reflow, and the panel only changes size on resize.
    let rect = { left: 0, top: 0 };

    // The pointer, in canvas coordinates. -1 means "not over the panel".
    const pointer = { x: -1, y: -1, inside: false };

    // Current traversal: which ring each node landed in, and when it started.
    let wave = null;
    let waveAt = -Infinity;

    let ink = [128, 128, 128];
    let accent = [255, 161, 22];
    let boost = 1;

    const readTheme = () => {
      const style = getComputedStyle(host);
      ink = parseColor(style.getPropertyValue('--text-3'));
      accent = parseColor(style.getPropertyValue('--accent'));
      // The same alphas read fainter against a light surface than a dark one.
      boost = document.documentElement.getAttribute('data-theme') === 'light' ? 1.6 : 1;
    };

    const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${Math.min(1, a * boost).toFixed(3)})`;

    const seed = () => {
      // Density, not a fixed count — the panel is half a window on a desktop and
      // the whole of one on a phone.
      const count = Math.round(Math.max(30, Math.min(88, (width * height) / NODE_AREA)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        // Lean toward the pointer, smoothed — an offset applied at draw time
        // rather than integrated into velocity, so it can never accumulate and
        // pull the whole web into a clump.
        ox: 0,
        oy: 0,
      }));
    };

    const measure = () => {
      rect = host.getBoundingClientRect();
    };

    const resize = () => {
      measure();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (reduced) draw(0, []);
    };

    /** Breadth-first from `source` over the edges that exist this instant. */
    const startWave = (source, neighbours) => {
      if (source < 0) return;
      const depth = new Int16Array(nodes.length).fill(-1);
      depth[source] = 0;
      const queue = [source];
      for (let head = 0; head < queue.length; head += 1) {
        const at = queue[head];
        for (const next of neighbours[at]) {
          if (depth[next] === -1) {
            depth[next] = depth[at] + 1;
            queue.push(next);
          }
        }
      }
      wave = { depth, start: performance.now() };
    };

    const nearestNode = (x, y) => {
      let best = -1;
      let bestDist = Infinity;
      nodes.forEach((node, i) => {
        const d = (node.x + node.ox - x) ** 2 + (node.y + node.oy - y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      return best;
    };

    function draw(now, glow) {
      ctx.clearRect(0, 0, width, height);

      // Edges first, so the nodes sit on top of their own lines.
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        const ax = a.x + a.ox;
        const ay = a.y + a.oy;

        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const bx = b.x + b.ox;
          const by = b.y + b.oy;
          const d2 = dist2(ax, ay, bx, by);
          if (d2 > LINK_D2) continue;

          const near = 1 - Math.sqrt(d2) / LINK_DIST;
          const lit = glow.length ? Math.min(glow[i], glow[j]) : 0;

          ctx.strokeStyle = lit
            ? rgba(accent, 0.32 * lit * (0.5 + 0.5 * near))
            : rgba(ink, 0.16 * near);
          ctx.lineWidth = lit ? 1.1 : 0.8;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }

        // The pointer behaves as one more node, minus the physics.
        if (pointer.inside) {
          const dist = Math.sqrt(dist2(ax, ay, pointer.x, pointer.y));
          if (dist < CURSOR_DIST) {
            ctx.strokeStyle = rgba(accent, 0.26 * (1 - dist / CURSOR_DIST));
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        const lit = glow.length ? glow[i] : 0;
        ctx.fillStyle = lit ? rgba(accent, 0.3 + 0.45 * lit) : rgba(ink, 0.36);
        ctx.beginPath();
        ctx.arc(node.x + node.ox, node.y + node.oy, 1.3 + lit * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const frame = (now) => {
      raf = requestAnimationFrame(frame);

      // Normalised to a 60Hz step, and clamped so a backgrounded tab does not
      // resume by teleporting every node across the panel.
      const dt = last ? Math.min(3, (now - last) / 16.667) : 1;
      last = now;

      const neighbours = nodes.map(() => []);

      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        node.x += node.vx * dt;
        node.y += node.vy * dt;
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;
        node.x = Math.max(0, Math.min(width, node.x));
        node.y = Math.max(0, Math.min(height, node.y));

        let targetOx = 0;
        let targetOy = 0;
        if (pointer.inside) {
          const dx = pointer.x - node.x;
          const dy = pointer.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0.01 && dist < PULL_DIST) {
            const force = (1 - dist / PULL_DIST) ** 2 * PULL_MAX;
            targetOx = (dx / dist) * force;
            targetOy = (dy / dist) * force;
          }
        }
        node.ox += (targetOx - node.ox) * Math.min(1, 0.12 * dt);
        node.oy += (targetOy - node.oy) * Math.min(1, 0.12 * dt);
      }

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          if (dist2(a.x + a.ox, a.y + a.oy, b.x + b.ox, b.y + b.oy) <= LINK_D2) {
            neighbours[i].push(j);
            neighbours[j].push(i);
          }
        }
      }

      // Nothing has started one in a while, so start one anyway — the panel
      // should be alive for someone who never moves the mouse.
      if (now - waveAt > WAVE_IDLE) {
        waveAt = now;
        startWave(
          pointer.inside
            ? nearestNode(pointer.x, pointer.y)
            : Math.floor(Math.random() * nodes.length),
          neighbours,
        );
      }

      let glow = [];
      if (wave) {
        const elapsed = performance.now() - wave.start;
        glow = new Array(nodes.length);
        let anyLit = false;
        for (let i = 0; i < nodes.length; i += 1) {
          const depth = wave.depth[i];
          const age = depth < 0 ? -1 : elapsed - depth * WAVE_STEP;
          const value = age < 0 ? 0 : Math.max(0, 1 - age / WAVE_FADE);
          glow[i] = value;
          if (value > 0) anyLit = true;
        }
        // The search has run its course; stop paying for it every frame.
        if (!anyLit && elapsed > WAVE_STEP) {
          wave = null;
          glow = [];
        }
      }

      draw(now, glow);
    };

    /*
      Listened for on the window, not on this element. The canvas sits behind
      the form and takes no pointer events at all, so an element-level listener
      would go quiet the moment the cursor crossed onto an input — exactly where
      someone using the page spends their time.
    */
    const onPointerMove = (event) => {
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.inside =
        pointer.x >= 0 && pointer.y >= 0 && pointer.x <= width && pointer.y <= height;

      if (reduced || !pointer.inside) return;
      const now = performance.now();
      if (now - waveAt < WAVE_COOLDOWN) return;
      waveAt = now;
      // Rebuilt here rather than reusing the frame's copy: this fires between
      // frames, and a stale adjacency would search edges that no longer exist.
      const neighbours = nodes.map(() => []);
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          if (dist2(a.x + a.ox, a.y + a.oy, b.x + b.ox, b.y + b.oy) <= LINK_D2) {
            neighbours[i].push(j);
            neighbours[j].push(i);
          }
        }
      }
      startWave(nearestNode(pointer.x, pointer.y), neighbours);
    };

    const onPointerLeave = () => {
      pointer.inside = false;
    };

    const start = () => {
      if (raf || reduced) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // A hidden tab still gets rAF in some browsers and none in others; stopping
    // explicitly makes the behaviour the same everywhere.
    const onVisibility = () => (document.hidden ? stop() : start());

    readTheme();
    resize();
    start();

    const themes = new MutationObserver(() => {
      readTheme();
      if (reduced) draw(0, []);
    });
    // `style` too: a custom accent is an inline property on <html>, so it
    // changes no attribute the other two would catch.
    themes.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-accent', 'style'],
    });

    const sizes = new ResizeObserver(resize);
    sizes.observe(host);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', measure, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      themes.disconnect();
      sizes.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', measure);
      document.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className="auth-web" ref={hostRef} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
