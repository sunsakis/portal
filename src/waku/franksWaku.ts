import { createLightNode } from '@waku/sdk'
import { ReliableChannel } from "@waku/sdk";
import protobuf from "protobufjs";

const node = await createLightNode({
    defaultBootstrap: true,
})

// Choose a content topic
const ct = "/portal/1/locations/proto";

// Create a message encoder and decoder
const encoder = node.createEncoder({ contentTopic: ct });
const decoder = node.createDecoder({ contentTopic: ct });

const channelName = "location"

const senderId = "1"

const reliableChannel = await ReliableChannel.create(node, channelName, senderId, encoder, decoder)

const coords = { x: 123, y: 456 }

// Create a message structure using Protobuf
const DataPacket = new protobuf.Type("DataPacket")
  .add(new protobuf.Field("timestamp", 1, "uint64"))
  .add(new protobuf.Field("sender", 2, "string"))
  .add(new protobuf.Field("message", 3, "string"));

// Create a new message object
const protoMessage = DataPacket.create({
  timestamp: Date.now(),
  sender: "Alice",
  message: "Hello, World!",
});

// Serialise the message using Protobuf
const serialisedMessage = DataPacket.encode(protoMessage).finish();

reliableChannel.send(serialisedMessage)

reliableChannel.addEventListener("message-received", (event) => {
const wakuMessage = event.detail;
  
console.log(DataPacket.decode(wakuMessage.payload));
})


