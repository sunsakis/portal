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
import { EventStore } from './eventStore';

let wakuNode: LightNode;
let messageStore: MessageStore;
let eventStore: EventStore;

// Topics for different message types
export const TOPIC_PORTALS_MESSAGE = '/PORTALS_MESSAGE2/1/message/proto';
export const TOPIC_FREN_REQUESTS = '/FREN_REQUESTS/1/message/proto';
export const TOPIC_EVENTS = '/PORTAL_EVENTS/1/message/proto';

export const CLUSTER_ID = 42;
export const SHARD_ID = 0;
export let wakuIsReady = false;

export const idStore = new IdentStore();
export let nickname = 'W3PN hacker';

// Protobuf message definitions
export const PortalMessageDataPacket = new protobuf.Type('PortalMessageDataPacket')
  .add(new protobuf.Field('portalId', 1, 'string'))
  .add(new protobuf.Field('timestamp', 2, 'uint64'))
  .add(new protobuf.Field('message', 3, 'string'))
  .add(new protobuf.Field('portalPubkey', 4, 'string'))
  .add(new protobuf.Field('frensArray', 5, 'string', 'repeated'));

const FriendRequestDataPacket = new protobuf.Type('FrenDataPacket')
  .add(new protobuf.Field('request', 1, 'string'));

export const EventDataPacket = new protobuf.Type('EventDataPacket')
  .add(new protobuf.Field('id', 1, 'string'))
  .add(new protobuf.Field('title', 2, 'string'))
  .add(new protobuf.Field('description', 3, 'string'))
  .add(new protobuf.Field('latitude', 5, 'double'))
  .add(new protobuf.Field('longitude', 6, 'double'))
  .add(new protobuf.Field('startDateTime', 7, 'string'))
  .add(new protobuf.Field('endDateTime', 8, 'string'))
  .add(new protobuf.Field('createdAt', 9, 'string'))
  .add(new protobuf.Field('creatorPubkey', 10, 'string'))
  .add(new protobuf.Field('attendees', 11, 'string', 'repeated'))
  .add(new protobuf.Field('maxAttendees', 12, 'int32'))
  .add(new protobuf.Field('isActive', 13, 'bool'))
  .add(new protobuf.Field('emoji', 14, 'string'));

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

export interface PortalEvent {
  id: string;
  title: string;
  description: string;
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

// Storage
export const messageCache: {
  portalMessages: Record<string, PortalMessage[]>;
  frenRequests: Fren[];
  lastUpdated: number;
} = {
  portalMessages: {},
  frenRequests: [],
  lastUpdated: Date.now(),
};

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

const EVENTS_STORAGE_KEY = 'portal_events_cache';
const EVENTS_SYNC_KEY = 'portal_events_last_sync';

const saveEventsToStorage = () => {
  try {
    const storageData = {
      events: eventCache.events,
      lastUpdated: eventCache.lastUpdated,
      savedAt: Date.now(),
    };
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(storageData));
    localStorage.setItem(EVENTS_SYNC_KEY, Date.now().toString());
  } catch (err) {
    console.error('Failed to save events to storage:', err);
  }
};

const loadEventsFromStorage = () => {
  try {
    const stored = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (!stored) return;

    const storageData = JSON.parse(stored);
    if (!storageData.events || !Array.isArray(storageData.events)) return;

    eventCache.events = storageData.events;
    eventCache.lastUpdated = storageData.lastUpdated || Date.now();

    const initialCount = eventCache.events.length;
    cleanupExpiredEvents();
    
    if (eventCache.events.length !== initialCount) {
      saveEventsToStorage();
    }
  } catch (err) {
    console.error('Failed to load events from storage:', err);
    eventCache.events = [];
    eventCache.lastUpdated = Date.now();
  }
};

