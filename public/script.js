const api = (path, options = {}) =>
  fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  });

function showPage(name) {
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
    .map(
      (order) => `
      <tr>
        <td>${order.id}</td>
        <td>${order.customerName}<br><small>${order.customerPhone}</small></td>
        <td>${order.pickupAddress}<br>→ ${order.deliveryAddress}</td>
        <td>${order.priority}</td>
        <td>₹${Number(order.orderValue || 0).toFixed(2)}</td>
        <td>${order.status}</td>
        <td>
          <button class="btn" data-status="${order.id}:out-for-delivery">Out</button>
          <button class="btn" data-status="${order.id}:completed">Done</button>
          <button class="btn danger" data-emergency="${order.id}">SOS</button>
        </td>
      </tr>`
    )
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

window.addEventListener("hashchange", () => {
  const page = (location.hash || "#home").slice(1) || "home";
  showPage(page);
});

function bindTilt(card) {
  if (card.dataset.tiltBound === "true") return;
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
  const stage = document.getElementById("hero-stage");
  const inner = document.getElementById("stage-inner");
  if (stage && inner && stage.dataset.tiltBound !== "true" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    stage.dataset.tiltBound = "true";
    stage.addEventListener("mousemove", (event) => {
      const bounds = stage.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      inner.style.transform = `rotateY(${x * 28}deg) rotateX(${y * -16}deg)`;
    });
    stage.addEventListener("mouseleave", () => {
      inner.style.transform = "rotateY(0deg) rotateX(0deg)";
    });
  }

  document.querySelectorAll(".tilt-card").forEach(bindTilt);
}

document.addEventListener("DOMContentLoaded", async () => {
  showPage((location.hash || "#home").slice(1) || "home");
  setup3dEffects();
  await Promise.all([loadAnalytics(), loadOrders(), loadDrivers(), loadNotifications()]);

  document.getElementById("btn-analyze").addEventListener("click", async () => {
    const out = document.getElementById("ai-analysis");
    try {
      out.textContent = formatJson(await api("/api/ai/analyze"));
    } catch (error) {
      out.textContent = error.message;
    }
  });

  document.getElementById("btn-optimize").addEventListener("click", async () => {
    const out = document.getElementById("route-output");
    try {
      out.textContent = formatJson(await api("/api/route/optimize"));
    } catch (error) {
      out.textContent = error.message;
    }
  });

  document.getElementById("order-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const payload = Object.fromEntries(new FormData(form).entries());
    const msg = document.getElementById("order-msg");
    try {
      const result = await api("/api/orders", { method: "POST", body: JSON.stringify(payload) });
      msg.textContent = result.message;
      form.reset();
      await Promise.all([loadOrders(), loadAnalytics(), loadDrivers(), loadNotifications()]);
    } catch (error) {
      msg.textContent = error.message;
    }
  });

  document.getElementById("driver-form").addEventListener("submit", async (event) => {
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

  document.getElementById("btn-refresh-orders").addEventListener("click", loadOrders);
  document.getElementById("btn-refresh-drivers").addEventListener("click", loadDrivers);

  document.getElementById("btn-track").addEventListener("click", async () => {
    const id = document.getElementById("track-id").value;
    const out = document.getElementById("track-output");
    try {
      out.textContent = formatJson(await api(`/api/track/${id}`));
    } catch (error) {
      out.textContent = error.message;
    }
  });

  document.getElementById("btn-predict").addEventListener("click", async () => {
    const id = document.getElementById("track-id").value;
    const out = document.getElementById("track-output");
    try {
      out.textContent = formatJson(await api(`/api/ai/predict/${id}`));
    } catch (error) {
      out.textContent = error.message;
    }
  });

  document.getElementById("btn-notify").addEventListener("click", async () => {
    const id = document.getElementById("track-id").value;
    const out = document.getElementById("track-output");
    try {
      out.textContent = formatJson(await api(`/api/notify/${id}`, { method: "POST", body: "{}" }));
      await loadNotifications();
    } catch (error) {
      out.textContent = error.message;
    }
  });

  document.getElementById("btn-bulk").addEventListener("click", async () => {
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

  document.getElementById("orders-body").addEventListener("click", async (event) => {
    const statusBtn = event.target.closest("[data-status]");
    const emergencyBtn = event.target.closest("[data-emergency]");
    try {
      if (statusBtn) {
        const [id, status] = statusBtn.dataset.status.split(":");
        await api(`/api/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
        await Promise.all([loadOrders(), loadAnalytics()]);
      }
      if (emergencyBtn) {
        const orderId = emergencyBtn.dataset.emergency;
        await api(`/api/emergency/${orderId}`, {
          method: "POST",
          body: JSON.stringify({ type: "delay", description: "Reported from dashboard" }),
        });
        await loadNotifications();
      }
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById("drivers-body").addEventListener("click", async (event) => {
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
