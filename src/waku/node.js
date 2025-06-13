import { createLightNode } from '@waku/sdk';
import { createDecoder, createEncoder } from '@waku/sdk';
import protobuf from 'protobufjs';

export let wakuNode = null;

export const TOPIC_PORTALS_LIST = '/TOPIC_PORTALS_LIST/1/message/proto';
const portal_list_encoder = createEncoder({ contentTopic: TOPIC_PORTALS_LIST });
const portal_list_decoder = createDecoder(TOPIC_PORTALS_LIST);

export const portalList = [];

const PortalListDataPacket = new protobuf.Type('PortalListDataPacket')
  .add(new protobuf.Field('timestamp', 1, 'uint64'))
  .add(new protobuf.Field('portalName', 2, 'string'))
  .add(new protobuf.Field('portalX', 3, 'uint64')).add(
    new protobuf.Field('portalY', 4, 'uint64'),
  );

export const createWakuNode = async () => {
  console.log('Waku Light node started ....');
  const node = await createLightNode({
    defaultBootstrap: true,
    networkConfig: {
      clusterId: 1,
      contentTopics: [TOPIC_PORTALS_LIST],
    },
  });
  wakuNode = node;
  await node.start();
  await waku_SubToPortals();
  await waku_OpenPortal();
  console.log(portalList);
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
  await wakuNode.lightPush.send(portal_list_encoder, {
    payload: serialisedMessage,
  });
};

const waku_SubToPortals = async () => {
  const callback = (wakuMessage) => {
    // Check if there is a payload on the message
    if (!wakuMessage.payload) return;
    // Render the messageObj as desired in your application
    const messageObj = PortalListDataPacket.decode(wakuMessage.payload);
    portalList.push(messageObj);
    console.log(messageObj);
  };
  // Create a Filter subscription
  const { error, subscription } = await wakuNode.filter.createSubscription({
    contentTopics: [TOPIC_PORTALS_LIST],
  });
  if (error) {
    console.error(error);
  }
  // Subscribe to content topics and process new messages
  await subscription.subscribe([portal_list_decoder], callback);
};
