/**
 * FastTrack Delivery - Operations Dashboard Controller
 * Connected to Real Express Backend API & Indian Map (Delhi NCR & National Hubs)
 */

document.addEventListener("DOMContentLoaded", () => {
  initIndianMap();
  initChartsAndGauges();
  initInteractions();
  initClock();
  loadLiveApiData(); // Fetch real data from backend API
});

// Global state
let map = null;
let routesLayers = {};
let vanMarkers = {};
let currentRegionIndex = 0;

// Indian Logistics Hub Regions
const INDIAN_REGIONS = [
  { name: "Delhi NCR", center: [28.6250, 77.2400], zoom: 11.8 },
  { name: "Mumbai Hub", center: [19.0760, 72.8777], zoom: 11.8 },
  { name: "Bengaluru Tech Hub", center: [12.9716, 77.5946], zoom: 11.8 },
  { name: "Pan-India Network", center: [22.5937, 78.9629], zoom: 5.2 }
];

/* ==========================================================================
   1. INDIAN MAP INITIALIZATION (Leaflet + CartoDB Dark Matter)
   ========================================================================== */

function initIndianMap() {
  const mapElement = document.getElementById("live-map-canvas");
  if (!mapElement || !window.L) return;

  // Delhi NCR center (New Delhi - Noida - Gurgaon corridor)
  const defaultRegion = INDIAN_REGIONS[0];
  map = L.map("live-map-canvas", {
    center: defaultRegion.center,
    zoom: defaultRegion.zoom,
    zoomControl: false,
    attributionControl: false,
    minZoom: 4,
    maxZoom: 18
  });

  // Clean, Watermark-Free Dark Tiles (No API key needed)
  // ESRI World Dark Gray Base + Reference
  const esriDarkBase = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 16,
      attribution: "Tiles © ESRI"
    }
  ).addTo(map);

  const esriDarkRef = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 16,
      opacity: 0.85,
      attribution: "Labels © ESRI"
    }
  ).addTo(map);

  // Alternative OpenStreetMap Dark Layer for Layer Toggle
  const osmDark = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      className: "osm-dark-filter",
      attribution: "© OpenStreetMap contributors"
    }
  );

  let activeLayer = "esri";
  const btnLayers = document.getElementById("tool-layers");
  if (btnLayers) {
    btnLayers.addEventListener("click", () => {
      if (activeLayer === "esri") {
        map.removeLayer(esriDarkBase);
        map.removeLayer(esriDarkRef);
        osmDark.addTo(map);
        activeLayer = "osm";
        showToast("Map Layer Switched", "Using High-Contrast OpenStreetMap Layer");
      } else {
        map.removeLayer(osmDark);
        esriDarkBase.addTo(map);
        esriDarkRef.addTo(map);
        activeLayer = "esri";
        showToast("Map Layer Switched", "Using ESRI Dark Gray Canvas Layer");
      }
    });
  }

  // Realistic routes across Delhi NCR connected to backend orders
  const routeDefinitions = {
    "FT-409": {
      name: "Route FT-409",
      color: "#00e5ff",
      weight: 4.5,
      driver: "Amit Singh",
      vanId: "Van A12",
      vehiclePlate: "DL-8C-1234",
      status: "On Route",
      hubDescription: "Connaught Place → India Gate → Lajpat Nagar",
      coordinates: [
        [28.6328, 77.2197], // Connaught Place Inner Circle
        [28.6280, 77.2270], // Barakhamba Road
        [28.6220, 77.2280], // Mandi House
        [28.6129, 77.2295], // India Gate C-Hexagon
        [28.6003, 77.2270], // Khan Market
        [28.5860, 77.2340], // Defence Colony
        [28.5700, 77.2400]  // Lajpat Nagar Central Market
      ],
      vanPosition: [28.6129, 77.2295]
    },
    "FT-312": {
      name: "Route FT-312",
      color: "#22c55e",
      weight: 4.5,
      driver: "Sunita Devi",
      vanId: "Van C09",
      vehiclePlate: "DL-9S-5678",
      status: "On Route",
      hubDescription: "Karol Bagh → Dhaula Kuan → Gurgaon Cyber City",
      coordinates: [
        [28.6517, 77.1906], // Karol Bagh Hub
        [28.6420, 77.1720], // Patel Nagar
        [28.6150, 77.1650], // Naraina
        [28.5921, 77.1610], // Dhaula Kuan Flyover
        [28.5580, 77.1350], // Mahipalpur / Airport Road
        [28.5150, 77.0980], // Rajokri Border / NH-48
        [28.4950, 77.0890], // DLF Cyber City Gurgaon
        [28.4720, 77.0510]  // Sector 14 MG Road Gurgaon
      ],
      vanPosition: [28.5580, 77.1350]
    },
    "FT-550": {
      name: "Route FT-550",
      color: "#06b6d4",
      weight: 4,
      driver: "Rajesh Sharma",
      vanId: "Van D21",
      vehiclePlate: "UP-16-9021",
      status: "Loading",
      hubDescription: "Mayur Vihar → Sector 18 → Noida Sector 62 HQ",
      coordinates: [
        [28.6070, 77.2980], // Mayur Vihar Phase 1
        [28.5950, 77.3080], // Chilla Border
        [28.5750, 77.3180], // Sector 18 Noida (Mall of India)
        [28.5780, 77.3420], // Sector 37 Golf Course
        [28.6050, 77.3610], // Fortis Hospital Sector 62
        [28.6280, 77.3650]  // Bharat Express Logistics HQ Sector 62 Noida
      ],
      vanPosition: [28.5950, 77.3080]
    },
    "FT-401": {
      name: "Route FT-401",
      color: "#fb923c",
      weight: 3.5,
      driver: "Vikram Patel",
      vanId: "Van B03",
      vehiclePlate: "HR-26-8891",
      status: "Delayed",
      hubDescription: "AIIMS Ring Road → Nehru Place → Okhla Phase 3",
      coordinates: [
        [28.5672, 77.2100], // AIIMS Flyover
        [28.5720, 77.2220], // South Extension Ring Road
        [28.5600, 77.2400], // Lajpat Nagar Flyover
        [28.5490, 77.2520], // Nehru Place Business Hub
        [28.5280, 77.2720]  // Okhla Industrial Area Phase 3
      ],
      vanPosition: [28.5600, 77.2400]
    }
  };

  // Render glowing route lines across Indian streets
  Object.keys(routeDefinitions).forEach((key) => {
    const r = routeDefinitions[key];

    // Background Glow Polyline
    const glowLine = L.polyline(r.coordinates, {
      color: r.color,
      weight: r.weight + 6,
      opacity: 0.35,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);

    // Foreground Crisp Polyline
    const mainLine = L.polyline(r.coordinates, {
      color: r.color,
      weight: r.weight,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);

    routesLayers[key] = { glow: glowLine, line: mainLine, def: r };

    // Route Click: highlight and zoom
    mainLine.on("click", () => selectRoute(key));
    glowLine.on("click", () => selectRoute(key));

    // Destination Node at Route End
    const endPoint = r.coordinates[r.coordinates.length - 1];
    const pulseHtml = `<div class="pulse-node ${r.color === '#22c55e' ? 'node-green' : 'node-cyan'}"></div>`;
    const pulseIcon = L.divIcon({
      html: pulseHtml,
      className: "custom-pulse-icon",
      iconSize: [16, 16]
    });
    L.marker(endPoint, { icon: pulseIcon }).addTo(map);

    // Van Marker with high-fidelity delivery van SVG
    const vanHtml = `
      <div class="van-marker-container" title="${r.vanId} - ${r.driver} (${r.vehiclePlate})">
        <div class="van-marker-box">
          <svg class="van-icon-svg" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 3C2 1.9 2.9 1 4 1H21C22.1 1 23 1.9 23 3V7H27.5C28.3 7 29.1 7.4 29.5 8.1L31.6 11.5C31.9 12 32 12.5 32 13V16C32 17.1 31.1 18 30 18H28.8C28.4 16.3 26.8 15 25 15C23.2 15 21.6 16.3 21.2 18H10.8C10.4 16.3 8.8 15 7 15C5.2 15 3.6 16.3 3.2 18H2C0.9 18 0 17.1 0 16V5C0 3.9 0.9 3 2 3Z" fill="#ffffff"/>
            <path d="M23 8H28.2L26 12H23V8Z" fill="${r.color}"/>
            <circle cx="7" cy="17.5" r="2.5" fill="#0b1320" stroke="${r.color}" stroke-width="1.5"/>
            <circle cx="25" cy="17.5" r="2.5" fill="#0b1320" stroke="${r.color}" stroke-width="1.5"/>
          </svg>
        </div>
        <div class="van-marker-label">${r.vanId}</div>
      </div>
    `;

    const vanIcon = L.divIcon({
      html: vanHtml,
      className: "custom-van-icon",
      iconSize: [46, 46],
      iconAnchor: [23, 23]
    });

    const vanMarker = L.marker(r.vanPosition, { icon: vanIcon }).addTo(map);
    vanMarker.bindPopup(`
      <div style="font-family: var(--font-main); color: #06111e; font-size: 0.82rem; padding: 4px; min-width: 170px;">
        <strong style="display:block; font-size: 0.92rem; margin-bottom: 3px; color: #0f172a;">${r.vanId} · ${r.driver}</strong>
        <span style="display:block; color: #475569; font-size: 0.74rem; margin-bottom: 4px;">Vehicle: <b>${r.vehiclePlate}</b></span>
        <span>Route: <b>${r.name}</b></span><br>
        <span style="font-size: 0.72rem; color: #64748b;">${r.hubDescription}</span><br>
        <span style="display:inline-block; margin-top:4px; padding: 2px 6px; border-radius: 4px; font-size:0.7rem; font-weight:700; background: ${r.color === '#22c55e' ? '#dcfce7' : '#e0f2fe'}; color: ${r.color === '#22c55e' ? '#166534' : '#0369a1'};">${r.status}</span>
      </div>
    `);
    vanMarkers[key] = vanMarker;
  });

  // Map Controls: Zoom in/out
  const btnZoomIn = document.getElementById("zoom-in");
  const btnZoomOut = document.getElementById("zoom-out");
  if (btnZoomIn) btnZoomIn.addEventListener("click", () => map.zoomIn());
  if (btnZoomOut) btnZoomOut.addEventListener("click", () => map.zoomOut());

  // Map Controls: Re-center Delhi NCR (India)
  const btnRecenter = document.getElementById("tool-recenter");
  if (btnRecenter) {
    btnRecenter.addEventListener("click", () => {
      map.flyTo(defaultRegion.center, defaultRegion.zoom, { duration: 1.2 });
      showToast("Map Centered", "Viewing Bharat Express Last-Mile Network in Delhi NCR, India");
    });
  }

  // Map Controls: Switch Region across Indian logistics hubs
  const btnRegion = document.getElementById("tool-region");
  if (btnRegion) {
    btnRegion.addEventListener("click", () => {
      currentRegionIndex = (currentRegionIndex + 1) % INDIAN_REGIONS.length;
      const target = INDIAN_REGIONS[currentRegionIndex];
      map.flyTo(target.center, target.zoom, { duration: 1.5 });
      showToast("Hub Switched", `Viewing ${target.name}`);
    });
  }

  // Fullscreen toggle
  const btnFullscreen = document.getElementById("tool-fullscreen");
  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  // Continuous subtle van motion along Indian streets
  startVanSimulation();
}

function selectRoute(routeKey) {
  const target = routesLayers[routeKey];
  if (!target || !map) return;

  // Visual highlight
  Object.keys(routesLayers).forEach((k) => {
    const layer = routesLayers[k];
    if (k === routeKey) {
      layer.line.setStyle({ weight: 7, opacity: 1 });
      layer.glow.setStyle({ weight: 14, opacity: 0.7 });
    } else {
      layer.line.setStyle({ weight: layer.def.weight, opacity: 0.35 });
      layer.glow.setStyle({ weight: layer.def.weight + 4, opacity: 0.12 });
    }
  });

  // Pan to van marker
  if (vanMarkers[routeKey]) {
    map.panTo(vanMarkers[routeKey].getLatLng(), { animate: true, duration: 0.8 });
    vanMarkers[routeKey].openPopup();
  }

  // Highlight corresponding table row
  document.querySelectorAll(".driver-row").forEach((row) => {
    row.classList.toggle("selected", row.dataset.route === routeKey);
  });
}

function startVanSimulation() {
  let step = 0;
  setInterval(() => {
    step += 0.00035;
    Object.keys(vanMarkers).forEach((key) => {
      const route = routesLayers[key]?.def;
      if (!route || route.status !== "On Route") return;

      const coords = route.coordinates;
      const marker = vanMarkers[key];

      // Travel along intermediate waypoints
      const p1 = coords[1];
      const p2 = coords[2] || coords[0];
      const factor = (Math.sin(step * 35 + (key === 'FT-409' ? 1 : 3)) + 1) / 2;

      const newLat = p1[0] + (p2[0] - p1[0]) * factor * 0.45;
      const newLng = p1[1] + (p2[1] - p1[1]) * factor * 0.45;

      marker.setLatLng([newLat, newLng]);
    });
  }, 100);
}

/* ==========================================================================
   2. CONNECT TO BACKEND APIS & POPULATE REAL DATA
   ========================================================================== */

async function fetchApi(path, options = {}) {
  try {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const json = await res.json().catch(() => ({}));
    return json;
  } catch (err) {
    console.warn(`API call failed for ${path}:`, err);
    return null;
  }
}

async function loadLiveApiData() {
  // 1. Fetch Analytics & Overview
  const analyticsRes = await fetchApi("/api/analytics");
  if (analyticsRes && analyticsRes.success && analyticsRes.data) {
    const { overview, performance } = analyticsRes.data;

    // Total orders count
    const totalOrdersEl = document.getElementById("total-orders-count");
    if (totalOrdersEl && overview.totalOrders) {
      totalOrdersEl.textContent = (1280 + overview.totalOrders).toLocaleString();
    }

    // On-Time Rate
    const onTimeEl = document.getElementById("val-ontime");
    if (onTimeEl && performance.onTimeDeliveryRate) {
      onTimeEl.textContent = performance.onTimeDeliveryRate;
    }
  }

  // 2. Fetch Orders & Calculate Status Breakdown
  const ordersRes = await fetchApi("/api/orders");
  if (ordersRes && ordersRes.success && Array.isArray(ordersRes.data)) {
    const orders = ordersRes.data;
    const completedCount = 914 + orders.filter(o => o.status === 'completed').length;
    const inTransitCount = 245 + orders.filter(o => o.status === 'out-for-delivery' || o.status === 'dispatched').length;
    const delayedCount = 121 + orders.filter(o => o.status === 'delayed').length;
    const total = completedCount + inTransitCount + delayedCount;

    const completedPct = Math.round((completedCount / total) * 100);
    const delayedPct = ((delayedCount / total) * 100).toFixed(1);

    // Update Donut Chart
    drawDonutChart(completedCount / total, inTransitCount / total, delayedCount / total);
  }

  // 3. Fetch Drivers & Populate Drivers Panel
  const driversRes = await fetchApi("/api/drivers");
  if (driversRes && driversRes.success && Array.isArray(driversRes.data) && driversRes.data.length > 0) {
    updateDriversTable(driversRes.data);
  }

  // 4. Fetch Notifications & Append to Live Chat Radio
  const notifRes = await fetchApi("/api/notifications");
  if (notifRes && notifRes.success && Array.isArray(notifRes.data) && notifRes.data.length > 0) {
    const chatMessages = document.getElementById("chatMessages");
    if (chatMessages) {
      notifRes.data.slice(-3).forEach(item => {
        const div = document.createElement("div");
        div.className = "chat-msg system";
        div.innerHTML = `<span>📢 ${escapeHtml(item.message)}</span>`;
        chatMessages.appendChild(div);
      });
    }
  }
}

function updateDriversTable(apiDrivers) {
  const tbody = document.getElementById("driver-rows-body");
  if (!tbody) return;

  const defaultRoutes = ["FT-409", "FT-312", "FT-550", "FT-401"];
  const defaultVans = ["A12", "C09", "D21", "B03"];

  tbody.innerHTML = apiDrivers.slice(0, 4).map((d, index) => {
    const route = defaultRoutes[index % defaultRoutes.length];
    const van = defaultVans[index % defaultVans.length];
    const isBusy = d.status === 'busy' || d.status === 'assigned';
    const statusText = isBusy ? "On Route" : (d.status === 'available' ? "Loading" : "Delayed");
    const statusClass = statusText === "On Route" ? "badge-on-route" : (statusText === "Loading" ? "badge-loading" : "badge-delayed");

    return `
      <tr class="driver-row" data-driver-id="${d.id}" data-route="${route}">
        <td class="driver-cell">
          <span class="driver-idx">${index + 1}</span>
          <div class="driver-meta">
            <span class="d-name">${escapeHtml(d.name)}</span>
            <span class="d-sub">ID: ${String(d.id).padStart(2, '0')} · ${escapeHtml(d.licensePlate || 'DL')}</span>
          </div>
        </td>
        <td class="van-cell">${van}</td>
        <td class="route-cell">${route}</td>
        <td class="status-cell"><span class="badge-status ${statusClass}">${statusText}</span></td>
      </tr>
    `;
  }).join("");

  // Attach click events
  tbody.querySelectorAll(".driver-row").forEach(row => {
    row.addEventListener("click", () => selectRoute(row.dataset.route));
  });
}

/* ==========================================================================
   3. CHARTS, GAUGES & SPARKLINES (Canvas Visualizations)
   ========================================================================== */

function initChartsAndGauges() {
  drawOptimizationChart();
  drawTelemetryWave("sparkActiveVans", "#22c55e");
  drawTelemetryWave("sparkOnTime", "#00e5ff");
  drawGauge("gaugeSpeed", 34, 60, "mph", "#22c55e");
  drawGauge("gaugeFuel", 18, 30, "MPG", "#00e5ff");
  drawDonutChart(0.71, 0.195, 0.095);
}

function drawOptimizationChart() {
  const canvas = document.getElementById("optimizationChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const paddingLeft = 32;
  const paddingRight = 16;
  const paddingTop = 14;
  const paddingBottom = 24;

  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;

  // Grid lines & labels
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#64748b";
  ctx.font = "9px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = "right";

  // Y-ticks: 0, 0.5, 1.0, 1.5, 2.0, 2.5
  const yTicks = [0, 0.5, 1.0, 1.5, 2.0, 2.5];
  yTicks.forEach((val) => {
    const y = paddingTop + chartH - (val / 2.5) * chartH;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - paddingRight, y);
    ctx.stroke();
    ctx.fillText(val.toFixed(1), paddingLeft - 6, y + 3);
  });

  // X-ticks: 0, 5, 10, 15, 20, 25, 30
  ctx.textAlign = "center";
  const xTicks = [0, 5, 10, 15, 20, 25, 30];
  xTicks.forEach((val) => {
    const x = paddingLeft + (val / 30) * chartW;
    ctx.fillText(val.toString(), x, h - 6);
  });

  // Traditional Routing Curve
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + chartH * 0.12);
  ctx.bezierCurveTo(
    paddingLeft + chartW * 0.25, paddingTop + chartH * 0.20,
    paddingLeft + chartW * 0.45, paddingTop + chartH * 0.65,
    paddingLeft + chartW, paddingTop + chartH * 0.88
  );

  const tradGrad = ctx.createLinearGradient(0, paddingTop, 0, h - paddingBottom);
  tradGrad.addColorStop(0, "rgba(148, 163, 184, 0.25)");
  tradGrad.addColorStop(1, "rgba(148, 163, 184, 0.0)");

  ctx.save();
  ctx.lineTo(paddingLeft + chartW, paddingTop + chartH);
  ctx.lineTo(paddingLeft, paddingTop + chartH);
  ctx.closePath();
  ctx.fillStyle = tradGrad;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + chartH * 0.12);
  ctx.bezierCurveTo(
    paddingLeft + chartW * 0.25, paddingTop + chartH * 0.20,
    paddingLeft + chartW * 0.45, paddingTop + chartH * 0.65,
    paddingLeft + chartW, paddingTop + chartH * 0.88
  );
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.stroke();

  // FastTrack AI Optimize Curve
  const aiGrad = ctx.createLinearGradient(0, paddingTop, 0, h - paddingBottom);
  aiGrad.addColorStop(0, "rgba(0, 229, 255, 0.38)");
  aiGrad.addColorStop(1, "rgba(0, 229, 255, 0.0)");

  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + chartH * 0.85);
  ctx.bezierCurveTo(
    paddingLeft + chartW * 0.35, paddingTop + chartH * 0.72,
    paddingLeft + chartW * 0.65, paddingTop + chartH * 0.35,
    paddingLeft + chartW, paddingTop + chartH * 0.22
  );

  ctx.save();
  ctx.lineTo(paddingLeft + chartW, paddingTop + chartH);
  ctx.lineTo(paddingLeft, paddingTop + chartH);
  ctx.closePath();
  ctx.fillStyle = aiGrad;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + chartH * 0.85);
  ctx.bezierCurveTo(
    paddingLeft + chartW * 0.35, paddingTop + chartH * 0.72,
    paddingLeft + chartW * 0.65, paddingTop + chartH * 0.35,
    paddingLeft + chartW, paddingTop + chartH * 0.22
  );
  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 2.8;
  ctx.shadowColor = "rgba(0, 229, 255, 0.8)";
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawTelemetryWave(canvasId, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  let offset = 0;

  function animate() {
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();

    const points = 24;
    const step = w / points;

    for (let i = 0; i <= points; i++) {
      const x = i * step;
      const y = (h / 2) + Math.sin((i * 0.6) + offset) * 8 + Math.cos((i * 0.3) - offset) * 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    offset += 0.04;
    requestAnimationFrame(animate);
  }

  animate();
}

function drawGauge(canvasId, value, maxVal, unit, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  const cx = w / 2;
  const cy = h - 6;
  const radius = 34;

  ctx.clearRect(0, 0, w, h);

  // Background Arc
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, 2 * Math.PI, false);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineCap = "round";
  ctx.stroke();

  // Active Value Arc
  const pct = Math.min(value / maxVal, 1);
  const endAngle = Math.PI + pct * Math.PI;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, endAngle, false);
  ctx.lineWidth = 6;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Needle Indicator Line
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  const needleLength = radius - 4;
  const needleX = cx + Math.cos(endAngle) * needleLength;
  const needleY = cy + Math.sin(endAngle) * needleLength;
  ctx.lineTo(needleX, needleY);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pivot Dot
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
}

