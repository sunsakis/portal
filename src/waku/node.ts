import { createLightNode, LightNode, Protocols, IDecodedMessage } from '@waku/sdk';
import { createDecoder, createEncoder } from '@waku/sdk';
import blockies from 'ethereum-blockies';
import protobuf from 'protobufjs';
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { Hex } from 'viem';
import Ident, { Fren } from './ident';
import IdentStore, { MASTER_PORTAL_ID } from './IdentStore';
import { MessageStore } from './msgStore';

let wakuNode: LightNode;
let messageStore: MessageStore;

// Topics for different message types
export const TOPIC_PORTALS_MESSAGE = '/PORTALS_MESSAGE2/1/message/proto';
export const TOPIC_FREN_REQUESTS = '/FREN_REQUESTS/1/message/proto';
export const TOPIC_EVENTS = '/PORTAL_EVENTS/1/message/proto';

export const CLUSTER_ID = 42;
export const SHARD_ID = 0;
export let wakuIsReady = false;

export const idStore = new IdentStore();
export let nickname = 'W3PN hacker';

// Encoders and decoders for portals and friends
const portal_message_encoder = createEncoder({
  contentTopic: TOPIC_PORTALS_MESSAGE,
  pubsubTopicShardInfo: { clusterId: CLUSTER_ID, shard: SHARD_ID },
});

export const portal_message_decoder = createDecoder(TOPIC_PORTALS_MESSAGE, {
  clusterId: CLUSTER_ID,
  shard: SHARD_ID,
});

const fren_request_encoder = createEncoder({
  contentTopic: TOPIC_FREN_REQUESTS,
  pubsubTopicShardInfo: { clusterId: CLUSTER_ID, shard: SHARD_ID },
});

const fren_request_decoder = createDecoder(TOPIC_FREN_REQUESTS, {
  clusterId: CLUSTER_ID,
  shard: SHARD_ID,
});

// Event encoder and decoder
const event_encoder = createEncoder({
  contentTopic: TOPIC_EVENTS,
  pubsubTopicShardInfo: { clusterId: CLUSTER_ID, shard: SHARD_ID },
});

const event_decoder = createDecoder(TOPIC_EVENTS, {
  clusterId: CLUSTER_ID,
  shard: SHARD_ID,
});

// Protobuf message definitions
export const PortalMessageDataPacket = new protobuf.Type('PortalMessageDataPacket')
  .add(new protobuf.Field('portalId', 1, 'string'))
  .add(new protobuf.Field('timestamp', 2, 'uint64'))
  .add(new protobuf.Field('message', 3, 'string'))
  .add(new protobuf.Field('portalPubkey', 4, 'string'))
  .add(new protobuf.Field('frensArray', 5, 'string', 'repeated'));

const FriendRequestDataPacket = new protobuf.Type('FrenDataPacket')
  .add(new protobuf.Field('request', 1, 'string'));

// Event protobuf definition
export const EventDataPacket = new protobuf.Type('EventDataPacket')
  .add(new protobuf.Field('id', 1, 'string'))
  .add(new protobuf.Field('title', 2, 'string'))
  .add(new protobuf.Field('description', 3, 'string'))
  .add(new protobuf.Field('category', 4, 'string'))
  .add(new protobuf.Field('latitude', 5, 'double'))
  .add(new protobuf.Field('longitude', 6, 'double'))
  .add(new protobuf.Field('startDateTime', 7, 'string'))
  .add(new protobuf.Field('endDateTime', 8, 'string'))
  .add(new protobuf.Field('createdAt', 9, 'string'))
  .add(new protobuf.Field('creatorPubkey', 10, 'string'))
  .add(new protobuf.Field('attendees', 11, 'string', 'repeated'))
  .add(new protobuf.Field('maxAttendees', 12, 'int32'))
  .add(new protobuf.Field('isActive', 13, 'bool'));

// Type definitions
export interface PortalMessage {
  portalId: string;
  timestamp: number;
  message: string;
  portalPubkey: Hex;
  frensArray: string[];
  fren?: Fren;
  isMyMessage: boolean;
}

export interface Portal {
  timestamp: number;
  id: string;
  x: number;
  y: number;
}

export interface FrenRequest {
  request: Hex;
}

