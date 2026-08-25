const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AIDeliveryService = require('./ai-service');
const {
  nearestPoliceFromList,
  enrichStation,
  directionsEmbedUrl,
  googleMapsAppUrl,
} = require('./police-stations');
const { parseWaypoints, orderRouteMap } = require('./map-urls');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  });
}

loadEnvFile();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// Initialize AI Service
const aiService = new AIDeliveryService();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public folder

// In-memory data storage (simulates database)
let orders = [];
let drivers = [];
let notifications = [];
let analytics = {
    totalDeliveries: 0,
    averageDeliveryTime: 25,
    customerSatisfaction: 4.7,
    fuelSaved: 0
};
let orderIdCounter = 1;
let driverIdCounter = 1;

// Sample data for testing
orders.push(
  {
    id: 1,
    customerName: "Rajesh Kumar",
    customerPhone: "+91-98765-43210",
    customerEmail: "rajesh.kumar@gmail.com",
    pickupAddress: "Shop No. 15, Connaught Place, New Delhi",
    deliveryAddress: "B-42, Lajpat Nagar, New Delhi",
    status: "pending",
    priority: "high",
    orderValue: 1299.50,
    routePreference: "fasttrack",
    customWaypoints: [],
    dispatchRouteMode: null,
    createdAt: new Date().toISOString(),
    assignedDriver: null
  },
  {
    id: 2,
    customerName: "Priya Sharma", 
    customerPhone: "+91-87654-32109",
    customerEmail: "priya.sharma@yahoo.com",
    pickupAddress: "MG Road, Sector 14, Gurgaon",
    deliveryAddress: "DLF Phase 2, Gurgaon, Haryana",
    status: "pending",
    priority: "medium",
    orderValue: 850.75,
    routePreference: "customer",
    customWaypoints: ["India Gate, New Delhi", "AIIMS Flyover, New Delhi"],
    dispatchRouteMode: null,
    createdAt: new Date().toISOString(),
    assignedDriver: null
  }
);

// Sample drivers
drivers.push(
  {
    id: 1,
    name: "Amit Singh",
    phone: "+91-99999-11111",
    email: "amit.singh@fastdelivery.in",
    vehicleType: "Tempo",
    licensePlate: "DL-8C-1234",
    status: "available",
    currentLocation: "Karol Bagh Warehouse",
    rating: 4.8,
    totalDeliveries: 156,
    joinedDate: "2023-01-15"
  },
  {
    id: 2,
    name: "Sunita Devi",
    phone: "+91-88888-22222", 
    email: "sunita.devi@fastdelivery.in",
    vehicleType: "Scooty",
    licensePlate: "DL-9S-5678",
    status: "busy",
    currentLocation: "Connaught Place",
    rating: 4.9,
    totalDeliveries: 203,
    joinedDate: "2022-11-20"
  }
);

orderIdCounter = 3;
driverIdCounter = 3;

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Smart Delivery API is running',
    timestamp: new Date().toISOString()
  });
});

// Get all orders
app.get('/api/orders', (req, res) => {
  res.json({
    success: true,
    data: orders,
    count: orders.length
  });
});

// Create new order
app.post('/api/orders', (req, res) => {
  const { 
    customerName, 
    customerPhone, 
    customerEmail, 
    pickupAddress, 
    deliveryAddress, 
    priority = 'medium',
    orderValue = 0,
    routePreference = 'fasttrack',
    customWaypoints = ''
  } = req.body;
  
  // Basic validation
  if (!customerName || !pickupAddress || !deliveryAddress) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: customerName, pickupAddress, deliveryAddress'
    });
  }

  const preference = routePreference === 'customer' ? 'customer' : 'fasttrack';
  const waypoints = parseWaypoints(customWaypoints);
  if (preference === 'customer' && waypoints.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Customer safety route needs at least one via-point (main roads you trust).'
    });
  }

  const newOrder = {
    id: orderIdCounter++,
    customerName,
    customerPhone: customerPhone || 'Not provided',
    customerEmail: customerEmail || 'Not provided',
    pickupAddress,
    deliveryAddress,
    priority,
    orderValue: parseFloat(orderValue) || 0,
    routePreference: preference,
    customWaypoints: waypoints,
    dispatchRouteMode: null,
    status: 'pending',
    assignedDriver: null,
    createdAt: new Date().toISOString(),
    estimatedDelivery: new Date(Date.now() + 30 * 60000).toISOString() // 30 mins from now
  };

  orders.push(newOrder);
  
  // Auto-assign driver if available
  const availableDriver = drivers.find(d => d.status === 'available');
  if (availableDriver) {
    newOrder.assignedDriver = availableDriver.id;
    availableDriver.status = 'assigned';
    
    // Create notification
    notifications.push({
      id: Date.now(),
      type: 'driver_assigned',
      message: `Order #${newOrder.id} assigned to ${availableDriver.name}`,
      timestamp: new Date().toISOString()
    });
  }
  
  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: newOrder,
    driverAssigned: !!availableDriver
  });
});