const mergeAndDeduplicateEvents = (networkEvents: PortalEvent[]): boolean => {
  try {
    const eventMap = new Map<string, PortalEvent>();
    let hasChanges = false;

    eventCache.events.forEach(event => {
      eventMap.set(event.id, event);
    });

    networkEvents.forEach(networkEvent => {
      const existingEvent = eventMap.get(networkEvent.id);
      
      if (!networkEvent.isActive) {
        if (existingEvent) {
          eventMap.delete(networkEvent.id);
          hasChanges = true;
        }
        return;
      }
      
      if (!existingEvent) {
        eventMap.set(networkEvent.id, networkEvent);
        hasChanges = true;
      } else {
        if (networkEvent.attendees.length !== existingEvent.attendees.length) {
          eventMap.set(networkEvent.id, networkEvent);
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      eventCache.events = Array.from(eventMap.values()).filter(event => event.isActive);
      eventCache.events.sort((a, b) => 
        new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
      );
      cleanupExpiredEvents();
      eventCache.lastUpdated = Date.now();
    }

    return hasChanges;
  } catch (err) {
    console.error('Error merging events:', err);
    return false;
  }
};

const loadNetworkEventUpdates = async (): Promise<PortalEvent[]> => {
  if (!wakuNode || !eventStore) return [];

  try {
    const networkEvents = await eventStore.queryStore();
    const userPubkey = idStore.getMasterIdent().publicKey;
    networkEvents.forEach(event => {
      event.isMyEvent = event.creatorPubkey === userPubkey;
    });
    return networkEvents;
  } catch (error) {
    console.error('EventStore network query failed:', error);
    return [];
  }
};

const loadHistoricalEventsFromStore = async () => {
  try {
    loadEventsFromStorage();
    const initialCount = eventCache.events.length;
    
    try {
      const networkEvents = await eventStore.queryStore();
      
      if (networkEvents.length > 0) {
        const hasChanges = mergeAndDeduplicateEvents(networkEvents);
        if (hasChanges) {
          saveEventsToStorage();
        }
      }
    } catch (networkError) {
      // Continue with cached events
    }
  } catch (error) {
    console.error('EventStore loading failed:', error);
  }
};

export const createWakuNode = async () => {
  try {
    const node = await createLightNode({
      // networkConfig: {
      //   clusterId: CLUSTER_ID,
      //   shards: [SHARD_ID],
      // },
      defaultBootstrap: true,
      discovery: {
        dns: true,
        peerExchange: true,
        peerCache: false,
      },
      numPeersToUse: 2,
    });

    await Promise.allSettled([
      node.dial('/dns4/waku-test.bloxy.one/tcp/8095/wss/p2p/16Uiu2HAmSZbDB7CusdRhgkD81VssRjQV5ZH13FbzCGcdnbbh6VwZ'),
      node.dial('/dns4/vps-aaa00d52.vps.ovh.ca/tcp/8000/wss/p2p/16Uiu2HAm9PftGgHZwWE3wzdMde4m3kT2eYJFXLZfGoSED3gysofk'),
    ]);

    wakuNode = node;
    await node.waitForPeers();

    messageStore = new MessageStore(node);
    eventStore = new EventStore(node);

    startHealthMonitoring();
    await loadHistoricalMessages();
    
    loadEventsFromStorage();
    
    await subscribeToMessages();
    await subscribeToFrenRequests();
    await subscribeToEvents();

    wakuIsReady = true;
    setHealthStatus(true);

    // Background event sync
    setTimeout(async () => {
      try {
        await loadHistoricalEventsFromStore();
      } catch (error) {
        // Continue with cached events
      }
    }, 2000);

    // Periodic cleanup and sync
    setInterval(() => {
      cleanupExpiredEvents();
      
      loadNetworkEventUpdates()
        .then(networkEvents => {
          if (networkEvents.length > 0) {
            const hasChanges = mergeAndDeduplicateEvents(networkEvents);
            if (hasChanges) {
              saveEventsToStorage();
            }
          }
        })
        .catch(error => {
          // Silent fail
        });
    }, 10 * 60 * 1000);

  } catch (error) {
    console.error('Waku node initialization failed:', error);
    setHealthStatus(false);
    
    try {
      loadEventsFromStorage();
    } catch (storageError) {
      // Silent fail
    }
    
    throw error;
  }
};

const startHealthMonitoring = () => {
  checkPeerHealth();
  peerCheckInterval = setInterval(() => {
    checkPeerHealth();
  }, 3000);
};

const checkPeerHealth = async () => {
  try {
    if (!wakuNode) {
      setHealthStatus(false);
      return;
    }

    const peers = await wakuNode.libp2p?.getPeers() || [];
    const isHealthy = peers.length >= 1;
    setHealthStatus(isHealthy);
    wakuIsReady = isHealthy;
  } catch (err) {
    setHealthStatus(false);
    wakuIsReady = false;
  }
};

const setHealthStatus = (isReady: boolean) => {
  healthListeners.forEach(listener => listener(isReady));
};

export const onHealthChange = (callback: HealthChangeCallback): (() => void) => {
  healthListeners.add(callback);
  callback(wakuIsReady);
  return () => {
    healthListeners.delete(callback);
  };
};

const loadHistoricalMessages = async () => {
  try {
    const historicalMessages = await messageStore.queryStore();
    for (const message of historicalMessages) {
      await processAndCacheMessage(message);
    }
    messageCache.lastUpdated = Date.now();
  } catch (error) {
    console.error('Error loading historical messages:', error);
  }
};

const processAndCacheMessage = async (messageObj: PortalMessage) => {
  try {
    const fren = await idStore.recoverSenderIfFren(messageObj.frensArray);
    messageObj.fren = fren;
    messageObj.isMyMessage = messageObj.portalPubkey === 
      idStore.getPortalIdent(messageObj.portalId as any).publicKey;

    if (!messageCache.portalMessages[messageObj.portalId]) {
      messageCache.portalMessages[messageObj.portalId] = [];
    }
    
    const exists = messageCache.portalMessages[messageObj.portalId].some(
      existing => existing.timestamp === messageObj.timestamp && 
                 existing.portalPubkey === messageObj.portalPubkey
    );
    
    if (!exists) {
      messageCache.portalMessages[messageObj.portalId].push(messageObj);
      messageCache.portalMessages[messageObj.portalId].sort((a, b) => a.timestamp - b.timestamp);
    }
  } catch (err) {
    console.error('Error processing message:', err);
  }
};

const subscribeToMessages = async () => {
  const callback = async (wakuMessage: any) => {
    if (!wakuMessage.payload) return;

    try {
      const messageObj = PortalMessageDataPacket.decode(
        wakuMessage.payload,
      ) as unknown as PortalMessage;

      await processAndCacheMessage(messageObj);
      messageCache.lastUpdated = Date.now();
    } catch (err) {
      console.error('Error decoding real-time message:', err);
    }
  };

  try {
    await wakuNode.filter.subscribe(wakuNode.createDecoder({ contentTopic: TOPIC_PORTALS_MESSAGE}), callback);
  } catch (e) {
    console.error('Real-time message subscription error:', e);
  }
};

export const waku_SendPortalMessage = async (message: PortalMessage) => {
  const portalPubKey = idStore.getPortalIdent(message.portalId as any).publicKey;
  message.portalPubkey = portalPubKey as Hex;
  message.frensArray = await idStore.showYouReAFrenToAll(portalPubKey);

  try {
    const protoMessage = PortalMessageDataPacket.create(message);
    const serialisedMessage = PortalMessageDataPacket.encode(protoMessage).finish();

    await wakuNode.lightPush.send(wakuNode.createEncoder({
  contentTopic: TOPIC_PORTALS_MESSAGE,
}), {
      payload: serialisedMessage,
    });

    await processAndCacheMessage(message);
    messageCache.lastUpdated = Date.now();
  } catch (e) {
    console.error('Message send error:', e);
    throw e;
  }
};

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
        const exists = messageCache.frenRequests.some(
          existing => existing.publicKey === fren.publicKey
        );
        
        if (!exists) {
          messageCache.frenRequests.push(fren);
        }
      }
    } catch (err) {
      console.error('Error processing friend request:', err);
    }
  };
  
  try {
    await wakuNode.filter.subscribe(wakuNode.createDecoder({ contentTopic: TOPIC_FREN_REQUESTS }), callback);
  } catch (e) {
    console.error('Friend request subscription error:', e);
  }
};