// Event interfaces
export interface PortalEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  startDateTime: string;
  endDateTime: string;
  createdAt: string;
  creatorPubkey: Hex;
  attendees: string[];
  maxAttendees?: number;
  isActive: boolean;
  isMyEvent?: boolean;
}

// Health monitoring
type HealthChangeCallback = (isReady: boolean) => void;
const healthListeners: Set<HealthChangeCallback> = new Set();
let peerCheckInterval: NodeJS.Timeout | null = null;

// Message and request storage with better organization
export const messageCache: {
  portalMessages: Record<string, PortalMessage[]>;
  frenRequests: Fren[];
  lastUpdated: number;
} = {
  portalMessages: {},
  frenRequests: [],
  lastUpdated: Date.now(),
};

// Event storage
export const eventCache: {
  events: PortalEvent[];
  lastUpdated: number;
} = {
  events: [],
  lastUpdated: Date.now(),
};

// Legacy exports for backwards compatibility
export const portalList: Portal[] = [];
export const portalMessages: Record<string, PortalMessage[]> = messageCache.portalMessages;
export const frenRequests: Fren[] = messageCache.frenRequests;
export const portalEvents: PortalEvent[] = eventCache.events;

/**
 * Create and initialize Waku node with storage integration
 */
export const createWakuNode = async () => {
  try {
    const node = await createLightNode({
      networkConfig: {
        clusterId: CLUSTER_ID,
        shards: [SHARD_ID],
      },
      defaultBootstrap: false,
      discovery: {
        dns: false,
        peerExchange: true,
        localPeerCache: false,
      },
      autoStart: true,
      numPeersToUse: 2,
    });

    // Connect to bootstrap peers
    await Promise.allSettled([
      node.dial(
        '/dns4/waku-test.bloxy.one/tcp/8095/wss/p2p/16Uiu2HAmSZbDB7CusdRhgkD81VssRjQV5ZH13FbzCGcdnbbh6VwZ',
      ),
      node.dial(
        '/dns4/vps-aaa00d52.vps.ovh.ca/tcp/8000/wss/p2p/16Uiu2HAm9PftGgHZwWE3wzdMde4m3kT2eYJFXLZfGoSED3gysofk',
      ),
    ]);

    console.log('🚀 WAKU LIGHT NODE CREATED');

    // Wait for peers
    await node.waitForPeers([Protocols.Filter, Protocols.LightPush]);
    console.log('🔗 WAKU PEERS CONNECTED');

    wakuNode = node;

    // Initialize message store
    messageStore = new MessageStore(node);
    console.log('💾 MESSAGE STORE INITIALIZED');

    // Start health monitoring
    startHealthMonitoring();

    // Load historical messages from store
    await loadHistoricalMessages();

    // Subscribe to real-time messages
    await subscribeToMessages();
    await subscribeToFrenRequests();
    await subscribeToEvents();

    wakuIsReady = true;
    setHealthStatus(true);

    // Debug logging
    setInterval(() => {
      logCacheStats();
    }, 10000);

    // Cleanup expired events every 30 minutes
    setInterval(cleanupExpiredEvents, 30 * 60 * 1000);

    console.log('✅ WAKU NODE FULLY INITIALIZED WITH STORAGE AND EVENTS');

  } catch (error) {
    console.error('❌ WAKU NODE INITIALIZATION FAILED:', error);
    setHealthStatus(false);
    throw error;
  }
};

/**
 * Start monitoring peer connections for health status
 */
const startHealthMonitoring = () => {
  // Initial check
  checkPeerHealth();
  
  // Regular health checking every 3 seconds
  peerCheckInterval = setInterval(() => {
    checkPeerHealth();
  }, 3000);
};

/**
 * Check peer connectivity and update health status
 */
const checkPeerHealth = async () => {
  try {
    if (!wakuNode) {
      setHealthStatus(false);
      return;
    }

    const peers = await wakuNode.libp2p?.getPeers() || [];
    const isHealthy = peers.length >= 1;
    setHealthStatus(isHealthy);
    
    // Update wakuIsReady for backwards compatibility
    wakuIsReady = isHealthy;
  } catch (err) {
    console.error('Error checking peer health:', err);
    setHealthStatus(false);
    wakuIsReady = false;
  }
};

/**
 * Set health status and notify listeners
 */
const setHealthStatus = (isReady: boolean) => {
  healthListeners.forEach(listener => listener(isReady));
};

