import { createLightNode, LightNode } from '@waku/sdk';
import { createDecoder, createEncoder } from '@waku/sdk';
import protobuf from 'protobufjs';

let wakuNode: LightNode;

export const TOPIC_PORTALS_LIST = '/PORTALS_LIST/1/message/proto';
export const TOPIC_PORTALS_MESSAGE = '/PORTALS_MESSAGE/1/message/proto';
const portal_list_encoder = createEncoder({
  contentTopic: TOPIC_PORTALS_LIST,
  pubsubTopicShardInfo: { clusterId: 42, shard: 0 },
});
const portal_list_decoder = createDecoder(TOPIC_PORTALS_LIST, {
  clusterId: 42,
  shard: 0,
});
const portal_message_encoder = createEncoder({
  contentTopic: TOPIC_PORTALS_MESSAGE,
  pubsubTopicShardInfo: { clusterId: 42, shard: 0 },
});
const portal_message_decoder = createDecoder(TOPIC_PORTALS_MESSAGE, {
  clusterId: 42,
  shard: 0,
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
      clusterId: 42,
      shards: [0],
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
  wakuNode = node;
  let messages = [];
  try {
    node.store.queryWithOrderedCallback([portal_list_decoder], (msg) => {
      console.log('------------------ decoded old msg', msg);
    });
    // const promises = wakuNode.store.queryGenerator([portal_list_decoder]);

    // for await (const promise of promises) {
    //   for (let p of promise) {
    //     console.log('promise', p);
    //   }
    //   // const messagesRaw = await Promise.all(promise);
    //   // console.log(messagesRaw);
    //   // const filteredMessages = messagesRaw.filter(
    //   //   (v) => !!v,
    //   // );

    //   // messages = [...messages, ...filteredMessages];
    // }
  } catch (e) {
    console.error(e);
  }
  console.log('OLD', messages);
  await waku_SubToPortals();
  await waku_SubToMessages();
  console.log('Waku sub started ....');

  await waku_CreatePortal(0, 0);

  setInterval(async () => {
    console.log(portalList);
    console.log(portalMessages);
  }, 3000);

  setInterval(async () => {
    await waku_SendPortalMessage({
      portalId: '0,0',
      timestamp: Date.now(),
      message: Math.random().toString(),
    });
  }, 5000);
};

const waku_SubToPortals = async () => {
  const callback = (wakuMessage: any) => {
    console.log('new portal', wakuMessage);
    if (!wakuMessage.payload) return;
    const messageObj = PortalListDataPacket.decode(wakuMessage.payload);
    portalList.push(messageObj as unknown as Portal);
  };
  await wakuNode.nextFilter.subscribe(
    portal_list_decoder,
    callback,
  );
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
  await wakuNode.nextFilter.subscribe(
    portal_message_decoder,
    callback,
  );
};

export const waku_CreatePortal = async (x: number, y: number) => {
  console.log('.... Creating portal ....');
  const protoMessage = PortalListDataPacket.create({
    timestamp: Date.now(),
    id: `${x},${y}`,
    x,
    y,
  } as Portal);
  const serialisedMessage = PortalListDataPacket.encode(protoMessage).finish();
  try {
    await wakuNode.lightPush.send(portal_list_encoder, {
      payload: serialisedMessage,
    });
  } catch (e) {
    console.error(e);
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