// Get AI-powered optimized route
app.get('/api/route/optimize', (req, res) => {
  if (orders.length === 0) {
    return res.json({
      success: true,
      message: 'No orders to optimize',
      route: [],
      insights: ['No orders available for optimization']
    });
  }

  const pendingOrders = orders.filter(order => order.status === 'pending');
  
  if (pendingOrders.length === 0) {
    return res.json({
      success: true,
      message: 'No pending orders to optimize',
      route: [],
      insights: ['All orders are already processed']
    });
  }

  const aiOrders = pendingOrders.filter((order) => order.routePreference !== 'customer');
  const safetyOrders = pendingOrders.filter((order) => order.routePreference === 'customer');

  const aiResult = aiOrders.length
    ? aiService.optimizeRouteWithAI(aiOrders, {
        startLocation: "Distribution Center",
        currentTime: new Date()
      })
    : {
        algorithm: 'none',
        conditions: {},
        insights: [],
        totalStops: 0,
        estimatedTotalTime: '0 mins',
        route: [],
      };

  const lockedRoutes = safetyOrders.map((order, index) => ({
    stopNumber: index + 1,
    orderId: order.id,
    customerName: order.customerName,
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    waypoints: order.customWaypoints,
    routeLocked: true,
    reason: 'Customer safety path — not rewritten by AI',
  }));

  res.json({
    success: true,
    message: `Route optimized using AI algorithm: ${aiResult.algorithm || 'none'}`,
    algorithm: aiResult.algorithm,
    conditions: aiResult.conditions,
    insights: [
      ...(aiResult.insights || []),
      safetyOrders.length
        ? `🔒 ${safetyOrders.length} order(s) stay on the customer’s own safety route`
        : 'All pending orders can use FastTrack’s own route',
    ],
    totalStops: (aiResult.totalStops || 0) + lockedRoutes.length,
    estimatedTotalTime: aiResult.estimatedTotalTime,
    route: aiResult.route,
    customerSafetyRoutes: lockedRoutes,
    aiPowered: true,
    timestamp: new Date().toISOString()
  });
});

// Update order status
app.put('/api/orders/:id/status', (req, res) => {
  const orderId = parseInt(req.params.id);
  const { status } = req.body;
  
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  order.status = status;
  
  res.json({
    success: true,
    message: 'Order status updated',
    data: order
  });
});

app.post('/api/orders/:id/dispatch', (req, res) => {
  const orderId = parseInt(req.params.id);
  const { routeMode } = req.body || {};
  const order = orders.find((item) => item.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const mode = routeMode === 'customer' ? 'customer' : 'fasttrack';
  if (mode === 'customer' && parseWaypoints(order.customWaypoints).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'This order has no customer safety waypoints. Ask the customer to set their own route first.',
    });
  }

  order.dispatchRouteMode = mode;
  order.status = 'out-for-delivery';
  const map = orderRouteMap(order, process.env.GOOGLE_MAPS_API_KEY);
  notifications.push({
    id: Date.now(),
    type: 'dispatch',
    message: `Order #${order.id} dispatched on ${mode === 'customer' ? 'customer safety route' : 'FastTrack own route'}`,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: mode === 'customer'
      ? 'Dispatched on the customer’s own safety route. Driver must follow the via-points.'
      : 'Dispatched on FastTrack’s own AI route.',
    data: order,
    map,
  });
});

app.put('/api/orders/:id/route', (req, res) => {
  const orderId = parseInt(req.params.id);
  const order = orders.find((item) => item.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  const preference = req.body.routePreference === 'customer' ? 'customer' : 'fasttrack';
  const waypoints = parseWaypoints(req.body.customWaypoints);
  if (preference === 'customer' && waypoints.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Add at least one via-point for the customer safety route.',
    });
  }
  order.routePreference = preference;
  order.customWaypoints = waypoints;
  res.json({ success: true, message: 'Route preference saved', data: order });
});