/**
 * Subscribe to health status changes
 */
export const onHealthChange = (callback: HealthChangeCallback): (() => void) => {
  healthListeners.add(callback);
  
  // Immediately call with current status
  callback(wakuIsReady);
  
  // Return unsubscribe function
  return () => {
    healthListeners.delete(callback);
  };
};

/**
 * Load historical messages from Waku store
 */
const loadHistoricalMessages = async () => {
  try {
    console.log('📚 Loading historical messages from store...');
    
    const historicalMessages = await messageStore.queryStore();
    
    // Process and cache historical messages
    for (const message of historicalMessages) {
      await processAndCacheMessage(message);
    }
    
    console.log(`📚 Loaded ${historicalMessages.length} historical messages`);
    messageCache.lastUpdated = Date.now();
    
  } catch (error) {
    console.error('❌ Error loading historical messages:', error);
    // Don't throw - app should work without historical messages
  }
};

/**
 * Process and cache a portal message
 */
const processAndCacheMessage = async (messageObj: PortalMessage) => {
  try {
    // Check if sender is a friend
    const fren = await idStore.recoverSenderIfFren(messageObj.frensArray);
    
    messageObj.fren = fren;
    messageObj.isMyMessage = messageObj.portalPubkey === 
      idStore.getPortalIdent(messageObj.portalId as any).publicKey;

    // Add to cache
    if (!messageCache.portalMessages[messageObj.portalId]) {
      messageCache.portalMessages[messageObj.portalId] = [];
    }
    
    // Check for duplicates before adding
    const exists = messageCache.portalMessages[messageObj.portalId].some(
      existing => existing.timestamp === messageObj.timestamp && 
                 existing.portalPubkey === messageObj.portalPubkey
    );
    
    if (!exists) {
      messageCache.portalMessages[messageObj.portalId].push(messageObj);
      
      // Sort messages by timestamp to maintain order
      messageCache.portalMessages[messageObj.portalId].sort((a, b) => a.timestamp - b.timestamp);
      
      console.log(`💬 Message cached for portal ${messageObj.portalId}: "${messageObj.message}"`);
    }
    
  } catch (err) {
    console.error('❌ Error processing message:', err);
  }
};

/**
 * Subscribe to real-time portal messages
 */
const subscribeToMessages = async () => {
  const callback = async (wakuMessage: any) => {
    console.log('📨 New Waku message received:', wakuMessage);
    
    if (!wakuMessage.payload) return;

    try {
      const messageObj = PortalMessageDataPacket.decode(
        wakuMessage.payload,
      ) as unknown as PortalMessage;

      await processAndCacheMessage(messageObj);
      messageCache.lastUpdated = Date.now();
      
    } catch (err) {
      console.error('❌ Error decoding real-time message:', err);
    }
  };

  try {
    console.log('🔔 Subscribing to real-time messages...');
    await wakuNode.filter.subscribe(portal_message_decoder, callback);
    console.log('✅ Real-time message subscription successful');
  } catch (e) {
    console.error('❌ Real-time message subscription error:', e);
  }
};

/**
 * Send a portal message
 */
export const waku_SendPortalMessage = async (message: PortalMessage) => {
  const portalPubKey = idStore.getPortalIdent(message.portalId as any).publicKey;
  message.portalPubkey = portalPubKey as Hex;
  message.frensArray = await idStore.showYouReAFrenToAll(portalPubKey);

  try {
    const protoMessage = PortalMessageDataPacket.create(message);
    const serialisedMessage = PortalMessageDataPacket.encode(protoMessage).finish();

    await wakuNode.lightPush.send(portal_message_encoder, {
      payload: serialisedMessage,
    });

    // Immediately add to local cache for instant feedback
    await processAndCacheMessage(message);
    messageCache.lastUpdated = Date.now();

    console.log('✅ Message sent and cached successfully');
  } catch (e) {
    console.error('❌ Message send error:', e);
    throw e;
  }
};

/**
 * Subscribe to friend requests
 */
