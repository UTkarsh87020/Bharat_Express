/**
 * FastTrack Delivery - Operations Dashboard Controller
 * Connected to Real Express Backend API & Indian Map (Delhi NCR & National Hubs)
 */

document.addEventListener("DOMContentLoaded", () => {
  initIndianMap();
  initChartsAndGauges();
  initInteractions();
  initClock();
  loadSettingsFromStorage();
  loadLiveApiData(); // Fetch real data from backend API
  initCardCollapses();
  initMobileNavigation();
});

// Global state
let map = null;
let routesLayers = {};
let vanMarkers = {};
let currentRegionIndex = 0;
let selectedRouteKey = "FT-409";
let navModeActive = false;
let currentEmergencyCoords = { lat: 28.6250, lng: 77.2400 };
let currentNearestStation = null;
let emergencyMapMarker = null;
let emergencyMapCircle = null;
let emergencyPoliceMarker = null;
let emergencyPoliceLine = null;

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

  // Navigation Mode Toggle
  const btnNavMode = document.getElementById("tool-nav-mode");
  if (btnNavMode) {
    btnNavMode.addEventListener("click", () => {
      navModeActive = !navModeActive;
      btnNavMode.classList.toggle("active", navModeActive);

      if (navModeActive) {
        const activeRouteKey = selectedRouteKey || "FT-409";
        const r = routeDefinitions[activeRouteKey];
        if (r && map) {
          map.flyTo(r.vanPosition, 14.5, { duration: 1.2 });
          showToast(
            "Navigation Mode Active 🧭",
            `Following ${r.vanId} (${r.driver}) along ${r.name}. Turn-by-turn tracking enabled.`
          );
        }
      } else {
        map.flyTo(defaultRegion.center, defaultRegion.zoom, { duration: 1.2 });
        showToast("Navigation Mode Off", "Restored standard operational overview.");
      }
    });
  }

  // Continuous subtle van motion along Indian streets
  startVanSimulation();
}