app.get('/api/orders/:id/route-map', (req, res) => {
  const orderId = parseInt(req.params.id);
  const order = orders.find((item) => item.id === orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  res.json({
    success: true,
    preference: order.routePreference,
    dispatchRouteMode: order.dispatchRouteMode,
    map: orderRouteMap(order, process.env.GOOGLE_MAPS_API_KEY),
  });
});

// AI-powered order analysis
app.get('/api/ai/analyze', (req, res) => {
  const analysis = {
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    completedOrders: orders.filter(o => o.status === 'completed').length,
    aiInsights: [],
    predictions: {},
    recommendations: []
  };

  // AI Analysis
  if (analysis.pendingOrders > 5) {
    analysis.aiInsights.push("🚨 High order volume detected - consider additional drivers");
  }
  
  if (analysis.pendingOrders === 0) {
    analysis.aiInsights.push("✅ All orders processed - system running efficiently");
  }

  // Delivery time predictions
  const currentHour = new Date().getHours();
  let trafficMultiplier = 1.0;
  
  if (currentHour >= 7 && currentHour <= 9) {
    trafficMultiplier = 1.3;
    analysis.aiInsights.push("🚦 Morning rush hour - expect 30% longer delivery times");
  } else if (currentHour >= 17 && currentHour <= 19) {
    trafficMultiplier = 1.5;
    analysis.aiInsights.push("🚦 Evening rush hour - expect 50% longer delivery times");
  }

  analysis.predictions = {
    averageDeliveryTime: Math.round(25 * trafficMultiplier),
    optimalDeliveryWindow: currentHour < 16 ? "2:00 PM - 4:00 PM" : "10:00 AM - 12:00 PM (next day)",
    trafficImpact: `${Math.round((trafficMultiplier - 1) * 100)}%`
  };

  // AI Recommendations
  if (analysis.pendingOrders > 3) {
    analysis.recommendations.push("Consider batching nearby deliveries for efficiency");
  }
  
  analysis.recommendations.push("Use AI route optimization for best results");
  analysis.recommendations.push("Monitor real-time traffic conditions");

  res.json({
    success: true,
    analysis,
    aiPowered: true,
    timestamp: new Date().toISOString()
  });
});

// AI-powered delivery predictions for specific order
app.get('/api/ai/predict/:orderId', (req, res) => {
  const orderId = parseInt(req.params.orderId);
  const order = orders.find(o => o.id === orderId);
  
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  // AI prediction for this specific order
  const prediction = {
    orderId: order.id,
    customerName: order.customerName,
    estimatedDeliveryTime: "25-35 minutes",
    confidence: "87%",
    factors: [
      "Current traffic conditions",
      "Historical delivery data",
      "Weather conditions",
      "Driver availability"
    ],
    recommendations: [
      "Optimal delivery window identified",
      "Route optimized for efficiency"
    ],
    riskFactors: []
  };

  // Add risk factors based on conditions
  const currentHour = new Date().getHours();
  if (currentHour >= 17 && currentHour <= 19) {
    prediction.riskFactors.push("Peak traffic hours may cause delays");
  }

  res.json({
    success: true,
    prediction,
    aiPowered: true,
    timestamp: new Date().toISOString()
  });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Driver Management Endpoints

// Get all drivers
app.get('/api/drivers', (req, res) => {
  res.json({
    success: true,
    data: drivers,
    count: drivers.length
  });
});

// Create new driver
app.post('/api/drivers', (req, res) => {
  const { name, phone, email, vehicleType, licensePlate } = req.body;
  
  if (!name || !phone || !vehicleType) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: name, phone, vehicleType'
    });
  }

  const newDriver = {
    id: driverIdCounter++,
    name,
    phone,
    email: email || 'Not provided',
    vehicleType,
    licensePlate: licensePlate || 'Not provided',
    status: 'available',
    currentLocation: 'Warehouse',
    rating: 5.0,
    totalDeliveries: 0,
    joinedDate: new Date().toISOString()
  };

  drivers.push(newDriver);
  
  res.status(201).json({
    success: true,
    message: 'Driver added successfully',
    data: newDriver
  });
});