export const waku_acceptFriendRequest = async (fren: Fren) => {
  idStore.addFren(fren.nik, fren.publicKey);
  await waku_SendFrenMessage(
    await idStore.lesBeFrens(nickname, fren.publicKey, MASTER_PORTAL_ID),
    MASTER_PORTAL_ID,
  );
  
  const index = messageCache.frenRequests.findIndex(
    req => req.publicKey === fren.publicKey
  );
  if (index > -1) {
    messageCache.frenRequests.splice(index, 1);
  }
};

export const waku_SendFrenMessage = async (
  frenPortalPubkey: string,
  portalId: string,
) => {
  const protoMessage = FriendRequestDataPacket.create({
    request: frenPortalPubkey,
  });
  const serialisedMessage = FriendRequestDataPacket.encode(protoMessage).finish();
  
  try {
    await wakuNode.lightPush.send(wakuNode.createEncoder({
  contentTopic: TOPIC_FREN_REQUESTS,
}), {
      payload: serialisedMessage,
    });
  } catch (e) {
    console.error('Friend request send error:', e);
    throw e;
  }
};

const subscribeToEvents = async () => {
  const callback = async (wakuMessage: any) => {
    if (!wakuMessage.payload) return;

    try {
      const eventObj = EventDataPacket.decode(
        wakuMessage.payload,
      ) as unknown as PortalEvent;

      await processAndCacheEvent(eventObj);
      eventCache.lastUpdated = Date.now();
    } catch (err) {
      console.error('Error decoding event message:', err);
    }
  };

  try {
    await wakuNode.filter.subscribe(wakuNode.createDecoder({ contentTopic: TOPIC_EVENTS }), callback);
  } catch (e) {
    console.error('Event subscription error:', e);
  }
};

