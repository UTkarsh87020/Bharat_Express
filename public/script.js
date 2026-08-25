const api = (path, options = {}) =>
  fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  });
window.api = api;

function showPage(name) {
  if (window.FTMotion) {
    window.FTMotion.showPage(name);
    return;
  }
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === name);
  });
  document.querySelectorAll(".main-nav a").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === name);
  });
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

async function loadAnalytics() {
  const data = await api("/api/analytics");
  const overview = data.data.overview;
  const drivers = data.data.drivers;
  const performance = data.data.performance;
  document.getElementById("kpi-grid").innerHTML = [
    ["Total orders", overview.totalOrders],
    ["Pending", overview.pendingOrders],
    ["Completed", overview.completedOrders],
    ["Revenue (₹)", overview.totalRevenue],
    ["Available drivers", drivers.availableDrivers],
    ["On-time rate", performance.onTimeDeliveryRate],
  ]
    .map(
      ([label, value]) =>
        `<article class="kpi tilt-card"><strong>${value}</strong><label>${label}</label></article>`
    )
    .join("");
  setup3dEffects();
}

async function loadOrders() {
  const data = await api("/api/orders");
  const body = document.getElementById("orders-body");
  body.innerHTML = data.data
    .map((order) => {
      const booked = order.routePreference === "customer" ? "Customer path" : "FastTrack path";
      const live = order.dispatchRouteMode
        ? order.dispatchRouteMode === "customer"
          ? "Riding customer path"
          : "Riding FastTrack path"
        : "Not dispatched";
      const pillClass = (order.dispatchRouteMode || order.routePreference) === "customer" ? "customer" : "fasttrack";
      return `
      <tr>
        <td>${order.id}</td>
        <td>${order.customerName}<br><small>${order.customerPhone}</small></td>
        <td>${order.pickupAddress}<br>→ ${order.deliveryAddress}</td>
        <td>${order.priority}</td>
        <td>₹${Number(order.orderValue || 0).toFixed(2)}</td>
        <td>${order.status}</td>
        <td>
          <span class="route-pill ${pillClass}">${booked}</span><br>
          <small>${live}</small>
        </td>
        <td>
          <div class="dispatch-row">
            <button class="btn" data-dispatch="${order.id}:fasttrack">Dispatch own route</button>
            <button class="btn" data-dispatch="${order.id}:customer">Dispatch customer route</button>
            <button class="btn" data-status="${order.id}:out-for-delivery">Out</button>
            <button class="btn" data-status="${order.id}:completed">Done</button>
            <button class="btn danger" data-emergency="${order.id}">SOS</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

async function loadDrivers() {
  const data = await api("/api/drivers");
  document.getElementById("drivers-body").innerHTML = data.data
    .map(
      (driver) => `
      <tr>
        <td>${driver.id}</td>
        <td>${driver.name}<br><small>${driver.phone}</small></td>
        <td>${driver.vehicleType} · ${driver.licensePlate}</td>
        <td>${driver.currentLocation}</td>
        <td>${driver.rating}</td>
        <td>${driver.status}</td>
        <td>
          <button class="btn" data-driver-status="${driver.id}:available">Available</button>
          <button class="btn" data-driver-status="${driver.id}:busy">Busy</button>
        </td>
      </tr>`
    )
    .join("");
}

async function loadNotifications() {
  const data = await api("/api/notifications");
  const list = document.getElementById("notifications");
  if (!data.data.length) {
    list.innerHTML = "<li>No notifications yet.</li>";
    return;
  }
  list.innerHTML = data.data
    .slice()
    .reverse()
    .map((item) => `<li>${item.message} <small>(${new Date(item.timestamp).toLocaleTimeString()})</small></li>`)
    .join("");
}

function setup3dEffects() {
  if (window.FTMotion) window.FTMotion.setup3dEffects();
}

async function refreshDashboard() {
  const note = document.getElementById("server-note");
  try {
    await Promise.all([loadAnalytics(), loadOrders(), loadDrivers(), loadNotifications()]);
    if (note) note.hidden = true;
  } catch (error) {
    console.warn("Could not load live data", error);
    if (note) note.hidden = false;
  }
}

function on(id, eventName, handler) {
  const node = document.getElementById(id);
  if (node) node.addEventListener(eventName, handler);
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.FTMotion) showPage((location.hash || "#home").slice(1) || "home");
  setup3dEffects();
  await refreshDashboard();

  on("btn-analyze", "click", async () => {
    const out = document.getElementById("ai-analysis");
    try {
      out.textContent = formatJson(await api("/api/ai/analyze"));
    } catch (error) {
      out.textContent = error.message;
    }
  });

  on("btn-optimize", "click", async () => {
    const out = document.getElementById("route-output");
    try {
      out.textContent = formatJson(await api("/api/route/optimize"));
    } catch (error) {
      out.textContent = error.message;
    }
  });

  const orderForm = document.getElementById("order-form");
  const customRouteWrap = document.getElementById("custom-route-wrap");
  function syncRouteFields() {
    if (!orderForm || !customRouteWrap) return;
    const choice = orderForm.querySelector('input[name="routePreference"]:checked');
    customRouteWrap.hidden = !(choice && choice.value === "customer");
  }
  if (orderForm) {
    orderForm.addEventListener("change", syncRouteFields);
    syncRouteFields();
    orderForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target;
      const payload = Object.fromEntries(new FormData(form).entries());
      const msg = document.getElementById("order-msg");
      try {
        const result = await api("/api/orders", { method: "POST", body: JSON.stringify(payload) });
        msg.textContent = result.message;
        form.reset();
        syncRouteFields();
        await refreshDashboard();
      } catch (error) {
        msg.textContent = error.message;
      }
    });
  }

  on("driver-form", "submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const payload = Object.fromEntries(new FormData(form).entries());
    const msg = document.getElementById("driver-msg");
    try {
      const result = await api("/api/drivers", { method: "POST", body: JSON.stringify(payload) });
      msg.textContent = result.message;
      form.reset();
      await loadDrivers();
    } catch (error) {
      msg.textContent = error.message;
    }
  });

  on("btn-refresh-orders", "click", loadOrders);
  on("btn-refresh-drivers", "click", loadDrivers);

  on("btn-track", "click", async () => {
    const id = document.getElementById("track-id").value;
    const out = document.getElementById("track-output");
    const map = document.getElementById("track-map");
    try {
      const payload = await api(`/api/track/${id}`);
      out.textContent = formatJson(payload);
      if (payload.data && payload.data.map && payload.data.map.mapEmbedUrl && map) {
        map.hidden = false;
        map.src = payload.data.map.mapEmbedUrl;
      }
    } catch (error) {
      if (out) out.textContent = error.message;
      if (map) map.hidden = true;
    }
  });

  on("btn-predict", "click", async () => {
    const id = document.getElementById("track-id").value;
    const out = document.getElementById("track-output");
    try {
      out.textContent = formatJson(await api(`/api/ai/predict/${id}`));
    } catch (error) {
      out.textContent = error.message;
    }
  });

  on("btn-notify", "click", async () => {
    const id = document.getElementById("track-id").value;
    const out = document.getElementById("track-output");
    try {
      out.textContent = formatJson(await api(`/api/notify/${id}`, { method: "POST", body: "{}" }));
      await loadNotifications();
    } catch (error) {
      out.textContent = error.message;
    }
  });

  on("btn-bulk", "click", async () => {
    const msg = document.getElementById("bulk-msg");
    const driverId = Number(document.getElementById("bulk-driver").value);
    const orderIds = document
      .getElementById("bulk-orders")
      .value.split(",")
      .map((value) => Number(value.trim()))
      .filter(Boolean);
    try {
      const result = await api("/api/orders/bulk-assign", {
        method: "POST",
        body: JSON.stringify({ driverId, orderIds }),
      });
      msg.textContent = result.message;
      await Promise.all([loadOrders(), loadDrivers()]);
    } catch (error) {
      msg.textContent = error.message;
    }
  });

  on("orders-body", "click", async (event) => {
    const dispatchBtn = event.target.closest("[data-dispatch]");
    const statusBtn = event.target.closest("[data-status]");
    const emergencyBtn = event.target.closest("[data-emergency]");
    try {
      if (dispatchBtn) {
        const [id, routeMode] = dispatchBtn.dataset.dispatch.split(":");
        const result = await api(`/api/orders/${id}/dispatch`, {
          method: "POST",
          body: JSON.stringify({ routeMode }),
        });
        alert(result.message);
        document.getElementById("track-id").value = id;
        const map = document.getElementById("track-map");
        if (result.map && result.map.mapEmbedUrl) {
          map.hidden = false;
          map.src = result.map.mapEmbedUrl;
        }
        await Promise.all([loadOrders(), loadAnalytics(), loadNotifications()]);
      }
      if (statusBtn) {
        const [id, status] = statusBtn.dataset.status.split(":");
        await api(`/api/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
        await Promise.all([loadOrders(), loadAnalytics()]);
      }
      if (emergencyBtn) {
        const orderId = emergencyBtn.dataset.emergency;
        await api(`/api/emergency/${orderId}`, {
          method: "POST",
          body: JSON.stringify({ type: "sos", description: "Reported from dashboard — opening police route" }),
        });
        sessionStorage.setItem("ft-emergency-order", orderId);
        location.hash = "emergency";
        await loadNotifications();
      }
    } catch (error) {
      alert(error.message);
    }
  });

  on("drivers-body", "click", async (event) => {
    const button = event.target.closest("[data-driver-status]");
    if (!button) return;
    const [id, status] = button.dataset.driverStatus.split(":");
    try {
      await api(`/api/drivers/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status, location: "Live update" }),
      });
      await loadDrivers();
    } catch (error) {
      alert(error.message);
    }
  });
});
