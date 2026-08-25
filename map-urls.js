function parseWaypoints(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function activeWaypoints(order) {
  const mode = order.dispatchRouteMode || order.routePreference || "fasttrack";
  if (mode === "customer") return parseWaypoints(order.customWaypoints);
  return [];
}

function googleDirectionsEmbed({ origin, destination, waypoints = [], apiKey }) {
  if (apiKey) {
    const params = new URLSearchParams({
      key: apiKey,
      origin,
      destination,
      mode: "driving",
    });
    if (waypoints.length) params.set("waypoints", waypoints.join("|"));
    return `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;
  }
  const destChain = [...waypoints, destination].join(" to:");
  return `https://www.google.com/maps?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destChain)}&hl=en&output=embed`;
}

function googleDirectionsApp({ origin, destination, waypoints = [] }) {
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function orderRouteMap(order, apiKey) {
  const mode = order.dispatchRouteMode || order.routePreference || "fasttrack";
  const waypoints = activeWaypoints(order);
  const origin = order.pickupAddress;
  const destination = order.deliveryAddress;
  return {
    mode,
    waypoints,
    mapEmbedUrl: googleDirectionsEmbed({ origin, destination, waypoints, apiKey }),
    googleMapsUrl: googleDirectionsApp({ origin, destination, waypoints }),
  };
}

module.exports = {
  parseWaypoints,
  activeWaypoints,
  googleDirectionsEmbed,
  googleDirectionsApp,
  orderRouteMap,
};
