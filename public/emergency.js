const DEFAULT_ORIGIN = { lat: 28.6329, lng: 77.2195 };

const EmergencyMap = (() => {
  let origin = { ...DEFAULT_ORIGIN };
  let stations = [];
  let usingLiveGps = false;

  function setStatus(text) {
    const node = document.getElementById("emergency-status");
    if (node) node.textContent = text;
  }

  function renderNearest(payload) {
    const nearest = payload.nearest;
    document.getElementById("nearest-name").textContent = nearest.name;
    document.getElementById("nearest-address").textContent = nearest.address;
    document.getElementById("nearest-meta").textContent = `${nearest.distanceKm} km · about ${nearest.etaMinutes} min by road`;
    document.getElementById("nearest-phone").href = `tel:${nearest.phone}`;
    document.getElementById("nearest-phone").textContent = nearest.phone;
    document.getElementById("dial-112").href = "tel:112";
    document.getElementById("open-gmaps").href = payload.googleMapsUrl;
    document.getElementById("police-map").src = payload.mapEmbedUrl;

    const list = document.getElementById("station-list");
    list.innerHTML = payload.stations
      .map(
        (station, index) => `
        <button type="button" class="station-row ${index === 0 ? "active" : ""}" data-station-index="${index}">
          <strong>${station.name}</strong>
          <span>${station.distanceKm} km · ${station.etaMinutes} min</span>
          <small>${station.address}</small>
        </button>`
      )
      .join("");
  }

  async function loadRoute(lat, lng) {
    setStatus("Finding the latest driving path to the nearest police station…");
    const payload = await api(`/api/emergency/nearest-police?lat=${lat}&lng=${lng}`);
    stations = payload.stations;
    origin = payload.origin;
    const sourceLabel = payload.source === "google-places" ? "Google Places (live nearest)" : "Delhi NCR police directory";
    const gpsLabel = usingLiveGps ? "your live location" : "Connaught Place demo pin (allow location for live GPS)";
    setStatus(`${sourceLabel} from ${gpsLabel}. Path updates on Google Maps.`);
    renderNearest(payload);
    return payload;
  }

  async function selectStation(index) {
    const station = stations[index];
    if (!station) return;
    const payload = await api(
      `/api/emergency/route?lat=${origin.lat}&lng=${origin.lng}&destLat=${station.lat}&destLng=${station.lng}`
    );
    document.querySelectorAll(".station-row").forEach((row) => {
      row.classList.toggle("active", row.dataset.stationIndex === String(index));
    });
    document.getElementById("nearest-name").textContent = station.name;
    document.getElementById("nearest-address").textContent = station.address;
    document.getElementById("nearest-meta").textContent = `${station.distanceKm} km · about ${station.etaMinutes} min by road`;
    document.getElementById("nearest-phone").href = `tel:${station.phone}`;
    document.getElementById("nearest-phone").textContent = station.phone;
    document.getElementById("open-gmaps").href = payload.googleMapsUrl;
    document.getElementById("police-map").src = payload.mapEmbedUrl;
    setStatus(`Latest Google driving path to ${station.name}.`);
  }

  function locateAndRoute() {
    if (!navigator.geolocation) {
      usingLiveGps = false;
      return loadRoute(DEFAULT_ORIGIN.lat, DEFAULT_ORIGIN.lng);
    }
    setStatus("Asking for your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        usingLiveGps = true;
        loadRoute(position.coords.latitude, position.coords.longitude).catch((error) => {
          setStatus(error.message);
        });
      },
      () => {
        usingLiveGps = false;
        loadRoute(DEFAULT_ORIGIN.lat, DEFAULT_ORIGIN.lng).catch((error) => {
          setStatus(error.message);
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
    );
  }

  function bind() {
    const list = document.getElementById("station-list");
    if (!list || list.dataset.bound === "true") return;
    list.dataset.bound = "true";

    list.addEventListener("click", (event) => {
      const row = event.target.closest("[data-station-index]");
      if (!row) return;
      selectStation(Number(row.dataset.stationIndex)).catch((error) => setStatus(error.message));
    });

    document.getElementById("btn-refresh-police").addEventListener("click", () => {
      locateAndRoute();
    });

    document.getElementById("btn-sos-log").addEventListener("click", async () => {
      const nearestName = document.getElementById("nearest-name").textContent;
      const orderId = document.getElementById("sos-order-id").value;
      try {
        const result = await api("/api/emergency/sos", {
          method: "POST",
          body: JSON.stringify({
            lat: origin.lat,
            lng: origin.lng,
            stationName: nearestName,
            orderId: orderId || undefined,
            description: "Emergency map SOS",
          }),
        });
        setStatus(result.message);
        if (typeof loadNotifications === "function") await loadNotifications();
      } catch (error) {
        setStatus(error.message);
      }
    });
  }

  function init() {
    bind();
    const savedOrder = sessionStorage.getItem("ft-emergency-order");
    if (savedOrder) {
      document.getElementById("sos-order-id").value = savedOrder;
      sessionStorage.removeItem("ft-emergency-order");
    }
    locateAndRoute();
  }

  return { init };
})();

window.EmergencyMap = EmergencyMap;