const subscribeToFrenRequests = async () => {
  const callback = async (wakuMessage: any) => {
    if (!wakuMessage.payload) return;
    
    try {
      const messageObj = FriendRequestDataPacket.decode(
        wakuMessage.payload,
      ) as unknown as FrenRequest;

      const frenRequest = messageObj.request;
      const fren = await idStore.hooWanaBeFrens(frenRequest);
      
      if (fren) {
        // Check for duplicates
        const exists = messageCache.frenRequests.some(
          existing => existing.publicKey === fren.publicKey
        );
        
        if (!exists) {
          messageCache.frenRequests.push(fren);
          console.log('👋 New friend request received:', fren.nik);
        }
      }
    } catch (err) {
      console.error('❌ Error processing friend request:', err);
    }
  };
  
  try {
    await wakuNode.filter.subscribe(fren_request_decoder, callback);
    console.log('✅ Friend request subscription successful');
  } catch (e) {
    console.error('❌ Friend request subscription error:', e);
  }
};

/**
 * Accept a friend request
 */
export const waku_acceptFriendRequest = async (fren: Fren) => {
  idStore.addFren(fren.nik, fren.publicKey);
  await waku_SendFrenMessage(
    await idStore.lesBeFrens(nickname, fren.publicKey, MASTER_PORTAL_ID),
    MASTER_PORTAL_ID,
  );
  
  // Remove from pending requests
  const index = messageCache.frenRequests.findIndex(
    req => req.publicKey === fren.publicKey
  );
  if (index > -1) {
    messageCache.frenRequests.splice(index, 1);
  }
};

/**
 * Send a friend request message
 */
export const waku_SendFrenMessage = async (
  frenPortalPubkey: string,
  portalId: string,
) => {
  console.log('👋 Sending friend request...');
  
  const protoMessage = FriendRequestDataPacket.create({
    request: frenPortalPubkey,
  });
  const serialisedMessage = FriendRequestDataPacket.encode(protoMessage).finish();
  
  try {
    await wakuNode.lightPush.send(fren_request_encoder, {
      payload: serialisedMessage,
    });
    console.log('✅ Friend request sent successfully');
  } catch (e) {
    console.error('❌ Friend request send error:', e);
    throw e;
  }
};

/**
 * Subscribe to event messages
 */
const subscribeToEvents = async () => {
  const callback = async (wakuMessage: any) => {
    console.log('📅 New event message received:', wakuMessage);
    
    if (!wakuMessage.payload) return;

    try {
      const eventObj = EventDataPacket.decode(
        wakuMessage.payload,
      ) as unknown as PortalEvent;

      await processAndCacheEvent(eventObj);
      eventCache.lastUpdated = Date.now();
      
    } catch (err) {
      console.error('❌ Error decoding event message:', err);
    }
  };

  try {
    console.log('🔔 Subscribing to events...');
    await wakuNode.filter.subscribe(event_decoder, callback);
    console.log('✅ Event subscription successful');
  } catch (e) {
    console.error('❌ Event subscription error:', e);
  }
};

/**
 * Process and cache an event
 */
const processAndCacheEvent = async (eventObj: PortalEvent) => {
  try {
    // Check if this is the user's own event
    const userPubkey = idStore.getMasterIdent().publicKey;
    eventObj.isMyEvent = eventObj.creatorPubkey === userPubkey;

    // Check for duplicates before adding
    const existingIndex = eventCache.events.findIndex(
      existing => existing.id === eventObj.id
    );
    
    if (existingIndex !== -1) {
      // Update existing event (for attendee changes, etc.)
      eventCache.events[existingIndex] = eventObj;
      console.log(`📅 Event updated: "${eventObj.title}"`);
    } else {
      // Only add if event hasn't passed and is active
      const now = new Date();
      const eventEnd = new Date(eventObj.endDateTime);
      
      if (eventEnd > now && eventObj.isActive) {
        eventCache.events.push(eventObj);
        console.log(`📅 Event cached: "${eventObj.title}" at ${eventObj.latitude}, ${eventObj.longitude}`);
      }
    }
    
    // Sort events by start date
    eventCache.events.sort((a, b) => 
      new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    );
    
  } catch (err) {
    console.error('❌ Error processing event:', err);
  }
};

/**
 * Create a new event
 */