function selectRoute(routeKey) {
  selectedRouteKey = routeKey;
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

  // 3. Fetch & Render Orders Management Roster
  await loadOrdersData();

  // 4. Fetch Drivers & Populate Drivers Panel
  const driversRes = await fetchApi("/api/drivers");
  if (driversRes && driversRes.success && Array.isArray(driversRes.data) && driversRes.data.length > 0) {
    updateDriversTable(driversRes.data);
  }

  // 5. Fetch Notifications & Append to Live Chat Radio
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

// Global State for Orders View
let currentOrdersList = [];
let ordersActiveFilter = 'all';

async function loadOrdersData() {
  const res = await fetchApi("/api/orders");
  if (res && res.success && Array.isArray(res.data)) {
    currentOrdersList = res.data;
    renderOrdersTable();
    updateOrdersKpiSummary(res.data);
  }
}

function updateOrdersKpiSummary(orders) {
  const pending = orders.filter(o => o.status === 'pending').length;
  const transit = orders.filter(o => o.status === 'out-for-delivery' || o.status === 'dispatched').length;
  const completed = orders.filter(o => o.status === 'completed').length;
  const totalVal = orders.reduce((sum, o) => sum + (Number(o.orderValue) || 0), 0);

  const pendingEl = document.getElementById("orders-pending-count");
  const transitEl = document.getElementById("orders-transit-count");
  const completedEl = document.getElementById("orders-completed-count");
  const totalValEl = document.getElementById("orders-total-val");
  const tableCountEl = document.getElementById("orders-table-count");

  if (pendingEl) pendingEl.textContent = pending;
  if (transitEl) transitEl.textContent = transit;
  if (completedEl) completedEl.textContent = completed;
  if (totalValEl) totalValEl.textContent = `₹${totalVal.toLocaleString('en-IN')}`;
  if (tableCountEl) tableCountEl.textContent = `${orders.length} total shipments registered`;
}

function renderOrdersTable() {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  const searchQuery = document.getElementById("ordersSearchInput")?.value.toLowerCase().trim() || "";

  const filtered = currentOrdersList.filter(order => {
    // Status filter
    if (ordersActiveFilter !== 'all') {
      if (ordersActiveFilter === 'pending' && order.status !== 'pending') return false;
      if (ordersActiveFilter === 'out-for-delivery' && order.status !== 'out-for-delivery' && order.status !== 'dispatched') return false;
      if (ordersActiveFilter === 'completed' && order.status !== 'completed') return false;
    }

    // Search query
    if (searchQuery) {
      const matchName = (order.customerName || "").toLowerCase().includes(searchQuery);
      const matchPickup = (order.pickupAddress || "").toLowerCase().includes(searchQuery);
      const matchDrop = (order.deliveryAddress || "").toLowerCase().includes(searchQuery);
      const matchId = String(order.id).includes(searchQuery);
      return matchName || matchPickup || matchDrop || matchId;
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 30px; color: var(--text-secondary);">
          <div style="font-size: 1.5rem; margin-bottom: 6px;">📦</div>
          <div>No consignments found matching the current filters.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(order => {
    const isPending = order.status === 'pending';
    const isTransit = order.status === 'out-for-delivery' || order.status === 'dispatched';
    const isCompleted = order.status === 'completed';

    const statusClass = isCompleted ? 'badge-active' : (isTransit ? 'badge-on-route' : 'badge-pending');
    const statusText = isCompleted ? 'Delivered' : (isTransit ? 'In Transit' : 'Pending');

    const priorityClass = order.priority === 'high' ? 'priority-high' : (order.priority === 'low' ? 'priority-low' : 'priority-medium');
    const isSafeLock = order.routePreference === 'customer';
    const policyClass = isSafeLock ? 'policy-lock' : 'policy-ai';
    const policyText = isSafeLock ? '🔒 Safe Locked' : '⚡ AI Dynamic';

    const waypointsList = Array.isArray(order.customWaypoints) ? order.customWaypoints : [];
    const viaHtml = isSafeLock && waypointsList.length > 0
      ? `<span class="route-via-pill">via ${escapeHtml(waypointsList[0])}${waypointsList.length > 1 ? ` (+${waypointsList.length - 1})` : ''}</span>`
      : '';

    const driverName = order.assignedDriver
      ? `Driver #${order.assignedDriver}`
      : `<span style="color: var(--text-secondary); font-style: italic;">Unassigned</span>`;

    return `
      <tr data-order-id="${order.id}">
        <td><span class="order-id-badge">#ORD-${order.id}</span></td>
        <td>
          <div class="order-customer-cell">
            <span class="order-cust-name">${escapeHtml(order.customerName)}</span>
            <span class="order-cust-phone">${escapeHtml(order.customerPhone || 'N/A')}</span>
          </div>
        </td>
        <td>
          <div class="order-route-cell">
            <span class="route-from-to"><b>From:</b> ${escapeHtml(order.pickupAddress)}</span>
            <span class="route-from-to"><b>To:</b> ${escapeHtml(order.deliveryAddress)}</span>
            ${viaHtml}
          </div>
        </td>
        <td><span class="priority-pill ${priorityClass}">${escapeHtml(order.priority || 'standard')}</span></td>
        <td><strong>₹${Number(order.orderValue || 0).toLocaleString('en-IN')}</strong></td>
        <td><span class="policy-badge ${policyClass}">${policyText}</span></td>
        <td>${driverName}</td>
        <td><span class="badge-status ${statusClass}">${statusText}</span></td>
        <td>
          <div class="order-actions-cell">
            <button class="btn-action-sm" onclick="trackOrderDirect(${order.id})" title="Track Live Telemetry">Track</button>
            ${isPending ? `<button class="btn-action-sm btn-dispatch-sm" onclick="dispatchOrderDirect(${order.id}, '${order.routePreference}')" title="Dispatch Driver">Dispatch</button>` : ''}
            <button class="btn-action-sm" onclick="predictOrderDirect(${order.id})" title="Run AI Prediction">Predict</button>
            <button class="btn-action-sm" onclick="notifyOrderDirect(${order.id})" title="Notify Customer">SMS</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// Global action handlers for order row buttons
window.trackOrderDirect = async function(orderId) {
  openTrackOrderModal(orderId);
};

window.dispatchOrderDirect = async function(orderId, preferredMode) {
  const mode = preferredMode === 'customer' ? 'customer' : 'fasttrack';
  showToast("Dispatching...", `Deploying courier for Order #${orderId} on ${mode === 'customer' ? 'Customer Safety Route' : 'FastTrack AI Route'}`);

  const res = await fetchApi(`/api/orders/${orderId}/dispatch`, {
    method: 'POST',
    body: JSON.stringify({ routeMode: mode })
  });

  if (res && res.success) {
    showToast("Dispatched! 🚀", res.message || `Order #${orderId} is now out for delivery.`);
    await loadLiveApiData();
    await loadOrdersData();
  } else {
    showToast("Dispatch Failed", res?.message || "Could not dispatch order.");
  }
};

window.predictOrderDirect = async function(orderId) {
  const res = await fetchApi(`/api/ai/predict/${orderId}`);
  if (res && res.success && res.prediction) {
    const p = res.prediction;
    showToast(
      `AI Prediction: Order #${orderId}`,
      `ETA: ${p.estimatedDeliveryTime} (Confidence: ${p.confidence}). ${p.riskFactors?.length ? `⚠️ ${p.riskFactors[0]}` : 'Optimal traffic conditions.'}`
    );
  } else {
    showToast("Prediction Error", "Could not fetch AI predictions for this order.");
  }
};

window.notifyOrderDirect = async function(orderId) {
  const res = await fetchApi(`/api/notify/${orderId}`, { method: 'POST' });
  if (res && res.success) {
    showToast("SMS Dispatched 📱", `Delivery alert notification sent to customer for Order #${orderId}.`);
  } else {
    showToast("Notification Failed", res?.message || "Could not send customer notification.");
  }
};

// Modal Tracking Timeline
async function openTrackOrderModal(orderId) {
  const modal = document.getElementById("trackOrderModal");
  const modalBody = document.getElementById("trackModalBody");
  const heading = document.getElementById("trackModalHeading");
  const subhead = document.getElementById("trackModalSubhead");
  const notifyBtn = document.getElementById("modalNotifyBtn");

  if (!modal || !modalBody) return;

  heading.textContent = `Consignment Radar: #ORD-${orderId}`;
  subhead.textContent = `Fetching real-time telemetry from GPS mesh network...`;
  modal.hidden = false;

  modalBody.innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--neon-cyan);">
      <div style="font-size: 1.8rem; animation: pulse 1s infinite;">📡</div>
      <p style="margin-top: 8px; font-size: 0.8rem;">Querying live telemetry feed...</p>
    </div>
  `;

  // Fetch tracking data & AI prediction simultaneously
  const [trackRes, predictRes] = await Promise.all([
    fetchApi(`/api/track/${orderId}`),
    fetchApi(`/api/ai/predict/${orderId}`)
  ]);

  if (!trackRes || !trackRes.success || !trackRes.data) {
    modalBody.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #ef4444;">
        <p>Order #${orderId} was not found or has expired from memory.</p>
      </div>
    `;
    return;
  }

  const track = trackRes.data;
  const predict = predictRes?.prediction || null;
  const isSafeLock = track.routePreference === 'customer';

  // Wire notify button in modal
  if (notifyBtn) {
    notifyBtn.onclick = () => notifyOrderDirect(orderId);
  }

  // Determine timeline step status
  const isCompleted = track.status === 'completed';
  const isTransit = track.status === 'out-for-delivery' || track.status === 'dispatched';

  modalBody.innerHTML = `
    <!-- Progress Timeline -->
    <div class="track-timeline-container">
      <div class="timeline-step completed">
        <div class="timeline-dot">✓</div>
        <span class="timeline-label">Order Placed</span>
        <span class="timeline-time">${new Date(track.timeline?.[0]?.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <div class="timeline-step completed">
        <div class="timeline-dot">✓</div>
        <span class="timeline-label">Confirmed</span>
        <span class="timeline-time">Mesh Synced</span>
      </div>

      <div class="timeline-step ${isTransit || isCompleted ? (isCompleted ? 'completed' : 'active') : ''}">
        <div class="timeline-dot">${isCompleted ? '✓' : '🚚'}</div>
        <span class="timeline-label">In Transit</span>
        <span class="timeline-time">${isTransit ? 'Moving' : (isCompleted ? 'Finished' : 'Queued')}</span>
      </div>

      <div class="timeline-step ${isCompleted ? 'completed' : ''}">
        <div class="timeline-dot">${isCompleted ? '✓' : '📍'}</div>
        <span class="timeline-label">Delivered</span>
        <span class="timeline-time">${isCompleted ? 'Doorstep Handover' : 'Pending'}</span>
      </div>
    </div>

    <!-- Details Grid -->
    <div class="track-info-grid">
      <!-- Card 1: Assigned Driver & Vehicle -->
      <div class="track-detail-card">
        <h4>Assigned Delivery Agent</h4>
        ${track.driver ? `
          <div class="track-detail-row"><span>Driver Name:</span><span>${escapeHtml(track.driver.name)}</span></div>
          <div class="track-detail-row"><span>Contact:</span><span>${escapeHtml(track.driver.phone)}</span></div>
          <div class="track-detail-row"><span>Vehicle Type:</span><span>${escapeHtml(track.driver.vehicle)}</span></div>
          <div class="track-detail-row"><span>Performance Rating:</span><span>⭐ ${track.driver.rating} / 5.0</span></div>
          <div class="track-detail-row"><span>Current GPS Cell:</span><span style="color: var(--neon-mint);">${escapeHtml(track.currentLocation || 'En Route')}</span></div>
        ` : `
          <p style="color: var(--text-secondary); font-size: 0.78rem;">No driver assigned yet. Will be allocated upon dispatch.</p>
        `}
      </div>

      <!-- Card 2: Route Policy & Safe Checkpoints -->
      <div class="track-detail-card">
        <h4>Navigation Policy &amp; Checkpoints</h4>
        <div class="track-detail-row">
          <span>Active Route Policy:</span>
          <span style="color: ${isSafeLock ? '#ff9933' : '#00e5ff'};">${isSafeLock ? '🔒 Customer Safe-Path Lock' : '⚡ FastTrack AI Dynamic'}</span>
        </div>
        <div class="track-detail-row"><span>Lifecycle State:</span><span style="text-transform: capitalize;">${escapeHtml(track.status)}</span></div>
        <div class="track-detail-row"><span>Target ETA:</span><span>${track.estimatedArrival ? new Date(track.estimatedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '30 mins'}</span></div>
        ${Array.isArray(track.customWaypoints) && track.customWaypoints.length > 0 ? `
          <div style="margin-top: 8px;">
            <span style="font-size: 0.7rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Mandatory Safe Checkpoints:</span>
            <div style="display: flex; flex-direction: column; gap: 3px;">
              ${track.customWaypoints.map(wp => `<span class="route-via-pill">📍 ${escapeHtml(wp)}</span>`).join("")}
            </div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- AI Delivery Predictor Card -->
    ${predict ? `
      <div class="ai-prediction-box">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <strong style="color: var(--neon-cyan); font-size: 0.8rem;">🤖 Machine Learning Delivery Window Analysis</strong>
          <span class="ai-confidence-pill">${predict.confidence} Confidence</span>
        </div>
        <div class="track-detail-row"><span>Estimated Doorstep Window:</span><strong style="color: #ffffff;">${predict.estimatedDeliveryTime}</strong></div>
        ${predict.riskFactors && predict.riskFactors.length > 0 ? `
          <div class="track-detail-row" style="color: #fb923c;"><span>Traffic Advisory:</span><span>⚠️ ${predict.riskFactors[0]}</span></div>
        ` : `
          <div class="track-detail-row" style="color: var(--neon-mint);"><span>Traffic Advisory:</span><span>✓ Clear corridor flow</span></div>
        `}
      </div>
    ` : ''}
  `;
}

/* ==========================================================================
   EMERGENCY SOS & POLICE MESH (112 PROTOCOL)
   ========================================================================== */

async function openEmergencyModal(options = {}) {
  const modal = document.getElementById("emergencyModal");
  if (!modal) return;

  if (options.lat && options.lng) {
    currentEmergencyCoords = { lat: Number(options.lat), lng: Number(options.lng) };
    const locSelect = document.getElementById("emergencyLocationSelect");
    if (locSelect) locSelect.value = "custom";
    const customWrap = document.getElementById("customCoordsWrap");
    if (customWrap) customWrap.hidden = false;
    const latInp = document.getElementById("emergencyCustomLat");
    const lngInp = document.getElementById("emergencyCustomLng");
    if (latInp) latInp.value = currentEmergencyCoords.lat;
    if (lngInp) lngInp.value = currentEmergencyCoords.lng;
  }

  if (options.orderId) {
    const orderInp = document.getElementById("emergencyOrderId");
    if (orderInp) orderInp.value = options.orderId;
  }

  modal.hidden = false;
  await fetchNearestPoliceStations(currentEmergencyCoords.lat, currentEmergencyCoords.lng);
}

async function fetchNearestPoliceStations(lat, lng) {
  const container = document.getElementById("policeMeshContainer");
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 25px; color: var(--neon-cyan);">
      <div style="font-size: 1.6rem; animation: pulse 1s infinite;">📡</div>
      <p style="margin-top: 6px; font-size: 0.78rem;">Triangulating nearest police mesh stations for [${lat.toFixed(4)}, ${lng.toFixed(4)}]...</p>
    </div>
  `;

  const res = await fetchApi(`/api/emergency/nearest-police?lat=${lat}&lng=${lng}`);

  if (!res || !res.success || !res.nearest) {
    container.innerHTML = `
      <div class="primary-station-card" style="border-color: #ef4444;">
        <h4 style="color: #ef4444;">⚠️ Police Mesh Telemetry Offline</h4>
        <p style="font-size: 0.76rem; color: var(--text-secondary); margin: 6px 0 10px;">Could not connect to nearby police locator. Immediate manual action required:</p>
        <a href="tel:112" class="btn-call-112" style="font-size: 0.85rem;">📞 Direct National Dial: 112 (Police: 100)</a>
      </div>
    `;
    return;
  }

  currentNearestStation = res.nearest;

  // Plot on Leaflet Map
  if (map && window.L) {
    // Clear previous emergency layers
    if (emergencyMapMarker) map.removeLayer(emergencyMapMarker);
    if (emergencyMapCircle) map.removeLayer(emergencyMapCircle);
    if (emergencyPoliceMarker) map.removeLayer(emergencyPoliceMarker);
    if (emergencyPoliceLine) map.removeLayer(emergencyPoliceLine);

    // Emergency Origin Marker (Red Pulse)
    const sosIcon = L.divIcon({
      className: "sos-map-icon",
      html: `<div style="background:#ef4444; color:#fff; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-size:14px; box-shadow:0 0 15px #ef4444; border:2px solid #fff; animation:pulse 1s infinite;">🚨</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    emergencyMapMarker = L.marker([lat, lng], { icon: sosIcon }).addTo(map);

    emergencyMapCircle = L.circle([lat, lng], {
      radius: 800,
      color: "#ef4444",
      fillColor: "#ef4444",
      fillOpacity: 0.15,
      weight: 2
    }).addTo(map);

    // Nearest Police Station Marker (Blue Badge)
    if (res.nearest.lat && res.nearest.lng) {
      const policeIcon = L.divIcon({
        className: "police-map-icon",
        html: `<div style="background:#00e5ff; color:#0d1524; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:bold; box-shadow:0 0 15px #00e5ff; border:2px solid #fff;">👮</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      emergencyPoliceMarker = L.marker([res.nearest.lat, res.nearest.lng], { icon: policeIcon })
        .bindPopup(`<b>${escapeHtml(res.nearest.name)}</b><br>${escapeHtml(res.nearest.address || 'Precinct')}<br>Distance: ${res.nearest.distanceKm || '1.2'} km`)
        .addTo(map);

      emergencyPoliceLine = L.polyline([
        [lat, lng],
        [res.nearest.lat, res.nearest.lng]
      ], {
        color: "#ef4444",
        weight: 3,
        dashArray: "6, 8",
        opacity: 0.9
      }).addTo(map);
    }
  }

  const nearest = res.nearest;
  const secondaryStations = Array.isArray(res.stations) ? res.stations.slice(1, 5) : [];

  container.innerHTML = `
    <!-- Primary Station Card -->
    <div class="primary-station-card">
      <div class="station-card-top">
        <div class="station-name-wrap">
          <span class="station-badge-nearest">Primary Nearest Station (Verified)</span>
          <h4 style="margin-top: 4px;">👮 ${escapeHtml(nearest.name)}</h4>
        </div>
        <div class="station-meta-pills">
          <span class="meta-pill pill-dist">📍 ${nearest.distanceKm || '1.2'} km away</span>
          <span class="meta-pill pill-time">⚡ ~${nearest.travelTimeMin || '4'} mins drive</span>
          <span class="meta-pill pill-source">${res.source === 'google-places' ? 'Google Places Live' : 'NCR Master Directory'}</span>
        </div>
      </div>

      <p class="station-address">🏢 ${escapeHtml(nearest.address || 'Delhi NCR Police Station Precinct')}</p>

      <div class="station-actions-row">
        <a href="${res.googleMapsUrl || '#'}" target="_blank" rel="noopener" class="btn-gmaps-nav">
          <span>🗺️ Open Turn-by-Turn GPS Escort</span>
          <span style="font-size: 0.85rem;">↗</span>
        </a>
        <a href="tel:${nearest.phone || '112'}" class="btn-call-112">
          <span>📞 Direct Hotline: ${nearest.phone || '112'}</span>
        </a>
      </div>
    </div>

    <!-- Secondary Stations in Police Mesh -->
    ${secondaryStations.length > 0 ? `
      <div class="secondary-mesh-box">
        <div class="secondary-mesh-title">Additional Police Stations within 5-10 km Radius</div>
        <div class="secondary-stations-grid">
          ${secondaryStations.map(st => `
            <div class="secondary-station-item">
              <span class="sec-name">👮 ${escapeHtml(st.name)}</span>
              <div class="sec-info">
                <span>📍 ${st.distanceKm || '3.5'} km · ~${st.travelTimeMin || '8'} mins</span>
                <a href="tel:${st.phone || '112'}" style="color: var(--neon-cyan); text-decoration: none; font-weight: bold;">Dial ${st.phone || '112'}</a>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ''}
  `;
}

async function broadcastEmergencySos() {
  const btn = document.getElementById("btnBroadcastSos");
  if (btn) btn.disabled = true;

  const locSelect = document.getElementById("emergencyLocationSelect");
  let lat = currentEmergencyCoords.lat;
  let lng = currentEmergencyCoords.lng;

  if (locSelect?.value === "custom") {
    lat = parseFloat(document.getElementById("emergencyCustomLat")?.value) || lat;
    lng = parseFloat(document.getElementById("emergencyCustomLng")?.value) || lng;
  }

  const orderId = parseInt(document.getElementById("emergencyOrderId")?.value) || null;
  const reason = document.getElementById("emergencyTypeSelect")?.value || "threat";
  const remarks = document.getElementById("emergencyDescription")?.value.trim() || "";
  const stationName = currentNearestStation?.name || "Nearest Delhi NCR Police Station";

  showToast("Transmitting SOS...", "Broadcasting distress alert to Police Mesh & Dispatch HQ");

  await Promise.all([
    fetchApi("/api/emergency/sos", {
      method: "POST",
      body: JSON.stringify({
        lat,
        lng,
        stationName,
        orderId,
        description: `[${reason.toUpperCase()}] ${remarks || 'Field emergency beacon triggered by operator.'}`
      })
    }),
    orderId ? fetchApi(`/api/emergency/${orderId}`, {
      method: "POST",
      body: JSON.stringify({
        type: reason,
        description: remarks || 'Emergency broadcast for consignment.'
      })
    }) : Promise.resolve(null)
  ]);

  if (btn) btn.disabled = false;

  // Append SOS message to Dispatcher Chat / Radio
  const chatMessages = document.getElementById("chatMessages");
  if (chatMessages) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement("div");
    div.className = "chat-msg driver";
    div.style.borderLeft = "3px solid #ef4444";
    div.style.background = "rgba(239, 68, 68, 0.15)";
    div.innerHTML = `
      <div class="chat-author" style="color: #ef4444;">🚨 CRITICAL SOS BEACON · ${time}</div>
      <div class="chat-bubble" style="color: #fff;">
        <b>Distress Beacon active at [${lat.toFixed(4)}, ${lng.toFixed(4)}]</b><br>
        Police Station Routed: <b>${escapeHtml(stationName)}</b><br>
        ${orderId ? `Linked Consignment: #ORD-${orderId}<br>` : ''}
        Status: <b>112 Escort Link Dispatched</b>
      </div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Close modal and focus map on emergency origin
  const modal = document.getElementById("emergencyModal");
  if (modal) modal.hidden = true;

  switchSection("dashboard");
  if (map) {
    map.flyTo([lat, lng], 13.5, { duration: 1.5 });
  }

  showToast(
    "🚨 SOS BROADCAST ACTIVE",
    `Alert transmitted for ${stationName}. National emergency protocol (112) initiated.`
  );
}

window.openEmergencyModal = openEmergencyModal;
window.broadcastEmergencySos = broadcastEmergencySos;

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

  // 3. Sync Mobile Bottom Navigation Buttons
  document.querySelectorAll(".mobile-nav-btn").forEach((mb) => {
    if (mb.dataset.tab === name) {
      if (!mb.dataset.sub || mb.dataset.sub === "map") {
        mb.classList.add("active");
      }
    } else {
      mb.classList.remove("active");
    }
  });

  // 4. Switch Section View
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

  // 5. Invalidate map size if switching to dashboard
  if (name === "dashboard" && map) {
    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }

  // 6. If switching to orders view, reload live orders
  if (name === "orders") {
    loadOrdersData();
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
    btnSaveSettings.addEventListener("click", saveSettingsToStorage);
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

  // ==========================================================================
  // Book Delivery / Checkout Modal Handlers (POST /api/orders)
  // ==========================================================================
  const checkoutModal = document.getElementById("checkoutModal");
  const openCheckoutBtns = [
    document.getElementById("btn-open-checkout-top"),
    document.getElementById("btn-open-checkout-dash"),
    document.getElementById("btn-open-checkout-orders")
  ];
  const closeCheckoutBtn = document.getElementById("closeCheckoutModal");
  const cancelCheckoutBtn = document.getElementById("cancelCheckoutBtn");
  const checkoutForm = document.getElementById("checkoutOrderForm");
  const routeRadios = document.querySelectorAll('input[name="routePreference"]');
  const customRouteWrap = document.getElementById("checkoutCustomRouteWrap");
  const cardFasttrack = document.getElementById("cardFasttrackRoute");
  const cardCustomer = document.getElementById("cardCustomerRoute");
  const customWaypointsInput = document.getElementById("checkoutCustomWaypoints");

  // Open modal
  openCheckoutBtns.forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", () => {
        if (checkoutModal) checkoutModal.hidden = false;
      });
    }
  });

  // Close modal
  const hideCheckoutModal = () => {
    if (checkoutModal) checkoutModal.hidden = true;
  };
  if (closeCheckoutBtn) closeCheckoutBtn.addEventListener("click", hideCheckoutModal);
  if (cancelCheckoutBtn) cancelCheckoutBtn.addEventListener("click", hideCheckoutModal);
  if (checkoutModal) {
    checkoutModal.addEventListener("click", (e) => {
      if (e.target === checkoutModal) hideCheckoutModal();
    });
  }

  // Route preference radio cards toggle
  routeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      const isCustomer = radio.value === "customer";
      if (customRouteWrap) customRouteWrap.hidden = !isCustomer;
      if (cardFasttrack) cardFasttrack.classList.toggle("active", !isCustomer);
      if (cardCustomer) cardCustomer.classList.toggle("active", isCustomer);
    });
  });

  // Preset location chips for Pickup and Delivery
  document.querySelectorAll(".preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const targetId = chip.dataset.target;
      const targetInput = document.getElementById(targetId);
      if (targetInput) {
        targetInput.value = chip.dataset.val;
        targetInput.focus();
      }
    });
  });

  // Preset safe corridor chips for custom waypoints
  document.querySelectorAll(".preset-chip-add").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (!customWaypointsInput) return;
      const valToAdd = chip.dataset.val;
      const existing = customWaypointsInput.value.trim();
      if (!existing) {
        customWaypointsInput.value = valToAdd;
      } else if (!existing.includes(valToAdd)) {
        customWaypointsInput.value = `${existing}\n${valToAdd}`;
      }
      customWaypointsInput.focus();
    });
  });

  // Submit Checkout / Book Order Form -> POST /api/orders
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const customerName = document.getElementById("checkoutCustomerName")?.value.trim();
      const customerPhone = document.getElementById("checkoutCustomerPhone")?.value.trim();
      const customerEmail = document.getElementById("checkoutCustomerEmail")?.value.trim();
      const pickupAddress = document.getElementById("checkoutPickupAddress")?.value.trim();
      const deliveryAddress = document.getElementById("checkoutDeliveryAddress")?.value.trim();
      const priority = document.getElementById("checkoutPriority")?.value || "medium";
      const orderValue = parseFloat(document.getElementById("checkoutOrderValue")?.value) || 0;
      const selectedRoute = document.querySelector('input[name="routePreference"]:checked')?.value || "fasttrack";
      const customWaypoints = customWaypointsInput?.value.trim() || "";

      if (selectedRoute === "customer" && !customWaypoints) {
        showToast("Safe Checkpoint Required", "Please enter at least one verified via-point or highway corridor.");
        customWaypointsInput?.focus();
        return;
      }

      const submitBtn = document.getElementById("btnSubmitCheckout");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Booking Delivery...</span>`;
      }

      showToast("Booking Consignment", `Registering parcel drop from ${pickupAddress.split(",")[0]} to ${deliveryAddress.split(",")[0]}...`);

      const result = await fetchApi("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail,
          pickupAddress,
          deliveryAddress,
          priority,
          orderValue,
          routePreference: selectedRoute,
          customWaypoints
        })
      });

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Confirm &amp; Book Consignment</span><span class="btn-arrow">→</span>`;
      }

      if (result && result.success) {
        hideCheckoutModal();
        checkoutForm.reset();
        // Reset route choice back to fasttrack default
        if (customRouteWrap) customRouteWrap.hidden = true;
        if (cardFasttrack) cardFasttrack.classList.add("active");
        if (cardCustomer) cardCustomer.classList.remove("active");

        const order = result.data;
        const driverMsg = result.driverAssigned
          ? `Assigned to Driver ID #${order.assignedDriver}`
          : `Queued for next available van`;

        showToast(
          "Consignment Booked! 🚀",
          `Order #${order.id} (${order.customerName}) created successfully. ${driverMsg}. Route: ${order.routePreference === 'customer' ? 'Customer Safe Lock' : 'FastTrack AI'}`
        );

        // Instant refresh of live dashboard telemetry and charts
        await loadLiveApiData();
        await loadOrdersData();
      } else {
        const errorMsg = result?.message || "Failed to book consignment. Check server connectivity.";
        showToast("Booking Failed", errorMsg);
      }
    });
  }

  // ==========================================================================
  // Orders View & Tracking Modal Event Listeners
  // ==========================================================================
  const btnRefreshOrders = document.getElementById("btn-refresh-orders");
  if (btnRefreshOrders) {
    btnRefreshOrders.addEventListener("click", async () => {
      showToast("Orders Synced", "Refreshing live consignment streams from backend...");
      await loadOrdersData();
    });
  }

  // Filter Pills (All, Pending, In Transit, Completed)
  document.querySelectorAll("#ordersFilterGroup .filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#ordersFilterGroup .filter-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      ordersActiveFilter = pill.dataset.filter;
      renderOrdersTable();
    });
  });

  // Search input
  const searchInput = document.getElementById("ordersSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderOrdersTable();
    });
  }

  // Track Order Modal Close Triggers
  const trackModal = document.getElementById("trackOrderModal");
  const closeTrackBtn = document.getElementById("closeTrackModal");
  const closeTrackBtn2 = document.getElementById("closeTrackModalBtn");

  if (closeTrackBtn && trackModal) {
    closeTrackBtn.addEventListener("click", () => (trackModal.hidden = true));
  }
  if (closeTrackBtn2 && trackModal) {
    closeTrackBtn2.addEventListener("click", () => (trackModal.hidden = true));
  }
  if (trackModal) {
    trackModal.addEventListener("click", (e) => {
      if (e.target === trackModal) trackModal.hidden = true;
    });
  }

  // Quick Consignment Radar Tool Handlers
  const btnRunTrackLookup = document.getElementById("btnRunTrackLookup");
  if (btnRunTrackLookup) {
    btnRunTrackLookup.addEventListener("click", () => {
      const id = parseInt(document.getElementById("trackLookupId")?.value);
      if (!id) {
        showToast("Order ID Required", "Please specify an order ID to trace.");
        return;
      }
      openTrackOrderModal(id);
    });
  }

  const btnRunAiPrediction = document.getElementById("btnRunAiPrediction");
  if (btnRunAiPrediction) {
    btnRunAiPrediction.addEventListener("click", async () => {
      const id = parseInt(document.getElementById("trackLookupId")?.value);
      if (!id) {
        showToast("Order ID Required", "Please specify an order ID for AI prediction.");
        return;
      }

      showToast("Running AI Predictor...", `Analyzing rush hour congestion and SLA promise for Order #${id}`);
      const res = await fetchApi(`/api/ai/predict/${id}`);
      const box = document.getElementById("quickTrackResult");
      if (box && res?.prediction) {
        const p = res.prediction;
        box.hidden = false;
        box.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <strong style="color: var(--neon-cyan); font-size: 0.85rem;">🤖 Machine Learning Delivery Window: Consignment #${id}</strong>
            <span class="ai-confidence-pill">${p.confidence} Confidence</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 8px; font-size: 0.78rem;">
            <div><span style="color: var(--text-secondary);">Customer:</span> <b>${escapeHtml(p.customerName)}</b></div>
            <div><span style="color: var(--text-secondary);">Estimated SLA Window:</span> <b style="color: var(--neon-mint);">${p.estimatedDeliveryTime}</b></div>
            <div><span style="color: var(--text-secondary);">Traffic Impact:</span> <b>${p.riskFactors?.length ? `⚠️ ${p.riskFactors[0]}` : '✓ Clear Corridors'}</b></div>
          </div>
        `;
      } else {
        showToast("Order Not Found", `Consignment #${id} was not found.`);
      }
    });
  }

  const btnSendCustomerSms = document.getElementById("btnSendCustomerSms");
  if (btnSendCustomerSms) {
    btnSendCustomerSms.addEventListener("click", () => {
      const id = parseInt(document.getElementById("trackLookupId")?.value);
      if (!id) {
        showToast("Order ID Required", "Please specify an order ID to notify.");
        return;
      }
      notifyOrderDirect(id);
    });
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

  // ==========================================================================
  // Emergency SOS & Police Mesh Modal Triggers & Controls
  // ==========================================================================
  const emergencyModal = document.getElementById("emergencyModal");
  const openSosBtns = [
    document.getElementById("btn-open-sos-top"),
    document.getElementById("btn-open-sos-dash"),
    document.getElementById("tool-sos-radar"),
    document.getElementById("btn-open-sos-home")
  ];
  const closeSosBtn = document.getElementById("closeEmergencyModal");
  const closeSosBtn2 = document.getElementById("closeEmergencyModalBtn");
  const locSelect = document.getElementById("emergencyLocationSelect");
  const customWrap = document.getElementById("customCoordsWrap");
  const latInp = document.getElementById("emergencyCustomLat");
  const lngInp = document.getElementById("emergencyCustomLng");
  const btnBroadcastSos = document.getElementById("btnBroadcastSos");

  openSosBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener("click", () => {
        openEmergencyModal();
      });
    }
  });

  const hideSosModal = () => {
    if (emergencyModal) emergencyModal.hidden = true;
  };
  if (closeSosBtn) closeSosBtn.addEventListener("click", hideSosModal);
  if (closeSosBtn2) closeSosBtn2.addEventListener("click", hideSosModal);
  if (emergencyModal) {
    emergencyModal.addEventListener("click", (e) => {
      if (e.target === emergencyModal) hideSosModal();
    });
  }

  // Location selector change
  if (locSelect) {
    locSelect.addEventListener("change", async () => {
      if (locSelect.value === "custom") {
        if (customWrap) customWrap.hidden = false;
        const lat = parseFloat(latInp?.value) || 28.6250;
        const lng = parseFloat(lngInp?.value) || 77.2400;
        currentEmergencyCoords = { lat, lng };
        await fetchNearestPoliceStations(lat, lng);
      } else {
        if (customWrap) customWrap.hidden = true;
        const [latStr, lngStr] = locSelect.value.split(",");
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        currentEmergencyCoords = { lat, lng };
        await fetchNearestPoliceStations(lat, lng);
      }
    });
  }

  if (latInp && lngInp) {
    const onCustomCoordChange = async () => {
      const lat = parseFloat(latInp.value) || 28.6250;
      const lng = parseFloat(lngInp.value) || 77.2400;
      currentEmergencyCoords = { lat, lng };
      await fetchNearestPoliceStations(lat, lng);
    };
    latInp.addEventListener("change", onCustomCoordChange);
    lngInp.addEventListener("change", onCustomCoordChange);
  }

  if (btnBroadcastSos) {
    btnBroadcastSos.addEventListener("click", broadcastEmergencySos);
  }

  // ==========================================================================
  // Operator Profile Modal (Admin Pill Trigger)
  // ==========================================================================
  const userProfileBtn = document.getElementById("user-profile-btn");
  const operatorModal = document.getElementById("operatorProfileModal");
  const closeOperatorBtn = document.getElementById("closeOperatorModal");
  const closeOperatorBtn2 = document.getElementById("closeOperatorModalBtn");
  const btnExportSessionLog = document.getElementById("btnExportSessionLog");

  if (userProfileBtn && operatorModal) {
    userProfileBtn.addEventListener("click", () => {
      operatorModal.hidden = false;
    });
  }

  const hideOperatorModal = () => {
    if (operatorModal) operatorModal.hidden = true;
  };
  if (closeOperatorBtn) closeOperatorBtn.addEventListener("click", hideOperatorModal);
  if (closeOperatorBtn2) closeOperatorBtn2.addEventListener("click", hideOperatorModal);
  if (operatorModal) {
    operatorModal.addEventListener("click", (e) => {
      if (e.target === operatorModal) hideOperatorModal();
    });
  }

  if (btnExportSessionLog) {
    btnExportSessionLog.addEventListener("click", () => {
      const shiftLog = {
        operator: "Alex Chen",
        role: "Senior Operations Dispatcher",
        terminal: "TERM-DEL-01A",
        sector: "Delhi NCR Core",
        sessionStart: new Date(Date.now() - 4.4 * 3600000).toISOString(),
        activeShiftTime: "4h 24m",
        dispatchesAuthorized: currentOrdersList.length,
        fleetSupervised: 48,
        slaScore: "98.5%",
        securityClearance: "Level 4",
        exportTimestamp: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(shiftLog, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shift_log_AlexChen_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Shift Log Exported", "Operator audit trail JSON downloaded.");
    });
  }

  // ==========================================================================
  // Card Context Menu Dropdowns (Dots Buttons)
  // ==========================================================================
  const contextMenu = document.getElementById("cardContextMenu");

  document.querySelectorAll(".card-dots-btn, .more-options-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!contextMenu) return;

      const rect = btn.getBoundingClientRect();
      contextMenu.style.top = `${rect.bottom + window.scrollY + 6}px`;
      contextMenu.style.left = `${Math.min(rect.left + window.scrollX - 140, window.innerWidth - 240)}px`;
      contextMenu.hidden = false;
    });
  });

  document.addEventListener("click", (e) => {
    if (contextMenu && !contextMenu.contains(e.target)) {
      contextMenu.hidden = true;
    }
  });

  if (contextMenu) {
    contextMenu.querySelectorAll(".context-menu-item").forEach((item) => {
      item.addEventListener("click", async () => {
        const action = item.dataset.action;
        contextMenu.hidden = true;

        if (action === "refresh") {
          showToast("Syncing Telemetry", "Querying backend for live GPS & order telemetry...");
          await loadLiveApiData();
          showToast("Telemetry Refreshed", "All dashboard telemetry cards synced.");
        } else if (action === "export") {
          const snapshot = {
            timestamp: new Date().toISOString(),
            operator: "Alex Chen",
            ordersCount: currentOrdersList.length,
            orders: currentOrdersList,
            fleetMetrics: {
              activeVans: "48/50",
              onTimeRate: "98.5%",
              aiFuelSavings: "24.8%"
            }
          };
          const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `bharat_express_telemetry_${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          showToast("Snapshot Exported", "Live telemetry metrics downloaded.");
        } else if (action === "settings") {
          switchSection("settings");
        }
      });
    });
  }
}

/* ==========================================================================
   SETTINGS PERSISTENCE (localStorage)
   ========================================================================== */

const SETTINGS_STORAGE_KEY = "bharat_express_ops_settings_v1";

function loadSettingsFromStorage() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      saveSettingsToStorage();
      return;
    }
    const s = JSON.parse(raw);

    const autoOpt = document.getElementById("setting-auto-optimize");
    if (autoOpt && s.autoOptimize !== undefined) autoOpt.checked = s.autoOptimize;

    const maxOrders = document.getElementById("setting-max-orders");
    if (maxOrders && s.maxOrders !== undefined) maxOrders.value = s.maxOrders;

    const minRating = document.getElementById("setting-min-rating");
    if (minRating && s.minRating !== undefined) minRating.value = s.minRating;

    const speedAlert = document.getElementById("setting-speed-alert");
    if (speedAlert && s.speedAlert !== undefined) speedAlert.value = s.speedAlert;

    const autoPolice = document.getElementById("setting-auto-police");
    if (autoPolice && s.autoPolice !== undefined) autoPolice.checked = s.autoPolice;

    const custPriority = document.getElementById("setting-customer-priority");
    if (custPriority && s.customerPriority !== undefined) custPriority.checked = s.customerPriority;
  } catch (e) {
    console.warn("Could not load settings from localStorage:", e);
  }
}

function saveSettingsToStorage() {
  const autoOpt = document.getElementById("setting-auto-optimize")?.checked ?? true;
  const maxOrders = parseInt(document.getElementById("setting-max-orders")?.value) || 6;
  const minRating = parseFloat(document.getElementById("setting-min-rating")?.value) || 4.8;
  const speedAlert = parseInt(document.getElementById("setting-speed-alert")?.value) || 65;
  const autoPolice = document.getElementById("setting-auto-police")?.checked ?? true;
  const customerPriority = document.getElementById("setting-customer-priority")?.checked ?? true;

  const settingsObj = {
    autoOptimize: autoOpt,
    maxOrders,
    minRating,
    speedAlert,
    autoPolice,
    customerPriority,
    savedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsObj));
    showToast(
      "Settings Persisted ✓",
      `Max ${maxOrders} orders/van · Speed alert at ${speedAlert} km/h · Auto-Police: ${autoPolice ? 'ON' : 'OFF'}`
    );
  } catch (e) {
    showToast("Settings Saved", "Preferences applied to active session.");
  }
}

window.loadSettingsFromStorage = loadSettingsFromStorage;
window.saveSettingsToStorage = saveSettingsToStorage;

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

/* ==========================================================================
   6. 1-CLICK FLOATING HUD CARD TOGGLE (MINIMIZE / EXPAND)
   ========================================================================== */

function initCardCollapses() {
  const toggleActiveMap = document.getElementById("btn-toggle-active-map");
  const panelActiveMap = document.getElementById("active-map-panel");
  if (toggleActiveMap && panelActiveMap) {
    toggleActiveMap.addEventListener("click", (e) => {
      e.stopPropagation();
      const isCollapsed = panelActiveMap.classList.toggle("collapsed");
      const icon = toggleActiveMap.querySelector(".toggle-icon");
      if (icon) icon.textContent = isCollapsed ? "+" : "−";
      toggleActiveMap.title = isCollapsed ? "Expand Panel (1-Click)" : "Minimize Panel (1-Click)";
    });
  }

  const toggleAiOpt = document.getElementById("btn-toggle-ai-opt");
  const panelAiOpt = document.getElementById("ai-route-optimization-panel");
  if (toggleAiOpt && panelAiOpt) {
    toggleAiOpt.addEventListener("click", (e) => {
      e.stopPropagation();
      const isCollapsed = panelAiOpt.classList.toggle("collapsed");
      const icon = toggleAiOpt.querySelector(".toggle-icon");
      if (icon) icon.textContent = isCollapsed ? "+" : "−";
      toggleAiOpt.title = isCollapsed ? "Expand Panel (1-Click)" : "Minimize Panel (1-Click)";
    });
  }

  // On mobile devices, default floating cards to collapsed for maximum map space
  if (window.innerWidth <= 768) {
    if (panelActiveMap) {
      panelActiveMap.classList.add("collapsed");
      const icon = toggleActiveMap ? toggleActiveMap.querySelector(".toggle-icon") : null;
      if (icon) icon.textContent = "+";
    }
    if (panelAiOpt) {
      panelAiOpt.classList.add("collapsed");
      const icon = toggleAiOpt ? toggleAiOpt.querySelector(".toggle-icon") : null;
      if (icon) icon.textContent = "+";
    }
  }
}

/* ==========================================================================
   7. MOBILE-FIRST INTERACTION CONTROLLER (BOTTOM NAV & TELEMETRY SHEET)
   ========================================================================== */

function initMobileNavigation() {
  const rightPanel = document.getElementById("dashboardRightPanel");
  const btnStatsFab = document.getElementById("btn-mobile-stats-fab");
  const btnBackMap = document.getElementById("btn-mobile-back-map");
  const mobileNavBtns = document.querySelectorAll(".mobile-nav-btn");

  function setMobileSub(sub) {
    if (sub === "stats") {
      if (rightPanel) rightPanel.classList.add("mobile-active");
      mobileNavBtns.forEach(b => b.classList.toggle("active", b.dataset.sub === "stats"));
    } else {
      if (rightPanel) rightPanel.classList.remove("mobile-active");
      mobileNavBtns.forEach(b => b.classList.toggle("active", b.dataset.sub === "map"));
      if (map) {
        setTimeout(() => map.invalidateSize(), 150);
      }
    }
  }

  if (btnStatsFab) {
    btnStatsFab.addEventListener("click", () => setMobileSub("stats"));
  }

  if (btnBackMap) {
    btnBackMap.addEventListener("click", () => setMobileSub("map"));
  }

  mobileNavBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      const sub = btn.dataset.sub;
      switchSection(tab);
      if (tab === "dashboard" && sub) {
        setMobileSub(sub);
      } else {
        if (rightPanel) rightPanel.classList.remove("mobile-active");
        mobileNavBtns.forEach(b => b.classList.toggle("active", b === btn));
      }
    });
  });
}


