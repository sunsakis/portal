import { createLightNode, LightNode, Protocols } from '@waku/sdk';
import { createDecoder, createEncoder } from '@waku/sdk';
import protobuf from 'protobufjs';

let wakuNode: LightNode;

// Only need messages topic now - portals are handled by Supabase
export const TOPIC_PORTALS_MESSAGE = '/PORTALS_MESSAGE2/1/message/proto';

export const CLUSTER_ID = 42;
export const SHARD_ID = 0;

// Only message encoder/decoder needed
const portal_message_encoder = createEncoder({
  contentTopic: TOPIC_PORTALS_MESSAGE,
  pubsubTopicShardInfo: { clusterId: CLUSTER_ID, shard: SHARD_ID },
});
const portal_message_decoder = createDecoder(TOPIC_PORTALS_MESSAGE, {
  clusterId: CLUSTER_ID,
  shard: SHARD_ID,
});

// Only message packet needed
const PortalMessageDataPacket = new protobuf.Type('PortalMessageDataPacket')
  .add(new protobuf.Field('portalId', 1, 'string'))
  .add(new protobuf.Field('timestamp', 2, 'uint64'))
  .add(new protobuf.Field('message', 3, 'string'));

export interface PortalMessage {
  portalId: string;
  timestamp: number;
  message: string;
}

// Only store messages in Waku - portals come from Supabase
export const portalMessages: Record<string, PortalMessage[]> = {};

export const createWakuNode = async () => {
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

  await Promise.allSettled([
    node.dial(
      '/dns4/waku-test.bloxy.one/tcp/8095/wss/p2p/16Uiu2HAmSZbDB7CusdRhgkD81VssRjQV5ZH13FbzCGcdnbbh6VwZ',
    ),
    node.dial(
      '/dns4/vps-aaa00d52.vps.ovh.ca/tcp/8000/wss/p2p/16Uiu2HAm9PftGgHZwWE3wzdMde4m3kT2eYJFXLZfGoSED3gysofk',
    ),
  ]);

  console.log('WAKU LIGHT NODE CREATED (Messages Only)');

  await node.waitForPeers([Protocols.Filter, Protocols.LightPush]);

  console.log('WAKU PEERS CONNECTED');

  wakuNode = node;

  // Only subscribe to messages - portals handled by Supabase
  await waku_SubToMessages();
  console.log('Waku message subscription started');

  // Debug logging for messages only
  setInterval(async () => {
    const messageCount = Object.keys(portalMessages).reduce((total, portalId) => {
      return total + portalMessages[portalId].length;
    }, 0);
    console.log(`Waku messages cached: ${messageCount} total across ${Object.keys(portalMessages).length} portals`);
  }, 10000);
};

const waku_SubToMessages = async () => {
  const callback = (wakuMessage: any) => {
    console.log('New Waku message received:', wakuMessage);
    if (!wakuMessage.payload) return;
    
    try {
      const messageObj = PortalMessageDataPacket.decode(
        wakuMessage.payload,
      ) as unknown as PortalMessage;
      
      if (Array.isArray(portalMessages[messageObj.portalId])) {
        portalMessages[messageObj.portalId].push(messageObj);
      } else {
        portalMessages[messageObj.portalId] = [messageObj];
      }
      
      console.log(`Message added to portal ${messageObj.portalId}: "${messageObj.message}"`);
    } catch (err) {
      console.error('Error decoding Waku message:', err);
    }
  };
  
  try {
    console.log('Subscribing to Waku messages...');
    await wakuNode.filter.subscribe(
      portal_message_decoder,
      callback,
    );
    console.log('Waku message subscription successful');
  } catch (e) {
    console.error('Waku message subscription error:', e);
  }
};

export const waku_SendPortalMessage = async (message: PortalMessage) => {
  console.log('Sending Waku message:', message);
  
  try {
    const protoMessage = PortalMessageDataPacket.create(message);
    const serialisedMessage = PortalMessageDataPacket.encode(protoMessage).finish();
    
    await wakuNode.lightPush.send(portal_message_encoder, {
      payload: serialisedMessage,
    });
    
    console.log('Waku message sent successfully');
  } catch (e) {
    console.error('Waku message send error:', e);
    throw e;
  }
};

// Helper function to get Waku connection status
export const getWakuStatus = () => {
  if (!wakuNode) return 'disconnected';
  
  const peers = wakuNode.libp2p?.getPeers() || [];
  if (peers.length === 0) return 'connecting';
  
  return 'connected';
};