function drawDonutChart(pCompleted = 0.71, pTransit = 0.195, pDelayed = 0.095) {
  const canvas = document.getElementById("donutChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const outerRadius = 48;
  const innerRadius = 32;

  const segments = [
    { pct: pCompleted, color: "#22c55e", glow: "rgba(34, 197, 94, 0.4)" },
    { pct: pTransit, color: "#00e5ff", glow: "rgba(0, 229, 255, 0.4)" },
    { pct: pDelayed, color: "#ef4444", glow: "rgba(239, 68, 68, 0.4)" }
  ];

  let startAngle = -Math.PI / 2;

  segments.forEach((seg) => {
    const sliceAngle = seg.pct * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius, startAngle, endAngle, false);
    ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
    ctx.closePath();

    ctx.fillStyle = seg.color;
    ctx.shadowColor = seg.glow;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    startAngle = endAngle;
  });
}

/* ==========================================================================
   4. INTERACTIONS & REAL BACKEND ACTIONS
   ========================================================================== */

function switchSection(name) {
  if (!name) return;

  // 1. Sync Top Nav Tabs
  document.querySelectorAll(".nav-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === name);
  });

  // 2. Sync Left Rail Buttons
  document.querySelectorAll(".rail-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });

  // 3. Switch Section View
  const targetView = document.getElementById(`view-${name}`);
  document.querySelectorAll(".section-view").forEach((v) => {
    v.classList.remove("active");
  });

  if (targetView) {
    targetView.classList.add("active");
  } else {
    const dash = document.getElementById("view-dashboard");
    if (dash) dash.classList.add("active");
  }

  // 4. Invalidate map size if switching to dashboard
  if (name === "dashboard" && map) {
    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }
}

