import { createLightNode, LightNode, Protocols } from '@waku/sdk';
import { createDecoder, createEncoder } from '@waku/sdk';
import protobuf from 'protobufjs';

let wakuNode: LightNode;

export const TOPIC_PORTALS_LIST = '/PORTALS_LIST2/1/message/proto';
export const TOPIC_PORTALS_MESSAGE = '/PORTALS_MESSAGE2/1/message/proto';
export const TOPIC_PRIVATE_CHANNEL = 'PRIVATE_CHANNEL/1/message/proto';

export const BOOTSTRAP_PEERS = [
  '/dns4/boot-01.do-ams3.status.prod.status.im/tcp/443/wss/p2p/16Uiu2HAmAR24Mbb6VuzoyUiGx42UenDkshENVDj4qnmmbabLvo31',
  '/dns4/boot-01.gc-us-central1-a.status.prod.status.im/tcp/443/wss/p2p/16Uiu2HAm8mUZ18tBWPXDQsaF7PbCKYA35z7WB2xNZH2EVq1qS8LJ',
  '/dns4/boot-01.ac-cn-hongkong-c.status.prod.status.im/tcp/443/wss/p2p/16Uiu2HAmGwcE8v7gmJNEWFtZtojYpPMTHy2jBLL6xRk33qgDxFWX',
];

export const CLUSTER_ID = 42;
export const SHARD_ID = 1;

const portal_list_encoder = createEncoder({
  contentTopic: TOPIC_PORTALS_LIST,
  pubsubTopicShardInfo: { clusterId: CLUSTER_ID, shard: SHARD_ID },
});
const portal_list_decoder = createDecoder(TOPIC_PORTALS_LIST, {
  clusterId: CLUSTER_ID,
  shard: SHARD_ID,
});
const portal_message_encoder = createEncoder({
  contentTopic: TOPIC_PORTALS_MESSAGE,
  pubsubTopicShardInfo: { clusterId: CLUSTER_ID, shard: SHARD_ID },
});
const portal_message_decoder = createDecoder(TOPIC_PORTALS_MESSAGE, {
  clusterId: CLUSTER_ID,
  shard: SHARD_ID,
});

const PortalListDataPacket = new protobuf.Type('PortalListDataPacket')
  .add(new protobuf.Field('timestamp', 1, 'uint64'))
  .add(new protobuf.Field('id', 2, 'string'))
  .add(new protobuf.Field('x', 3, 'uint64')).add(
    new protobuf.Field('y', 4, 'uint64'),
  );

const PortalMessageDataPacket = new protobuf.Type('PortalMessageDataPacket')
  .add(new protobuf.Field('portalId', 1, 'string'))
  .add(new protobuf.Field('timestamp', 2, 'uint64'))
  .add(new protobuf.Field('message', 3, 'string'));

const FriendRequestDataPacket = new protobuf.Type('PortalMessageDataPacket')
  .add(new protobuf.Field('portalId', 1, 'string'))
  .add(new protobuf.Field('timestamp', 2, 'uint64'))
  .add(new protobuf.Field('message', 3, 'string'));

export interface PortalMessage {
  portalId: string;
  timestamp: number;
  message: string;
}

export interface Portal {
  timestamp: number;
  id: string;
  x: number;
  y: number;
}

