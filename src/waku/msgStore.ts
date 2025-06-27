import { 
    IDecodedMessage, 
    LightNode 
} from "@waku/sdk";

import {
    portal_message_decoder, 
    PortalMessageDataPacket,
    PortalMessage 
} from "./node";

//TODO: Add SDS
export class MessageStore {
  private node: LightNode;

  constructor(node: LightNode) {
    this.node = node;
  }

  public async queryStore(): Promise<PortalMessage[]> {
    const result: PortalMessage[] = [];

    try {
        console.log('🔍 Querying Waku store for historical messages...');
        
        // Add query options to prevent database overload
        const queryOptions = {
            paginationLimit: 50, // Limit to 50 messages
            timeStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            timeEnd: new Date(), // Current time
            paginationForward: false, // false = newest first
            includeData: true, // include full message data
        };

        // Try with query options first, fallback to no options
        try {
            console.log('📝 Attempting store query with pagination options...');
            
            await this.node.store.queryWithOrderedCallback(
                [portal_message_decoder], // Fixed: should be array, not Object.values()
                (message: IDecodedMessage) => {
                    try {
                        if (!message.payload) {
                            console.warn('⚠️ Received message without payload');
                            return;
                        }
                        
                        const decodedMessage = PortalMessageDataPacket.decode(message.payload) as unknown as PortalMessage;
                        
                        // Validate decoded message
                        if (decodedMessage && decodedMessage.portalId && decodedMessage.message) {
                            result.push(decodedMessage);
                        } else {
                            console.warn('⚠️ Invalid message structure:', decodedMessage);
                        }
                    } catch (decodeError) {
                        console.warn('⚠️ Failed to decode individual message:', decodeError);
                    }
                },
                queryOptions
            );
            
            console.log(`✅ Store query with options completed: ${result.length} messages`);
            
        } catch (queryError) {
            console.warn("⚠️ Query with options failed, trying fallback:", queryError);
            
            // Fallback: query without options but with message limit
            let messageCount = 0;
            const MAX_MESSAGES = 100;

            await this.node.store.queryWithOrderedCallback(
                [portal_message_decoder],
                (message: IDecodedMessage) => {
                    if (messageCount >= MAX_MESSAGES) {
                        return;
                    }
                    
                    try {
                        if (!message.payload) {
                            console.warn('⚠️ Received message without payload (fallback)');
                            return;
                        }
                        
                        const decodedMessage = PortalMessageDataPacket.decode(message.payload) as unknown as PortalMessage;
                        
                        if (decodedMessage && decodedMessage.portalId && decodedMessage.message) {
                            result.push(decodedMessage);
                            messageCount++;
                        }
                    } catch (decodeError) {
                        console.warn('⚠️ Failed to decode message in fallback:', decodeError);
                    }
                }
            );
            
            console.log(`✅ Fallback store query completed: ${result.length} messages`);
        }

        // Sort results by timestamp to ensure proper order
        result.sort((a, b) => a.timestamp - b.timestamp);

        if (result.length > 0) {
            console.log(`📚 Waku store query successful: ${result.length} messages retrieved`);
            
            // Log some statistics
            const portalCounts: Record<string, number> = {};
            result.forEach(msg => {
                portalCounts[msg.portalId] = (portalCounts[msg.portalId] || 0) + 1;
            });
            
            console.log(`📊 Messages per portal:`, portalCounts);
        } else {
            console.log('📭 No historical messages found in store');
        }

    } catch (error) {
        console.error("❌ Critical error querying Waku store:", error);
        
        // Don't throw the error - return empty array instead
        // This allows the app to continue working even if store is unavailable
        console.log('🔄 Continuing without historical messages...');
        return [];
    }

    return result;
  }

  /**
   * Query messages for a specific portal
   */
  public async queryPortalMessages(portalId: string): Promise<PortalMessage[]> {
    try {
        const allMessages = await this.queryStore();
        return allMessages.filter(msg => msg.portalId === portalId);
    } catch (error) {
        console.error(`❌ Error querying messages for portal ${portalId}:`, error);
        return [];
    }
  }

  /**
   * Query recent messages (last N hours)
   */
  public async queryRecentMessages(hoursBack: number = 24): Promise<PortalMessage[]> {
    const result: PortalMessage[] = [];
    const timeStart = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    try {
        console.log(`🕐 Querying messages from last ${hoursBack} hours...`);
        
        const queryOptions = {
            paginationLimit: 100,
            timeStart: timeStart,
            timeEnd: new Date(),
            paginationForward: false,
            includeData: true,
        };

        await this.node.store.queryWithOrderedCallback(
            [portal_message_decoder],
            (message: IDecodedMessage) => {
                try {
                    if (!message.payload) return;
                    
                    const decodedMessage = PortalMessageDataPacket.decode(message.payload) as unknown as PortalMessage;
                    
                    if (decodedMessage && decodedMessage.portalId && decodedMessage.message) {
                        result.push(decodedMessage);
                    }
                } catch (decodeError) {
                    console.warn('⚠️ Failed to decode recent message:', decodeError);
                }
            },
            queryOptions
        );

        result.sort((a, b) => a.timestamp - b.timestamp);
        console.log(`📅 Recent messages query completed: ${result.length} messages`);

    } catch (error) {
        console.error("❌ Error querying recent messages:", error);
        return [];
    }

    return result;
  }

  /**
   * Get store statistics
   */
  public async getStoreStats(): Promise<{
    totalMessages: number;
    portalsWithMessages: number;
    oldestMessage?: Date;
    newestMessage?: Date;
  }> {
    try {
        const messages = await this.queryStore();
        
        if (messages.length === 0) {
            return {
                totalMessages: 0,
                portalsWithMessages: 0,
            };
        }

        const portalIds = new Set(messages.map(msg => msg.portalId));
        const timestamps = messages.map(msg => msg.timestamp).filter(t => t > 0);
        
        return {
            totalMessages: messages.length,
            portalsWithMessages: portalIds.size,
            oldestMessage: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined,
            newestMessage: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined,
        };
    } catch (error) {
        console.error("❌ Error getting store stats:", error);
        return {
            totalMessages: 0,
            portalsWithMessages: 0,
        };
    }
  }
}

export default MessageStore;