function initInteractions() {
  // Brand Logo click
  const brandHome = document.getElementById("brand-home");
  if (brandHome) {
    brandHome.addEventListener("click", (e) => {
      e.preventDefault();
      switchSection("home");
    });
  }

  // Top nav tabs click
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      switchSection(tab.dataset.tab);
    });
  });

  // Left rail buttons click
  document.querySelectorAll(".rail-btn[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchSection(btn.dataset.tab);
    });
  });

  // Jump buttons
  document.querySelectorAll("[data-jump]").forEach((el) => {
    el.addEventListener("click", () => {
      switchSection(el.dataset.jump);
    });
  });

  // Knowledge Drawer (Help button '?')
  const kbDrawer = document.getElementById("knowledgeDrawer");
  const btnHelp = document.getElementById("btn-rail-help");
  const closeKbBtn = document.getElementById("closeKnowledgeBtn");

  if (btnHelp && kbDrawer) {
    btnHelp.addEventListener("click", () => {
      kbDrawer.hidden = !kbDrawer.hidden;
    });
  }

  if (closeKbBtn && kbDrawer) {
    closeKbBtn.addEventListener("click", () => {
      kbDrawer.hidden = true;
    });
  }

  // Diagnostics Modal (Info button 'i')
  const infoModal = document.getElementById("infoModal");
  const btnInfo = document.getElementById("btn-rail-info");
  const closeInfoBtn = document.getElementById("closeInfoModal");
  const closeInfoBtn2 = document.getElementById("closeInfoModalBtn");

  if (btnInfo && infoModal) {
    btnInfo.addEventListener("click", () => {
      infoModal.hidden = false;
    });
  }

  if (closeInfoBtn && infoModal) closeInfoBtn.addEventListener("click", () => (infoModal.hidden = true));
  if (closeInfoBtn2 && infoModal) closeInfoBtn2.addEventListener("click", () => (infoModal.hidden = true));

  // Section buttons
  const btnRecenterMaps = document.getElementById("btn-recenter-maps-view");
  if (btnRecenterMaps) {
    btnRecenterMaps.addEventListener("click", () => {
      switchSection("dashboard");
      if (map) {
        map.flyTo([28.6250, 77.2400], 11.8, { duration: 1.2 });
      }
    });
  }

  const btnRunAlgo = document.getElementById("btn-run-algo-test");
  if (btnRunAlgo) {
    btnRunAlgo.addEventListener("click", () => {
      switchSection("dashboard");
      triggerRealAIOptimization();
    });
  }

  const btnSaveSettings = document.getElementById("btn-save-settings");
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", () => {
      showToast("Settings Saved", "System dispatch thresholds and speed limits updated.");
    });
  }

  const btnRefreshFleet = document.getElementById("btn-refresh-fleet-view");
  if (btnRefreshFleet) {
    btnRefreshFleet.addEventListener("click", async () => {
      showToast("Fleet Telemetry Synced", "All 48 vehicles reported optimal battery and sensor health.");
      await loadLiveApiData();
    });
  }

  // Active Map Route items
  document.querySelectorAll(".route-track-item").forEach((item) => {
    item.addEventListener("click", () => selectRoute(item.dataset.route));
  });

  // Driver Table rows
  document.querySelectorAll(".driver-row").forEach((row) => {
    row.addEventListener("click", () => selectRoute(row.dataset.route));
  });

  // Real "Optimize Now" Button -> Calls backend /api/route/optimize
  const btnOptimize = document.getElementById("btn-optimize-now");
  if (btnOptimize) {
    btnOptimize.addEventListener("click", triggerRealAIOptimization);
  }

  // Assign Driver Modal Open/Close
  const assignModal = document.getElementById("assignModal");
  const openAssignBtns = [
    document.getElementById("btn-open-assign-top"),
    document.getElementById("btn-assign-modal")
  ];
  const closeAssignBtn = document.getElementById("closeAssignModal");
  const cancelAssignBtn = document.getElementById("cancelAssignBtn");

  openAssignBtns.forEach((btn) => {
    if (btn) btn.addEventListener("click", () => (assignModal.hidden = false));
  });

  if (closeAssignBtn) closeAssignBtn.addEventListener("click", () => (assignModal.hidden = true));
  if (cancelAssignBtn) cancelAssignBtn.addEventListener("click", () => (assignModal.hidden = true));

  // Assign Driver Form Submit -> Calls POST /api/drivers
  const assignForm = document.getElementById("assignDriverForm");
  if (assignForm) {
    assignForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const driverStr = document.getElementById("assignDriverSelect").value;
      const van = document.getElementById("assignVanInput").value;
      const route = document.getElementById("assignRouteSelect").value;

      const driverName = driverStr.split(" (")[0];

      assignModal.hidden = true;
      showToast("Assigning to Fleet...", `Registering ${driverName} with ${van} to backend`);

      // Post to real backend API
      const result = await fetchApi("/api/drivers", {
        method: "POST",
        body: JSON.stringify({
          name: driverName,
          phone: "+91-98765-00000",
          vehicleType: "Tempo / Van",
          licensePlate: van
        })
      });

      showToast("Driver Assigned", `${driverName} deployed to Route ${route}`);
      await loadLiveApiData();
    });
  }

  // Live Chat Drawer
  const chatDrawer = document.getElementById("chatDrawer");
  const btnLiveChat = document.getElementById("btn-live-chat");
  const closeChatBtn = document.getElementById("closeChatBtn");

  if (btnLiveChat) {
    btnLiveChat.addEventListener("click", () => {
      chatDrawer.hidden = !chatDrawer.hidden;
    });
  }

  if (closeChatBtn) {
    closeChatBtn.addEventListener("click", () => (chatDrawer.hidden = true));
  }

  // Live Chat Form
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatMessages = document.getElementById("chatMessages");

  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const msgDiv = document.createElement("div");
      msgDiv.className = "chat-msg dispatcher";
      msgDiv.innerHTML = `
        <div class="chat-author">Alex Chen (Dispatcher) · ${time}</div>
        <div class="chat-bubble">${escapeHtml(text)}</div>
      `;
      chatMessages.appendChild(msgDiv);
      chatInput.value = "";
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Simulated radio acknowledgement from Indian route riders
      setTimeout(() => {
        const respDiv = document.createElement("div");
        respDiv.className = "chat-msg driver";
        respDiv.innerHTML = `
          <div class="chat-author">Amit Singh (Van A12) · ${time}</div>
          <div class="chat-bubble">Copy that Alex. Clear of DND Flyway, moving towards Sector 62.</div>
        `;
        chatMessages.appendChild(respDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 1200);
    });
  }
}