// Update driver status
app.put('/api/drivers/:id/status', (req, res) => {
  const driverId = parseInt(req.params.id);
  const { status, location } = req.body;
  
  const driver = drivers.find(d => d.id === driverId);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found'
    });
  }

  driver.status = status;
  if (location) driver.currentLocation = location;
  
  res.json({
    success: true,
    message: 'Driver status updated',
    data: driver
  });
});

// Notification Endpoints

// Send notification to customer
app.post('/api/notify/:orderId', (req, res) => {
  const orderId = parseInt(req.params.orderId);
  const order = orders.find(o => o.id === orderId);
  
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  const notification = {
    id: Date.now(),
    orderId: order.id,
    customerName: order.customerName,
    type: 'customer_notification',
    message: `Your order #${order.id} is being processed. Estimated delivery: ${new Date(order.estimatedDelivery).toLocaleTimeString()}`,
    timestamp: new Date().toISOString(),
    sent: true
  };

  notifications.push(notification);
  
  res.json({
    success: true,
    message: 'Customer notified successfully',
    notification
  });
});

// Get all notifications
app.get('/api/notifications', (req, res) => {
  res.json({
    success: true,
    data: notifications.slice(-20), // Last 20 notifications
    count: notifications.length
  });
});

// Analytics Endpoints

// Get comprehensive analytics
app.get('/api/analytics', (req, res) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const todayOrders = orders.filter(o => new Date(o.createdAt) >= today);
  const completedOrders = orders.filter(o => o.status === 'completed');
  const pendingOrders = orders.filter(o => o.status === 'pending');
  
  const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.orderValue || 0), 0);
  const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
  
  const analyticsData = {
    overview: {
      totalOrders: orders.length,
      todayOrders: todayOrders.length,
      completedOrders: completedOrders.length,
      pendingOrders: pendingOrders.length,
      totalRevenue: totalRevenue.toFixed(2),
      avgOrderValue: avgOrderValue.toFixed(2)
    },
    drivers: {
      totalDrivers: drivers.length,
      availableDrivers: drivers.filter(d => d.status === 'available').length,
      busyDrivers: drivers.filter(d => d.status === 'busy').length,
      avgRating: drivers.reduce((sum, d) => sum + d.rating, 0) / drivers.length
    },
    performance: {
      avgDeliveryTime: analytics.averageDeliveryTime,
      customerSatisfaction: analytics.customerSatisfaction,
      onTimeDeliveryRate: '94%',
      fuelEfficiency: '15% improvement'
    },
    trends: {
      peakHours: ['11:00-13:00', '18:00-20:00'],
      popularAreas: ['Connaught Place', 'Gurgaon Cyber City', 'Noida Sector 62'],
      growthRate: '+23% this month'
    }
  };

  res.json({
    success: true,
    data: analyticsData,
    timestamp: new Date().toISOString()
  });
});

// Real-time tracking simulation
app.get('/api/track/:orderId', (req, res) => {
  const orderId = parseInt(req.params.orderId);
  const order = orders.find(o => o.id === orderId);
  
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  const driver = drivers.find(d => d.id === order.assignedDriver);
  
  const map = orderRouteMap(order, process.env.GOOGLE_MAPS_API_KEY);
  const trackingData = {
    orderId: order.id,
    status: order.status,
    routePreference: order.routePreference,
    dispatchRouteMode: order.dispatchRouteMode,
    customWaypoints: order.customWaypoints || [],
    activeRoute: map.mode === 'customer' ? 'Customer safety route' : 'FastTrack own route',
    map,
    currentLocation: driver ? driver.currentLocation : 'Warehouse',
    estimatedArrival: order.estimatedDelivery,
    driver: driver ? {
      name: driver.name,
      phone: driver.phone,
      vehicle: driver.vehicleType,
      rating: driver.rating
    } : null,
    timeline: [
      { time: order.createdAt, event: 'Order placed', completed: true },
      { time: new Date().toISOString(), event: 'Order confirmed', completed: true },
      { time: null, event: 'Out for delivery', completed: false },
      { time: null, event: 'Delivered', completed: false }
    ]
  };

  res.json({
    success: true,
    data: trackingData,
    timestamp: new Date().toISOString()
  });
});

