const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});

// Store active portals and their participants
const activePortals = new Map();
const userLocations = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle location sharing
    socket.on('send_location', (data) => {
        console.log('Location received:', data);
        
        // Store user location
        userLocations.set(data.user_id, {
            ...data,
            socketId: socket.id,
            lastSeen: Date.now()
        });

        // Broadcast to all clients
        io.emit('receive_location', data);
    });

    // Handle joining a portal (chat room)
    socket.on('join_portal', (data) => {
        const { portalId, userId } = data;
        
        // Join the socket room
        socket.join(portalId);
        
        // Track portal participation
        if (!activePortals.has(portalId)) {
            activePortals.set(portalId, new Set());
        }
        activePortals.get(portalId).add(userId);
        
        console.log(`User ${userId} joined portal ${portalId}`);
        
        // Notify others in the portal
        socket.to(portalId).emit('portal_joined', {
            portalId,
            userId,
            userName: userId.startsWith('user_') ? 'Anonymous' : userId
        });
    });

    // Handle leaving a portal
    socket.on('leave_portal', (data) => {
        const { portalId, userId } = data;
        
        socket.leave(portalId);
        
        if (activePortals.has(portalId)) {
            activePortals.get(portalId).delete(userId);
            
            // Clean up empty portals
            if (activePortals.get(portalId).size === 0) {
                activePortals.delete(portalId);
            }
        }
        
        console.log(`User ${userId} left portal ${portalId}`);
    });

    // Handle chat messages
    socket.on('send_message', (data) => {
        const { portalId, userId, userName, message, timestamp, id } = data;
        
        console.log(`Message in ${portalId} from ${userId}: ${message}`);
        
        // Broadcast message to all users in the portal except sender
        socket.to(portalId).emit('receive_message', {
            id,
            portalId,
            userId,
            userName: userName === 'You' ? 'Anonymous' : userName,
            message,
            timestamp,
            type: 'user'
        });
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
        const { portalId, userId, isTyping } = data;
        
        // Broadcast typing status to others in the portal
        socket.to(portalId).emit('user_typing', {
            portalId,
            userId,
            isTyping
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Clean up user data
        for (let [userId, userData] of userLocations.entries()) {
            if (userData.socketId === socket.id) {
                userLocations.delete(userId);
                
                // Broadcast location removal
                io.emit('receive_location', {
                    user_id: userId,
                    latitude: 0,
                    longitude: 0,
                    live_period: null,
                    quest: '',
                    name: ''
                });
                break;
            }
        }
        
        // Clean up portal participation
        activePortals.forEach((participants, portalId) => {
            // Note: We can't easily determine which user disconnected without additional tracking
            // In a production app, you'd want to store userId with socket.id mapping
        });
    });

    // Periodic cleanup of expired locations
    setInterval(() => {
        const now = Date.now();
        for (let [userId, userData] of userLocations.entries()) {
            if (userData.live_period && userData.live_period < now) {
                userLocations.delete(userId);
                io.emit('receive_location', {
                    user_id: userId,
                    latitude: 0,
                    longitude: 0,
                    live_period: null,
                    quest: '',
                    name: ''
                });
            }
        }
    }, 30000); // Check every 30 seconds
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log('Chat features enabled:');
    console.log('- Real-time messaging');
    console.log('- Portal-based rooms');
    console.log('- Typing indicators');
    console.log('- User presence tracking');
});