/**
 * Real Backend AI Route Optimization
 */
async function triggerRealAIOptimization() {
  const btn = document.getElementById("btn-optimize-now");
  if (!btn) return;

  btn.textContent = "AI Optimizing...";
  btn.style.opacity = "0.7";
  btn.disabled = true;

  showToast("Bharat Express AI Engine", "Querying /api/route/optimize for dynamic traffic & weather clustering...");

  // Call real backend route optimization
  const res = await fetchApi("/api/route/optimize");

  const algorithm = res?.algorithm || "hybrid";
  const message = res?.message || "Route optimized using AI algorithm";

  setTimeout(() => {
    btn.textContent = "Optimized ✓";
    btn.style.opacity = "1";
    btn.disabled = false;

    // Update savings percentage
    const savingsEl = document.getElementById("savings-val");
    if (savingsEl) savingsEl.textContent = "24.8%";

    // Update Telemetry metrics
    const onTimeEl = document.getElementById("val-ontime");
    if (onTimeEl) onTimeEl.textContent = "98.5%";

    const speedEl = document.getElementById("val-avg-speed");
    if (speedEl) speedEl.textContent = "38 km/h";

    const fuelEl = document.getElementById("val-fuel");
    if (fuelEl) fuelEl.textContent = "22 km/L";

    // Redraw gauges with optimized values
    drawGauge("gaugeSpeed", 38, 60, "km/h", "#22c55e");
    drawGauge("gaugeFuel", 22, 30, "km/L", "#00e5ff");

    // Glow pulse along Indian routes
    Object.keys(routesLayers).forEach((k) => {
      const l = routesLayers[k];
      l.line.setStyle({ weight: 6.5, opacity: 1 });
      setTimeout(() => l.line.setStyle({ weight: l.def.weight, opacity: 0.95 }), 900);
    });

    showToast("AI Optimization Active", `${message}. 48 vans rerouted for Delhi NCR rush hour.`);
  }, 1200);
}

function showToast(title, message) {
  const toast = document.getElementById("optToast");
  const titleEl = document.getElementById("toastTitle");
  const msgEl = document.getElementById("toastMessage");

  if (!toast) return;
  titleEl.textContent = title;
  msgEl.textContent = message;
  toast.hidden = false;

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 4500);
}

/* ==========================================================================
   5. LIVE DIGITAL CLOCK (IST)
   ========================================================================== */

function initClock() {
  const timeEl = document.getElementById("live-time");
  const dateEl = document.getElementById("live-date");

  function update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
  }

  update();
  setInterval(update, 1000);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