export const waku_CreateEvent = async (eventData: Omit<PortalEvent, 'id' | 'creatorPubkey' | 'attendees' | 'isActive'>) => {
  const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const creatorPubkey = idStore.getMasterIdent().publicKey;

  const event: PortalEvent = {
    ...eventData,
    id: eventId,
    creatorPubkey: creatorPubkey as Hex,
    attendees: [creatorPubkey], // Creator is automatically attending
    isActive: true,
  };

  try {
    const protoMessage = EventDataPacket.create(event);
    const serialisedMessage = EventDataPacket.encode(protoMessage).finish();

    await wakuNode.lightPush.send(event_encoder, {
      payload: serialisedMessage,
    });

    // Immediately add to local cache for instant feedback
    await processAndCacheEvent(event);
    eventCache.lastUpdated = Date.now();

    console.log('✅ Event created and cached successfully:', event.title);
    return event;
  } catch (e) {
    console.error('❌ Event creation error:', e);
    throw e;
  }
};

/**
 * Join an event (add user to attendees)
 */
export const waku_JoinEvent = async (eventId: string) => {
  const userPubkey = idStore.getMasterIdent().publicKey;
  
  // Find the event in cache
  const event = eventCache.events.find(e => e.id === eventId);
  if (!event) {
    throw new Error('Event not found');
  }
  
  // Check if already attending
  if (event.attendees.includes(userPubkey)) {
    throw new Error('Already attending this event');
  }
  
  // Check if event is full
  if (event.maxAttendees && event.attendees.length >= event.maxAttendees) {
    throw new Error('Event is full');
  }
  
  // Check if event hasn't started yet
  const now = new Date();
  const eventStart = new Date(event.startDateTime);
  if (eventStart < now) {
    throw new Error('Event has already started');
  }
  
  // Create updated event with new attendee
  const updatedEvent: PortalEvent = {
    ...event,
    attendees: [...event.attendees, userPubkey],
  };
  
  try {
    const protoMessage = EventDataPacket.create(updatedEvent);
    const serialisedMessage = EventDataPacket.encode(protoMessage).finish();

    await wakuNode.lightPush.send(event_encoder, {
      payload: serialisedMessage,
    });

    // Update local cache
    const eventIndex = eventCache.events.findIndex(e => e.id === eventId);
    if (eventIndex !== -1) {
      eventCache.events[eventIndex] = updatedEvent;
    }
    
    eventCache.lastUpdated = Date.now();
    console.log(`✅ Joined event: ${event.title}`);
    return updatedEvent;
  } catch (e) {
    console.error('❌ Error joining event:', e);
    throw e;
  }
};

/**
 * Leave an event (remove user from attendees)
 */
export const waku_LeaveEvent = async (eventId: string) => {
  const userPubkey = idStore.getMasterIdent().publicKey;
  
  const event = eventCache.events.find(e => e.id === eventId);
  if (!event) {
    throw new Error('Event not found');
  }
  
  if (!event.attendees.includes(userPubkey)) {
    throw new Error('Not attending this event');
  }
  
  // Creator cannot leave their own event
  if (event.creatorPubkey === userPubkey) {
    throw new Error('Cannot leave your own event. Cancel it instead.');
  }
  
  const updatedEvent: PortalEvent = {
    ...event,
    attendees: event.attendees.filter(pubkey => pubkey !== userPubkey),
  };
  
  try {
    const protoMessage = EventDataPacket.create(updatedEvent);
    const serialisedMessage = EventDataPacket.encode(protoMessage).finish();

    await wakuNode.lightPush.send(event_encoder, {
      payload: serialisedMessage,
    });

    // Update local cache
    const eventIndex = eventCache.events.findIndex(e => e.id === eventId);
    if (eventIndex !== -1) {
      eventCache.events[eventIndex] = updatedEvent;
    }
    
    eventCache.lastUpdated = Date.now();
    console.log(`✅ Left event: ${event.title}`);
    return updatedEvent;
  } catch (e) {
    console.error('❌ Error leaving event:', e);
    throw e;
  }
};

/**
 * Cancel an event (only by creator)
 */
export const waku_CancelEvent = async (eventId: string) => {
  const userPubkey = idStore.getMasterIdent().publicKey;
  
  const event = eventCache.events.find(e => e.id === eventId);
  if (!event) {
    throw new Error('Event not found');
  }
  
  if (event.creatorPubkey !== userPubkey) {
    throw new Error('Only the event creator can cancel this event');
  }
  
  const updatedEvent: PortalEvent = {
    ...event,
    isActive: false,
  };
  
  try {
    const protoMessage = EventDataPacket.create(updatedEvent);
    const serialisedMessage = EventDataPacket.encode(protoMessage).finish();

    await wakuNode.lightPush.send(event_encoder, {
      payload: serialisedMessage,
    });

    // Remove from local cache since it's cancelled
    eventCache.events = eventCache.events.filter(e => e.id !== eventId);
    
    eventCache.lastUpdated = Date.now();
    console.log(`✅ Event cancelled: ${event.title}`);
    return updatedEvent;
  } catch (e) {
    console.error('❌ Error cancelling event:', e);
    throw e;
  }
};

