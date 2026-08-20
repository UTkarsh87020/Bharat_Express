// AI Service for Smart Delivery App
// This module provides AI-powered features for route optimization and delivery predictions

class AIDeliveryService {
    constructor() {
        this.trafficPatterns = {
            'morning': { multiplier: 1.3, description: 'Heavy morning traffic' },
            'afternoon': { multiplier: 1.1, description: 'Moderate traffic' },
            'evening': { multiplier: 1.5, description: 'Peak evening traffic' },
            'night': { multiplier: 0.8, description: 'Light traffic' }
        };
        
        this.weatherImpact = {
            'sunny': { multiplier: 1.0, description: 'Perfect delivery conditions' },
            'rainy': { multiplier: 1.4, description: 'Slower due to rain' },
            'snowy': { multiplier: 1.8, description: 'Significant delays expected' },
            'cloudy': { multiplier: 1.1, description: 'Slightly slower conditions' }
        };
    }

    // AI-powered route optimization using multiple algorithms
    optimizeRouteWithAI(orders, options = {}) {
        const { startLocation = "Warehouse", currentTime = new Date() } = options;
        
        if (!orders || orders.length === 0) {
            return {
                success: true,
                route: [],
                insights: "No orders to optimize",
                algorithm: "none"
            };
        }

        // Get current conditions
        const timeOfDay = this.getTimeOfDay(currentTime);
        const weather = this.simulateWeather();
        const trafficCondition = this.trafficPatterns[timeOfDay];
        const weatherCondition = this.weatherImpact[weather];

        // AI Algorithm Selection based on conditions
        let algorithm = this.selectOptimalAlgorithm(orders.length, timeOfDay, weather);
        let optimizedRoute;

        switch (algorithm) {
            case 'nearest-neighbor':
                optimizedRoute = this.nearestNeighborOptimization(orders, startLocation);
                break;
            case 'time-window':
                optimizedRoute = this.timeWindowOptimization(orders, currentTime);
                break;
            case 'cluster-first':
                optimizedRoute = this.clusterFirstOptimization(orders);
                break;
            default:
                optimizedRoute = this.hybridOptimization(orders, startLocation, currentTime);
        }

        // Apply AI predictions for delivery times
        const routeWithPredictions = this.applyAIPredictions(
            optimizedRoute, 
            trafficCondition, 
            weatherCondition,
            currentTime
        );

        return {
            success: true,
            route: routeWithPredictions,
            algorithm: algorithm,
            conditions: {
                timeOfDay,
                weather,
                trafficMultiplier: trafficCondition.multiplier,
                weatherMultiplier: weatherCondition.multiplier
            },
            insights: this.generateAIInsights(routeWithPredictions, trafficCondition, weatherCondition),
            totalStops: routeWithPredictions.length,
            estimatedTotalTime: this.calculateTotalTime(routeWithPredictions)
        };
    }

    // AI algorithm selection based on current conditions
    selectOptimalAlgorithm(orderCount, timeOfDay, weather) {
        if (orderCount <= 3) return 'nearest-neighbor';
        if (timeOfDay === 'morning' || timeOfDay === 'evening') return 'time-window';
        if (weather === 'rainy' || weather === 'snowy') return 'cluster-first';
        return 'hybrid';
    }

    // Nearest Neighbor Algorithm with AI enhancements
    nearestNeighborOptimization(orders, startLocation) {
        const route = [];
        const unvisited = [...orders];
        let currentLocation = startLocation;
        let stopNumber = 1;

        while (unvisited.length > 0) {
            const nearest = this.findNearestOrder(currentLocation, unvisited);
            const order = unvisited.splice(nearest.index, 1)[0];
            
            route.push({
                stopNumber: stopNumber++,
                orderId: order.id,
                customerName: order.customerName,
                pickupAddress: order.pickupAddress,
                deliveryAddress: order.deliveryAddress,
                distance: nearest.distance,
                priority: this.calculatePriority(order)
            });
            
            currentLocation = order.deliveryAddress;
        }

        return route;
    }

