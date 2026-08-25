function toRad(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const POLICE_STATIONS = [
  { id: "cp", name: "Connaught Place Police Station", address: "Connaught Place, New Delhi", phone: "011-23490000", lat: 28.6329, lng: 77.2195 },
  { id: "karol", name: "Karol Bagh Police Station", address: "Ajmal Khan Road, Karol Bagh, Delhi", phone: "011-25721700", lat: 28.6518, lng: 77.1907 },
  { id: "paharganj", name: "Paharganj Police Station", address: "Paharganj, New Delhi", phone: "011-23582631", lat: 28.6448, lng: 77.2167 },
  { id: "lajpat", name: "Lajpat Nagar Police Station", address: "Lajpat Nagar, New Delhi", phone: "011-29814500", lat: 28.5691, lng: 77.2432 },
  { id: "defence", name: "Defence Colony Police Station", address: "Defence Colony, New Delhi", phone: "011-24617204", lat: 28.5729, lng: 77.2326 },
  { id: "hauz", name: "Hauz Khas Police Station", address: "Hauz Khas, New Delhi", phone: "011-26868689", lat: 28.5494, lng: 77.2001 },
  { id: "dwarka", name: "Dwarka North Police Station", address: "Dwarka, New Delhi", phone: "011-25087500", lat: 28.5921, lng: 77.046 },
  { id: "rohini", name: "Rohini Police Station", address: "Rohini, Delhi", phone: "011-27562828", lat: 28.7383, lng: 77.0822 },
  { id: "noida20", name: "Noida Sector 20 Police Station", address: "Sector 20, Noida, Uttar Pradesh", phone: "0120-2535353", lat: 28.58, lng: 77.326 },
  { id: "noida58", name: "Noida Sector 58 Police Station", address: "Sector 58, Noida, Uttar Pradesh", phone: "0120-2585858", lat: 28.606, lng: 77.362 },
  { id: "gurgaon", name: "Gurugram Sadar Police Station", address: "Civil Lines, Gurugram, Haryana", phone: "0124-2322626", lat: 28.4595, lng: 77.0266 },
  { id: "dlf", name: "DLF Phase 2 Police Post", address: "DLF Phase 2, Gurugram, Haryana", phone: "0124-2561000", lat: 28.4946, lng: 77.0888 },
  { id: "cyber", name: "Sector 29 / Cyber City Police Post", address: "Sector 29, Gurugram, Haryana", phone: "0124-2570001", lat: 28.47, lng: 77.07 },
];

function enrichStation(origin, station) {
  const distanceKm = haversineKm(origin, station);
  const etaMinutes = Math.max(4, Math.round((distanceKm / 28) * 60));
  return { ...station, distanceKm: Number(distanceKm.toFixed(2)), etaMinutes };
}

function nearestPoliceFromList(lat, lng, limit = 6) {
  const origin = { lat, lng };
  return POLICE_STATIONS.map((station) => enrichStation(origin, station))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

function directionsEmbedUrl(origin, destination, apiKey) {
  const originStr = `${origin.lat},${origin.lng}`;
  const destStr = `${destination.lat},${destination.lng}`;
  if (apiKey) {
    const params = new URLSearchParams({
      key: apiKey,
      origin: originStr,
      destination: destStr,
      mode: "driving",
    });
    return `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;
  }
  return `https://www.google.com/maps?saddr=${originStr}&daddr=${destStr}&hl=en&z=14&output=embed`;
}

function googleMapsAppUrl(origin, destination) {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
}

module.exports = {
  POLICE_STATIONS,
  haversineKm,
  nearestPoliceFromList,
  enrichStation,
  directionsEmbedUrl,
  googleMapsAppUrl,
};