const processAndCacheEvent = async (eventObj: PortalEvent) => {
  try {
    const userPubkey = idStore.getMasterIdent().publicKey;
    eventObj.isMyEvent = eventObj.creatorPubkey === userPubkey;

    const existingIndex = eventCache.events.findIndex(
      existing => existing.id === eventObj.id
    );
    
    if (existingIndex !== -1) {
      if (!eventObj.isActive) {
        eventCache.events.splice(existingIndex, 1);
        saveEventsToStorage();
        return;
      } else {
        eventCache.events[existingIndex] = eventObj;
      }
    } else {
      const now = new Date();
      const eventEnd = new Date(eventObj.endDateTime);
      
      if (eventEnd > now && eventObj.isActive) {
        eventCache.events.push(eventObj);
      } else if (!eventObj.isActive) {
        return;
      }
    }
    
    eventCache.events.sort((a, b) => 
      new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    );

    saveEventsToStorage();
  } catch (err) {
    console.error('Error processing event:', err);
  }
};

export const waku_CreateEvent = async (eventData: Omit<PortalEvent, 'id' | 'creatorPubkey' | 'attendees' | 'isActive'>) => {
  const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const creatorPubkey = idStore.getMasterIdent().publicKey;

  const event: PortalEvent = {
    ...eventData,
    id: eventId,
    creatorPubkey: creatorPubkey as Hex,
    attendees: [creatorPubkey],
    isActive: true,
  };

  try {
    const protoMessage = EventDataPacket.create(event);
    const serialisedMessage = EventDataPacket.encode(protoMessage).finish();

    await wakuNode.lightPush.send(wakuNode.createEncoder({
  contentTopic: TOPIC_EVENTS,
}), {
      payload: serialisedMessage,
    });

    await processAndCacheEvent(event);
    eventCache.lastUpdated = Date.now();

    return event;
  } catch (e) {
    console.error('Event creation error:', e);
    throw e;
  }
};

export const waku_JoinEvent = async (eventId: string) => {
  const userPubkey = idStore.getMasterIdent().publicKey;
  
  const event = eventCache.events.find(e => e.id === eventId);
  if (!event) {
    throw new Error('Event not found');
  }
  
  if (event.attendees.includes(userPubkey)) {
    throw new Error('Already attending this event');
  }
  
  if (event.maxAttendees && event.attendees.length >= event.maxAttendees) {
    throw new Error('Event is full');
  }
  
  const now = new Date();
  const eventStart = new Date(event.startDateTime);
  if (eventStart < now) {
    throw new Error('Event has already started');
  }
  
  const updatedEvent: PortalEvent = {
    ...event,
    attendees: [...event.attendees, userPubkey],
  };
  
  try {
    const protoMessage = EventDataPacket.create(updatedEvent);
    const serialisedMessage = EventDataPacket.encode(protoMessage).finish();

    await wakuNode.lightPush.send(wakuNode.createEncoder({
  contentTopic: TOPIC_EVENTS,
}), {
      payload: serialisedMessage,
    });

    const eventIndex = eventCache.events.findIndex(e => e.id === eventId);
    if (eventIndex !== -1) {
      eventCache.events[eventIndex] = updatedEvent;
    }
    
    eventCache.lastUpdated = Date.now();
    return updatedEvent;
  } catch (e) {
    console.error('Error joining event:', e);
    throw e;
  }
};