    // Time Window Optimization for peak hours
    timeWindowOptimization(orders, currentTime) {
        const route = [];
        const sortedOrders = orders
            .map(order => ({
                ...order,
                urgency: this.calculateUrgency(order, currentTime),
                timeWindow: this.getOptimalTimeWindow(order)
            }))
            .sort((a, b) => b.urgency - a.urgency);

        sortedOrders.forEach((order, index) => {
            route.push({
                stopNumber: index + 1,
                orderId: order.id,
                customerName: order.customerName,
                pickupAddress: order.pickupAddress,
                deliveryAddress: order.deliveryAddress,
                urgency: order.urgency,
                timeWindow: order.timeWindow,
                priority: this.calculatePriority(order)
            });
        });

        return route;
    }

    // Cluster-First Algorithm for bad weather
    clusterFirstOptimization(orders) {
        const clusters = this.createGeographicClusters(orders);
        const route = [];
        let stopNumber = 1;

        clusters.forEach(cluster => {
            const clusterRoute = this.nearestNeighborOptimization(cluster.orders, cluster.center);
            clusterRoute.forEach(stop => {
                route.push({
                    ...stop,
                    stopNumber: stopNumber++,
                    cluster: cluster.name
                });
            });
        });

        return route;
    }

    // Hybrid AI Algorithm combining multiple approaches
    hybridOptimization(orders, startLocation, currentTime) {
        // Phase 1: Cluster by geographic proximity
        const clusters = this.createGeographicClusters(orders);
        
        // Phase 2: Optimize within clusters using time windows
        const route = [];
        let stopNumber = 1;

        clusters.forEach(cluster => {
            const timeOptimized = this.timeWindowOptimization(cluster.orders, currentTime);
            timeOptimized.forEach(stop => {
                route.push({
                    ...stop,
                    stopNumber: stopNumber++,
                    cluster: cluster.name,
                    optimizationPhase: 'hybrid'
                });
            });
        });

        return route;
    }

    // Apply AI predictions for delivery times and conditions
    applyAIPredictions(route, trafficCondition, weatherCondition, currentTime) {
        let cumulativeTime = 0;
        
        return route.map((stop, index) => {
            const baseTime = 15; // Base delivery time in minutes
            const travelTime = (stop.distance || 2) * 3; // 3 minutes per km
            
            // AI-enhanced time prediction
            const adjustedTime = Math.round(
                (baseTime + travelTime) * 
                trafficCondition.multiplier * 
                weatherCondition.multiplier
            );
            
            cumulativeTime += adjustedTime;
            
            const estimatedArrival = new Date(currentTime.getTime() + cumulativeTime * 60000);
            
            return {
                ...stop,
                estimatedTime: `${adjustedTime} mins`,
                cumulativeTime: `${cumulativeTime} mins`,
                estimatedArrival: estimatedArrival.toLocaleTimeString(),
                aiConfidence: this.calculateConfidence(stop, trafficCondition, weatherCondition),
                recommendations: this.generateStopRecommendations(stop, trafficCondition, weatherCondition)
            };
        });
    }

    // Generate AI insights for the route
    generateAIInsights(route, trafficCondition, weatherCondition) {
        const insights = [];
        
        insights.push(`🤖 AI selected optimal algorithm based on current conditions`);
        insights.push(`🚦 ${trafficCondition.description} - ${Math.round((trafficCondition.multiplier - 1) * 100)}% time adjustment`);
        insights.push(`🌤️ ${weatherCondition.description} - ${Math.round((weatherCondition.multiplier - 1) * 100)}% weather impact`);
        
        if (route.length > 5) {
            insights.push(`📊 Large route detected - using cluster optimization for efficiency`);
        }
        
        const avgConfidence = route.reduce((sum, stop) => sum + stop.aiConfidence, 0) / route.length;
        insights.push(`🎯 Average AI prediction confidence: ${Math.round(avgConfidence)}%`);
        
        return insights;
    }

    // Helper methods for AI calculations
    findNearestOrder(currentLocation, orders) {
        let minDistance = Infinity;
        let nearestIndex = 0;
        
        orders.forEach((order, index) => {
            const distance = this.calculateDistance(currentLocation, order.pickupAddress);
            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = index;
            }
        });
        