/**
 * Get events near a location
 */
export const getEventsNearLocation = (latitude: number, longitude: number, radiusKm: number = 5): PortalEvent[] => {
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  return eventCache.events.filter(event => {
    const distance = calculateDistance(latitude, longitude, event.latitude, event.longitude);
    return distance <= radiusKm && event.isActive;
  });
};

/**
 * Get events happening soon (next 24 hours)
 */
export const getUpcomingEvents = (): PortalEvent[] => {
  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  return eventCache.events.filter(event => {
    const startTime = new Date(event.startDateTime);
    return startTime >= now && startTime <= next24Hours && event.isActive;
  });
};

/**
 * Get events by category
 */
export const getEventsByCategory = (category: string): PortalEvent[] => {
  return eventCache.events.filter(event => 
    event.category === category && event.isActive
  );
};

/**
 * Clean up expired events from cache
 */
export const cleanupExpiredEvents = () => {
  const now = new Date();
  const initialCount = eventCache.events.length;
  
  eventCache.events = eventCache.events.filter(event => {
    const endTime = new Date(event.endDateTime);
    return endTime > now && event.isActive;
  });
  
  const removedCount = initialCount - eventCache.events.length;
  if (removedCount > 0) {
    console.log(`🧹 Cleaned up ${removedCount} expired events`);
    eventCache.lastUpdated = Date.now();
  }
};

/**
 * Get cache statistics for debugging
 */
const logCacheStats = () => {
  const totalMessages = Object.keys(messageCache.portalMessages).reduce((total, portalId) => {
    return total + messageCache.portalMessages[portalId].length;
  }, 0);
  
  console.log(`📊 Cache Stats: ${totalMessages} messages across ${Object.keys(messageCache.portalMessages).length} portals, ${messageCache.frenRequests.length} pending friend requests, ${eventCache.events.length} active events`);
};

/**
 * Get current cache state - useful for debugging
 */
export const getCacheState = () => {
  return {
    messages: { ...messageCache },
    events: { ...eventCache },
    stats: {
      totalPortals: Object.keys(messageCache.portalMessages).length,
      totalMessages: Object.values(messageCache.portalMessages).reduce((sum, msgs) => sum + msgs.length, 0),
      pendingFriendRequests: messageCache.frenRequests.length,
      activeEvents: eventCache.events.length,
      lastMessageUpdate: new Date(messageCache.lastUpdated).toISOString(),
      lastEventUpdate: new Date(eventCache.lastUpdated).toISOString(),
    }
  };
};

/**
 * Clear cache (useful for testing/debugging)
 */
export const clearCache = () => {
  messageCache.portalMessages = {};
  messageCache.frenRequests = [];
  messageCache.lastUpdated = Date.now();
  
  eventCache.events = [];
  eventCache.lastUpdated = Date.now();
  
  console.log('🧹 Message and event cache cleared');
};

/**
 * Get Waku connection status
 */
export const getWakuStatus = () => {
  if (!wakuNode) return 'disconnected';

  const peers = wakuNode.libp2p?.getPeers() || [];
  if (peers.length === 0) return 'connecting';

  return 'connected';
};

/**
 * Stop the Waku node and cleanup
 */
export const stopWakuNode = async () => {
  if (peerCheckInterval) {
    clearInterval(peerCheckInterval);
    peerCheckInterval = null;
  }
  
  if (wakuNode) {
    await wakuNode.stop();
    wakuNode = null as any;
  }
  
  wakuIsReady = false;
  setHealthStatus(false);
  console.log('🛑 Waku node stopped');
};

// Utility functions (keeping for backwards compatibility)
export const getPetName = (portalId: string) => {
  return uniqueNamesGenerator({
    seed: portalId,
    dictionaries: [animals, colors, adjectives],
    separator: '-',
  });
};

export const getAvatar = (portalId: string) => {
  return blockies.create({ seed: portalId });
};