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

export const CLUSTER_ID = 42;
export const SHARD_ID = 0;
export let wakuIsReady = false;

export const idStore = new IdentStore();
export let nickname = 'W3PN hacker';

// Encoders and decoders
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

// Protobuf message definitions
export const PortalMessageDataPacket = new protobuf.Type('PortalMessageDataPacket')
  .add(new protobuf.Field('portalId', 1, 'string'))
  .add(new protobuf.Field('timestamp', 2, 'uint64'))
  .add(new protobuf.Field('message', 3, 'string'))
  .add(new protobuf.Field('portalPubkey', 4, 'string'))
  .add(new protobuf.Field('frensArray', 5, 'string', 'repeated'));

const FriendRequestDataPacket = new protobuf.Type('FrenDataPacket')
  .add(new protobuf.Field('request', 1, 'string'));

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

// Legacy exports for backwards compatibility
export const portalList: Portal[] = [];
export const portalMessages: Record<string, PortalMessage[]> = messageCache.portalMessages;
export const frenRequests: Fren[] = messageCache.frenRequests;

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

    wakuIsReady = true;
    setHealthStatus(true);

    // Debug logging
    setInterval(() => {
      logCacheStats();
    }, 10000);

    console.log('✅ WAKU NODE FULLY INITIALIZED WITH STORAGE');

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
 * Get cache statistics for debugging
 */
const logCacheStats = () => {
  const totalMessages = Object.keys(messageCache.portalMessages).reduce((total, portalId) => {
    return total + messageCache.portalMessages[portalId].length;
  }, 0);
  
  console.log(`📊 Cache Stats: ${totalMessages} messages across ${Object.keys(messageCache.portalMessages).length} portals, ${messageCache.frenRequests.length} pending friend requests`);
};

/**
 * Get current cache state - useful for debugging
 */
export const getCacheState = () => {
  return {
    ...messageCache,
    stats: {
      totalPortals: Object.keys(messageCache.portalMessages).length,
      totalMessages: Object.values(messageCache.portalMessages).reduce((sum, msgs) => sum + msgs.length, 0),
      pendingFriendRequests: messageCache.frenRequests.length,
      lastUpdated: new Date(messageCache.lastUpdated).toISOString(),
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
  console.log('🧹 Message cache cleared');
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