        return { index: nearestIndex, distance: minDistance };
    }

    calculateDistance(location1, location2) {
        // Simulate distance calculation (in real app, use Google Maps API)
        const hash1 = this.hashString(location1);
        const hash2 = this.hashString(location2);
        return Math.abs(hash1 - hash2) % 10 + 1; // 1-10 km
    }

    calculatePriority(order) {
        // AI-based priority calculation
        const factors = {
            customerTier: this.getCustomerTier(order.customerName),
            orderValue: this.estimateOrderValue(order),
            timeCreated: new Date(order.createdAt).getTime()
        };
        
        return Math.round(
            factors.customerTier * 0.4 + 
            factors.orderValue * 0.3 + 
            (Date.now() - factors.timeCreated) / 3600000 * 0.3
        );
    }

    calculateUrgency(order, currentTime) {
        const hoursSinceCreated = (currentTime - new Date(order.createdAt)) / (1000 * 60 * 60);
        const customerTier = this.getCustomerTier(order.customerName);
        return Math.round(hoursSinceCreated * customerTier * 10);
    }

    calculateConfidence(stop, trafficCondition, weatherCondition) {
        let confidence = 85; // Base confidence
        
        if (trafficCondition.multiplier > 1.3) confidence -= 15;
        if (weatherCondition.multiplier > 1.3) confidence -= 20;
        if (stop.distance > 8) confidence -= 10;
        
        return Math.max(60, Math.min(95, confidence));
    }

    generateStopRecommendations(stop, trafficCondition, weatherCondition) {
        const recommendations = [];
        
        if (trafficCondition.multiplier > 1.3) {
            recommendations.push("🚦 Consider alternative routes due to heavy traffic");
        }
        
        if (weatherCondition.multiplier > 1.3) {
            recommendations.push("☔ Allow extra time for weather conditions");
        }
        
        if (stop.priority > 8) {
            recommendations.push("⭐ High priority customer - prioritize this delivery");
        }
        
        return recommendations;
    }

    createGeographicClusters(orders) {
        // Simple clustering based on address similarity for Indian cities
        const clusters = [
            { name: 'Delhi NCR', center: 'Connaught Place Hub', orders: [] },
            { name: 'Mumbai Metro', center: 'Andheri Hub', orders: [] },
            { name: 'Bangalore Tech', center: 'Koramangala Hub', orders: [] },
            { name: 'Gurgaon Corporate', center: 'Cyber City Hub', orders: [] }
        ];
        
        orders.forEach(order => {
            const address = order.deliveryAddress.toLowerCase();
            if (address.includes('delhi') || address.includes('connaught') || address.includes('lajpat')) {
                clusters[0].orders.push(order);
            } else if (address.includes('mumbai') || address.includes('andheri') || address.includes('bandra')) {
                clusters[1].orders.push(order);
            } else if (address.includes('bangalore') || address.includes('koramangala') || address.includes('whitefield')) {
                clusters[2].orders.push(order);
            } else {
                clusters[3].orders.push(order);
            }
        });
        
        return clusters.filter(cluster => cluster.orders.length > 0);
    }

    getTimeOfDay(date) {
        const hour = date.getHours();
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 22) return 'evening';
        return 'night';
    }

    simulateWeather() {
        const conditions = ['sunny', 'cloudy', 'rainy', 'snowy'];
        const weights = [0.5, 0.3, 0.15, 0.05]; // Probability weights
        const random = Math.random();
        let cumulative = 0;
        
        for (let i = 0; i < conditions.length; i++) {
            cumulative += weights[i];
            if (random <= cumulative) return conditions[i];
        }
        return 'sunny';
    }

    calculateTotalTime(route) {
        if (!route.length) return '0 mins';
        const lastStop = route[route.length - 1];
        return lastStop.cumulativeTime || '0 mins';
    }

    getOptimalTimeWindow(order) {
        const created = new Date(order.createdAt);
        const optimal = new Date(created.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
        return `${optimal.getHours()}:00 - ${optimal.getHours() + 1}:00`;
    }

    getCustomerTier(customerName) {
        // Simulate customer tier (1-5, 5 being highest)
        const hash = this.hashString(customerName);
        return (hash % 5) + 1;
    }

    estimateOrderValue(order) {
        // Simulate order value estimation (1-10)
        const hash = this.hashString(order.customerName + order.deliveryAddress);
        return (hash % 10) + 1;
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
}

module.exports = AIDeliveryService;