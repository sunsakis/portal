import { createLightNode } from '@waku/sdk';
import { createDecoder, createEncoder } from '@waku/sdk';
import protobuf from 'protobufjs';

export let wakuNode;

export const TOPIC_PORTALS_LIST = '/TOPIC_PORTALS_LIST/1/message/proto';
const portal_list_encoder = createEncoder({
  contentTopic: TOPIC_PORTALS_LIST,
  pubsubTopicShardInfo: { clusterId: 42, shard: 0 },
});
const portal_list_decoder = createDecoder(TOPIC_PORTALS_LIST, {
  clusterId: 42,
  shard: 0,
});

export const portalList = [];

const PortalListDataPacket = new protobuf.Type('PortalListDataPacket')
  .add(new protobuf.Field('timestamp', 1, 'uint64'))
  .add(new protobuf.Field('portalName', 2, 'string'))
  .add(new protobuf.Field('portalX', 3, 'uint64')).add(
    new protobuf.Field('portalY', 4, 'uint64'),
  );

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
    numPeersToUse: 2,
    autoStart: true,
  });

  await Promise.allSettled([
    node.dial(
      '/dns4/waku-test.bloxy.one/tcp/8095/wss/p2p/16Uiu2HAmSZbDB7CusdRhgkD81VssRjQV5ZH13FbzCGcdnbbh6VwZ',
    ),
    node.dial(
      '/dns4/vps-aaa00d52.vps.ovh.ca/tcp/8000/wss/p2p/16Uiu2HAm9PftGgHZwWE3wzdMde4m3kT2eYJFXLZfGoSED3gysofk',
    ),
  ]);

  console.log(node);
  wakuNode = node;
  console.log('Waku Light node started ....');

  waku_SubToPortals();
  console.log('Waku sub started ....');

  setInterval(async () => {
    try {
      await waku_OpenPortal();
      console.log('Waku portal opened ....');
      console.log(portalList);
    } catch (e) {
      console.error(e);
    }
  }, 3000);
};

const waku_OpenPortal = async () => {
  const protoMessage = PortalListDataPacket.create({
    timestamp: Date.now(),
    portalName: 'TestPortal',
    portalX: 0,
    portalY: 0,
  });

  // Serialise the message using Protobuf
  const serialisedMessage = PortalListDataPacket.encode(protoMessage).finish();

  // Send the message using Light Push
  try {
    await wakuNode.lightPush.send(portal_list_encoder, {
      payload: serialisedMessage,
    });
  } catch (e) {
    console.error(e);
  }
};

const waku_SubToPortals = async () => {
  const callback = (wakuMessage) => {
    console.log('waku msh', wakuMessage);

    // Check if there is a payload on the message
    if (!wakuMessage.payload) return;
    // Render the messageObj as desired in your application
    const messageObj = PortalListDataPacket.decode(wakuMessage.payload);
    portalList.push(messageObj);
    console.log(messageObj);
  };
  // Create a Filter subscription
  await wakuNode.nextFilter.subscribe(
    portal_list_decoder,
    callback,
  );
};