export const portalList: Portal[] = [];
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

  console.log('LIGHT NODE CREATED');

  await node.waitForPeers([Protocols.Filter, Protocols.LightPush]);

  console.log('PEERS AWAITED');

  // await Promise.allSettled([
  //   node.dial(
  //     '/dns4/waku-test.bloxy.one/tcp/8095/wss/p2p/16Uiu2HAmSZbDB7CusdRhgkD81VssRjQV5ZH13FbzCGcdnbbh6VwZ',
  //   ),
  //   node.dial(
  //     '/dns4/vps-aaa00d52.vps.ovh.ca/tcp/8000/wss/p2p/16Uiu2HAm9PftGgHZwWE3wzdMde4m3kT2eYJFXLZfGoSED3gysofk',
  //   ),
  // ]);
  wakuNode = node;
  // try {
  //   node.store.queryWithOrderedCallback([portal_list_decoder], (msg) => {
  //     if (msg != null) {
  //       const messageObj = PortalListDataPacket.decode(msg.payload);
  //       portalList.push(messageObj as unknown as Portal);
  //     }
  //   });

  //   node.store.queryWithOrderedCallback([portal_message_decoder], (msg) => {
  //     if (msg != null) {
  //       const messageObj = PortalMessageDataPacket.decode(
  //         msg.payload,
  //       ) as unknown as PortalMessage;
  //       if (Array.isArray(portalMessages[messageObj.portalId])) {
  //         portalMessages[messageObj.portalId].push(messageObj);
  //       } else {
  //         portalMessages[messageObj.portalId] = [messageObj];
  //       }
  //     }
  //   });
  // } catch (e) {
  //   console.error(e);
  // }

  await waku_SubToPortals();
  await waku_SubToMessages();
  console.log('Waku sub started ....');

  setInterval(async () => {
    console.log(portalList);
    console.log(portalMessages);
  }, 3000);
};

const waku_SubToPortals = async () => {
  const callback = (wakuMessage: any) => {
    console.log('new portal', wakuMessage);
    if (!wakuMessage.payload) return;
    const messageObj = PortalListDataPacket.decode(wakuMessage.payload);
    portalList.push(messageObj as unknown as Portal);
  };
  try {
    console.log('Subbing to Portals');
    await wakuNode.nextFilter.subscribe(
      portal_list_decoder,
      callback,
    );
    console.log('Subbing to Portals SUCCESS');
  } catch (e) {
    console.error('Sub error to portals:', e);
  }
};

const waku_SubToMessages = async () => {
  const callback = (wakuMessage: any) => {
    console.log('new msg', wakuMessage);
    if (!wakuMessage.payload) return;
    const messageObj = PortalMessageDataPacket.decode(
      wakuMessage.payload,
    ) as unknown as PortalMessage;
    if (Array.isArray(portalMessages[messageObj.portalId])) {
      portalMessages[messageObj.portalId].push(messageObj);
    } else {
      portalMessages[messageObj.portalId] = [messageObj];
    }
  };
  try {
    await wakuNode.nextFilter.subscribe(
      portal_message_decoder,
      callback,
    );
  } catch (e) {
    console.error('Portal messages sub error: ', e);
  }
};

export const waku_CreatePortal = async (x: number, y: number) => {
  console.log('.... Creating portal ....');
  try {
    const protoMessage = PortalListDataPacket.create({
      timestamp: Date.now(),
      id: `${x},${y}`,
      x,
      y,
    } as Portal);
    const serialisedMessage = PortalListDataPacket.encode(protoMessage).finish();
    await wakuNode.lightPush.send(portal_list_encoder, {
      payload: serialisedMessage,
    });
    console.log('...... Portal created .....');
  } catch (e) {
    console.error('Error creating portal:', e);
  }
};

export const waku_SendPortalMessage = async (message: PortalMessage) => {
  console.log('.... Sending portal message ....');
  const protoMessage = PortalMessageDataPacket.create(message);
  const serialisedMessage = PortalMessageDataPacket.encode(protoMessage).finish();
  try {
    await wakuNode.lightPush.send(portal_message_encoder, {
      payload: serialisedMessage,
    });
  } catch (e) {
    console.error(e);
  }
};

const waku_SubToOwnChannel = () => {
  const peerId = wakuNode.peerId.toString();
  const portal_message_decoder = createDecoder(TOPIC_PORTALS_MESSAGE, {
    clusterId: CLUSTER_ID,
    shard: SHARD_ID,
  });
};