// Bulk operations
app.post('/api/orders/bulk-assign', (req, res) => {
  const { driverId, orderIds } = req.body;
  
  const driver = drivers.find(d => d.id === driverId);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found'
    });
  }

  const assignedOrders = [];
  orderIds.forEach(orderId => {
    const order = orders.find(o => o.id === orderId);
    if (order && order.status === 'pending') {
      order.assignedDriver = driverId;
      assignedOrders.push(order);
    }
  });

  driver.status = 'assigned';

  res.json({
    success: true,
    message: `${assignedOrders.length} orders assigned to ${driver.name}`,
    assignedOrders
  });
});

function parseCoord(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function googleNearbyPolice(lat, lng) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
    params: {
      location: `${lat},${lng}`,
      rankby: 'distance',
      type: 'police',
      key,
    },
    timeout: 8000,
  });
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return null;
  }
  const origin = { lat, lng };
  return (data.results || []).slice(0, 8).map((place, index) => {
    const location = place.geometry && place.geometry.location;
    if (!location) return null;
    return enrichStation(origin, {
      id: place.place_id || `google-${index}`,
      name: place.name,
      address: place.vicinity || "Listed on Google Maps",
      phone: "112",
      lat: location.lat,
      lng: location.lng,
      source: "google-places",
    });
  }).filter(Boolean);
}

app.get('/api/maps/config', (_req, res) => {
  res.json({
    success: true,
    googleMapsEnabled: Boolean(process.env.GOOGLE_MAPS_API_KEY),
  });
});

app.get('/api/emergency/nearest-police', async (req, res) => {
  const lat = parseCoord(req.query.lat);
  const lng = parseCoord(req.query.lng);
  if (lat === null || lng === null) {
    return res.status(400).json({
      success: false,
      message: 'lat and lng query parameters are required',
    });
  }

  const origin = { lat, lng };
  let stations = nearestPoliceFromList(lat, lng);
  let source = 'ncr-directory';

  try {
    const live = await googleNearbyPolice(lat, lng);
    if (live && live.length) {
      stations = live;
      source = 'google-places';
    }
  } catch (_error) {
    source = 'ncr-directory';
  }

  const nearest = stations[0];
  res.json({
    success: true,
    source,
    origin,
    nearest,
    stations,
    mapEmbedUrl: directionsEmbedUrl(origin, nearest, process.env.GOOGLE_MAPS_API_KEY),
    googleMapsUrl: googleMapsAppUrl(origin, nearest),
    emergencyNumbers: { national: '112', police: '100' },
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/emergency/sos', (req, res) => {
  const { lat, lng, stationName, orderId, description } = req.body || {};
  notifications.push({
    id: Date.now(),
    type: 'emergency',
    message: `SOS: nearest police ${stationName || 'route requested'} at ${lat || '?'}, ${lng || '?'}${orderId ? ` (order #${orderId})` : ''}`,
    timestamp: new Date().toISOString(),
  });
  res.json({
    success: true,
    message: 'SOS logged. Follow the Google Map path to the nearest police station, and dial 112.',
    description: description || 'Rider / operator SOS',
  });
});

app.get('/api/emergency/route', (req, res) => {
  const lat = parseCoord(req.query.lat);
  const lng = parseCoord(req.query.lng);
  const destLat = parseCoord(req.query.destLat);
  const destLng = parseCoord(req.query.destLng);
  if (lat === null || lng === null || destLat === null || destLng === null) {
    return res.status(400).json({ success: false, message: 'origin and destination coordinates required' });
  }
  const origin = { lat, lng };
  const destination = { lat: destLat, lng: destLng };
  res.json({
    success: true,
    mapEmbedUrl: directionsEmbedUrl(origin, destination, process.env.GOOGLE_MAPS_API_KEY),
    googleMapsUrl: googleMapsAppUrl(origin, destination),
  });
});

// Emergency endpoints
app.post('/api/emergency/:orderId', (req, res) => {
  const orderId = parseInt(req.params.orderId);
  const { type, description } = req.body;
  
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  const emergency = {
    id: Date.now(),
    orderId,
    type,
    description,
    timestamp: new Date().toISOString(),
    resolved: false
  };

  notifications.push({
    id: Date.now(),
    type: 'emergency',
    message: `Emergency reported for Order #${orderId}: ${type}`,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Emergency reported successfully',
    emergency
  });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🚚 Smart Delivery API running on http://localhost:${PORT}`);
  console.log(`📱 Open http://localhost:${PORT} in your browser (not the HTML file on disk)`);
  console.log(`🔧 API endpoints available at http://localhost:${PORT}/api/`);
});

module.exports = app;