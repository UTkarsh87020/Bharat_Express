const FTMotion = (() => {
  const PAGES = new Set(["home", "dashboard", "orders", "drivers", "emergency", "about", "help", "contact"]);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let mapRaf = 0;
  let mapStarted = false;

  function showPage(name) {
    document.querySelectorAll(".page").forEach((page) => {
      page.classList.toggle("active", page.id === name);
    });
    document.querySelectorAll(".main-nav a").forEach((link) => {
      link.classList.toggle("active", link.dataset.page === name);
    });
    revealNow();
    if (name === "home" && !reduceMotion) startRouteMap();
    if (name === "emergency" && window.EmergencyMap) window.EmergencyMap.init();
  }

  function applyHash() {
    const raw = (location.hash || "#home").slice(1) || "home";
    if (PAGES.has(raw)) {
      showPage(raw);
      if (raw === "home") window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      return;
    }
    showPage("home");
    const target = document.getElementById(raw);
    if (target) target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  function revealNow() {
    const nodes = document.querySelectorAll(".page.active .reveal");
    if (reduceMotion) {
      nodes.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const delay = Number(entry.target.dataset.delay || 0);
          window.setTimeout(() => entry.target.classList.add("is-in"), delay);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.01, rootMargin: "0px 0px 12% 0px" }
    );
    nodes.forEach((el) => observer.observe(el));
    window.setTimeout(() => {
      nodes.forEach((el) => el.classList.add("is-in"));
    }, 700);
  }

  function seedParticles() {
    const host = document.getElementById("banner-particles");
    if (!host || host.childElementCount) return;
    for (let i = 0; i < 18; i += 1) {
      const speck = document.createElement("span");
      speck.style.left = `${8 + Math.random() * 84}%`;
      speck.style.top = `${10 + Math.random() * 70}%`;
      speck.style.animationDelay = `${Math.random() * 6}s`;
      speck.style.width = speck.style.height = `${3 + Math.random() * 5}px`;
      host.appendChild(speck);
    }
  }

  function onScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const progress = max > 0 ? window.scrollY / max : 0;
    const bar = document.getElementById("scroll-bar");
    if (bar) bar.style.width = `${Math.min(100, progress * 100)}%`;

    const photo = document.querySelector(".banner-photo");
    if (photo && !reduceMotion) {
      photo.style.transform = `scale(${1.08 + progress * 0.06}) translate3d(0, ${window.scrollY * 0.12}px, 0)`;
    }

    const city = document.getElementById("city-3d");
    if (city && !reduceMotion) {
      const rect = city.getBoundingClientRect();
      const mid = 1 - Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      const tilt = Math.max(0, Math.min(1, mid));
      city.style.transform = `rotateX(${12 + tilt * 10}deg) rotateY(${-28 + tilt * 22}deg) translateZ(${tilt * 24}px)`;
    }
  }

  function startRouteMap() {
    const canvas = document.getElementById("route-canvas");
    if (!canvas || mapStarted) return;
    mapStarted = true;
    const ctx = canvas.getContext("2d");
    const nodes = [
      { name: "CP Hub", x: 180, y: 210 },
      { name: "Karol Bagh", x: 280, y: 140 },
      { name: "Lajpat", x: 360, y: 320 },
      { name: "Noida 62", x: 780, y: 180 },
      { name: "Gurgaon", x: 620, y: 390 },
      { name: "Cyber City", x: 520, y: 430 },
      { name: "Dwarka", x: 120, y: 380 },
    ];
    const paths = [
      [0, 1, 3],
      [0, 2, 4, 5],
      [6, 0, 3],
    ];
    const colors = ["#ff8a1e", "#49d7ff", "#6ee7b7"];
    const vans = paths.map((path, i) => ({ path, t: i * 0.28, color: colors[i] }));

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function pointOnPath(path, t) {
      const wrapped = t % 1;
      const scaled = wrapped * (path.length - 1);
      const i = Math.floor(scaled);
      const local = scaled - i;
      const a = nodes[path[i]];
      const b = nodes[path[Math.min(i + 1, path.length - 1)]];
      const ease = local * local * (3 - 2 * local);
      return { x: lerp(a.x, b.x, ease), y: lerp(a.y, b.y, ease) };
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#071018";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(73,215,255,0.12)";
      ctx.lineWidth = 1;
      for (let x = 40; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      ctx.font = "12px Outfit, sans-serif";
      ctx.fillStyle = "rgba(169,182,204,0.85)";
      ctx.fillText("DELHI NCR  ·  live schematic", 32, 36);

      paths.forEach((path, i) => {
        ctx.beginPath();
        ctx.strokeStyle = `${colors[i]}55`;
        ctx.lineWidth = 3;
        path.forEach((idx, n) => {
          const node = nodes[idx];
          if (n === 0) ctx.moveTo(node.x, node.y);
          else ctx.lineTo(node.x, node.y);
        });
        ctx.stroke();
      });

      nodes.forEach((node) => {
        ctx.beginPath();
        ctx.fillStyle = "#0b1220";
        ctx.strokeStyle = "#ffc278";
        ctx.lineWidth = 2;
        ctx.arc(node.x, node.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#d7e3f7";
        ctx.fillText(node.name, node.x + 12, node.y - 10);
      });

      vans.forEach((van) => {
        van.t = (van.t + 0.0018) % 1;
        const p = pointOnPath(van.path, van.t);
        ctx.beginPath();
        ctx.fillStyle = van.color;
        ctx.shadowColor = van.color;
        ctx.shadowBlur = 16;
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.strokeStyle = `${van.color}88`;
        ctx.lineWidth = 2;
        ctx.moveTo(p.x, p.y);
        const trail = pointOnPath(van.path, (van.t + 0.97) % 1);
        ctx.lineTo(trail.x, trail.y);
      });

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText(new Date().toLocaleTimeString("en-IN", { hour12: true }), canvas.width - 140, 36);

      if (!reduceMotion) mapRaf = requestAnimationFrame(draw);
      else {
        ctx.fillStyle = "#49d7ff";
        vans.forEach((van) => {
          const p = pointOnPath(van.path, van.t);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    if (reduceMotion) draw(0);
    else mapRaf = requestAnimationFrame(draw);
  }

  function countUp(el) {
    if (el.dataset.counted === "true") return;
    el.dataset.counted = "true";
    const target = Number(el.dataset.count);
    const decimals = Number(el.dataset.decimals || 0);
    const suffix = el.dataset.suffix || "";
    const start = performance.now();
    const duration = 1400;
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = `${(target * eased).toFixed(decimals)}${suffix}`;
      if (p < 1) requestAnimationFrame(tick);
    }
    if (reduceMotion) el.textContent = `${target.toFixed(decimals)}${suffix}`;
    else requestAnimationFrame(tick);
  }

  function bindJumps() {
    document.querySelectorAll("[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.jump;
        const node = document.getElementById(id);
        showPage("home");
        if (node) node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      });
    });
  }

  function bindTilt(card) {
    if (card.dataset.tiltBound === "true" || reduceMotion) return;
    card.dataset.tiltBound = "true";
    card.addEventListener("mousemove", (event) => {
      const bounds = card.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      card.style.transform = `rotateY(${x * 10}deg) rotateX(${y * -8}deg) translateZ(8px)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  }

  function setup3dEffects() {
    document.querySelectorAll(".tilt-card").forEach(bindTilt);
  }

  function init() {
    seedParticles();
    bindJumps();
    applyHash();
    setup3dEffects();
    revealNow();
    onScroll();
    window.addEventListener("hashchange", applyHash);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.querySelectorAll("[data-count]").forEach((el) => {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            countUp(entry.target);
            io.unobserve(entry.target);
          }
        });
      });
      io.observe(el);
    });
  }

  window.FTMotion = { init, showPage, applyHash, setup3dEffects, revealNow };
  return window.FTMotion;
})();

document.addEventListener("DOMContentLoaded", () => {
  FTMotion.init();
});