export const waku_LeaveEvent = async (eventId: string) => {
  const userPubkey = idStore.getMasterIdent().publicKey;
  
  const event = eventCache.events.find(e => e.id === eventId);
  if (!event) {
    throw new Error('Event not found');
  }
  
  if (!event.attendees.includes(userPubkey)) {
    throw new Error('Not attending this event');
  }
  
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

    await wakuNode.lightPush.send(wakuNode.createEncoder({
  contentTopic: TOPIC_EVENTS,
}), {
      payload: serialisedMessage,
    });

    const eventIndex = eventCache.events.findIndex(e => e.id === eventId);
    if (eventIndex !== -1) {
      eventCache.events[eventIndex] = updatedEvent;
    }
    
    eventCache.lastUpdated = Date.now();
    return updatedEvent;
  } catch (e) {
    console.error('Error leaving event:', e);
    throw e;
  }
};

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

    await wakuNode.lightPush.send(wakuNode.createEncoder({
  contentTopic: TOPIC_EVENTS,
}), {
      payload: serialisedMessage,
    });

    eventCache.events = eventCache.events.filter(e => e.id !== eventId);
    eventCache.lastUpdated = Date.now();
    saveEventsToStorage();
    
    return updatedEvent;
  } catch (e) {
    console.error('Error cancelling event:', e);
    throw e;
  }
};

// Cache-based query functions
export const getEventsNearLocation = (latitude: number, longitude: number, radiusKm: number = 5): PortalEvent[] => {
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
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

export const getUpcomingEvents = (): PortalEvent[] => {
  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  return eventCache.events.filter(event => {
    const startTime = new Date(event.startDateTime);
    return startTime >= now && startTime <= next24Hours && event.isActive;
  });
};

export const cleanupExpiredEvents = () => {
  const now = new Date();
  const initialCount = eventCache.events.length;
  
  eventCache.events = eventCache.events.filter(event => {
    const endTime = new Date(event.endDateTime);
    return endTime > now && event.isActive;
  });
  
  if (eventCache.events.length !== initialCount) {
    eventCache.lastUpdated = Date.now();
    saveEventsToStorage();
  }
};

// EventStore-powered functions
export const getEventsNearLocationFromStore = async (
  latitude: number, 
  longitude: number, 
  radiusKm: number = 5
): Promise<PortalEvent[]> => {
  if (!eventStore) {
    return getEventsNearLocation(latitude, longitude, radiusKm);
  }
  
  try {
    return await eventStore.queryEventsNearLocation(latitude, longitude, radiusKm);
  } catch (error) {
    return getEventsNearLocation(latitude, longitude, radiusKm);
  }
};

export const getUpcomingEventsFromStore = async (hoursAhead: number = 24): Promise<PortalEvent[]> => {
  if (!eventStore) {
    return getUpcomingEvents();
  }
  
  try {
    return await eventStore.queryUpcomingEvents(hoursAhead);
  } catch (error) {
    return getUpcomingEvents();
  }
};

export const getUserEventsFromStore = async (userPubkey: string): Promise<PortalEvent[]> => {
  if (!eventStore) return [];
  
  try {
    return await eventStore.queryUserEvents(userPubkey);
  } catch (error) {
    return [];
  }
};

export const getAttendingEventsFromStore = async (userPubkey: string): Promise<PortalEvent[]> => {
  if (!eventStore) return [];
  
  try {
    return await eventStore.queryAttendingEvents(userPubkey);
  } catch (error) {
    return [];
  }
};

export const stopWakuNode = async () => {
  if (peerCheckInterval) {
    clearInterval(peerCheckInterval);
    peerCheckInterval = null;
  }
  
  if (wakuNode) {
    await wakuNode.stop();
    wakuNode = null as any;
  }
  
  messageStore = null as any;
  eventStore = null as any;
  
  wakuIsReady = false;
  setHealthStatus(false);
};

export const getWakuStatus = () => {
  if (!wakuNode) return 'disconnected';
  const peers = wakuNode.libp2p?.getPeers() || [];
  if (peers.length === 0) return 'connecting';
  return 'connected';
};

// Export store instances
export { messageStore, eventStore };

// Utility functions
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