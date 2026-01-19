const express = require('express');
const cors = require('cors');
const path = require('path');
const AIDeliveryService = require('./ai-service');

const app = express();
const PORT = 3000;

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
    orderValue = 0
  } = req.body;
  
  // Basic validation
  if (!customerName || !pickupAddress || !deliveryAddress) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: customerName, pickupAddress, deliveryAddress'
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

  // Use AI service for route optimization
  const aiResult = aiService.optimizeRouteWithAI(pendingOrders, {
    startLocation: "Distribution Center",
    currentTime: new Date()
  });

  res.json({
    success: true,
    message: `Route optimized using AI algorithm: ${aiResult.algorithm}`,
    algorithm: aiResult.algorithm,
    conditions: aiResult.conditions,
    insights: aiResult.insights,
    totalStops: aiResult.totalStops,
    estimatedTotalTime: aiResult.estimatedTotalTime,
    route: aiResult.route,
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
  
  const trackingData = {
    orderId: order.id,
    status: order.status,
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
app.listen(PORT, () => {
  console.log(`🚚 Smart Delivery API running on http://localhost:${PORT}`);
  console.log(`📱 Open http://localhost:${PORT} to view the app`);
  console.log(`🔧 API endpoints available at http://localhost:${PORT}/api/`);
});

module.exports = app;