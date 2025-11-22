import { 
    IDecodedMessage, 
    LightNode 
} from "@waku/sdk";

import {
    TOPIC_EVENTS, 
    EventDataPacket,
    PortalEvent 
} from "./node";

export class EventStore {
  private node: LightNode;

  constructor(node: LightNode) {
    this.node = node;
  }

  public async queryStore(): Promise<PortalEvent[]> {
  const result: PortalEvent[] = [];
  const eventVersions = new Map<string, PortalEvent[]>(); // Track all versions of each event

  try {
      console.log('🔍 Querying Waku store for historical events...');
      
      const queryOptions = {
          paginationLimit: 200, // Increased to get all versions
          timeStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          timeEnd: new Date(),
          paginationForward: false,
          includeData: true,
      };

      try {
          await this.node.store.queryWithOrderedCallback(
              [this.node.createDecoder({ contentTopic: TOPIC_EVENTS })],
              (message: IDecodedMessage) => {
                  try {
                      if (!message.payload) return;
                      
                      const decodedEvent = EventDataPacket.decode(message.payload) as unknown as PortalEvent;
                      
                      if (decodedEvent && decodedEvent.id && decodedEvent.title) {
                          // Store ALL versions of each event (including cancelled ones)
                          if (!eventVersions.has(decodedEvent.id)) {
                              eventVersions.set(decodedEvent.id, []);
                          }
                          eventVersions.get(decodedEvent.id)!.push(decodedEvent);
                      }
                  } catch (decodeError) {
                      console.warn('⚠️ Failed to decode individual event:', decodeError);
                  }
              },
              queryOptions
          );

          // Process event versions to get the latest state of each event
          for (const [eventId, versions] of eventVersions.entries()) {
              // Sort versions by creation time to get the latest state
              const sortedVersions = versions.sort((a, b) => 
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
              
              const latestVersion = sortedVersions[sortedVersions.length - 1];
              
              // Only include active events that haven't expired
              const now = new Date();
              const eventEnd = new Date(latestVersion.endDateTime);
              
              // ✅ KEY FIX: Respect the isActive flag and filter out cancelled events
              if (latestVersion.isActive && eventEnd > now) {
                  result.push(latestVersion);
                  console.log(`📅 Active event: "${latestVersion.title}"`);
              } else if (!latestVersion.isActive) {
                  console.log(`❌ Skipping cancelled event: "${latestVersion.title}"`);
              } else {
                  console.log(`⏰ Skipping expired event: "${latestVersion.title}"`);
              }
          }
          
          console.log(`✅ Event store query completed: ${result.length} active events from ${eventVersions.size} total events`);
          
      } catch (queryError) {
          console.warn("⚠️ Event query with options failed, trying fallback:", queryError);
          // Your existing fallback code here...
      }

      // Sort results by start date
      result.sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());

  } catch (error) {
      console.error("❌ Critical error querying Waku event store:", error);
      return [];
  }

  return result;
}

  /**
   * Query events near a specific location
   */
  public async queryEventsNearLocation(
    latitude: number, 
    longitude: number, 
    radiusKm: number = 5
  ): Promise<PortalEvent[]> {
    try {
        const allEvents = await this.queryStore();
        
        return allEvents.filter(event => {
            const distance = this.calculateDistance(
                latitude, 
                longitude, 
                event.latitude, 
                event.longitude
            );
            return distance <= radiusKm;
        });
    } catch (error) {
        console.error(`❌ Error querying events near location ${latitude}, ${longitude}:`, error);
        return [];
    }
  }

  /**
   * Query upcoming events (next N hours)
   */
  public async queryUpcomingEvents(hoursAhead: number = 24): Promise<PortalEvent[]> {
    const result: PortalEvent[] = [];
    const now = new Date();
    const timeEnd = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    try {
        console.log(`🕐 Querying events in next ${hoursAhead} hours...`);
        
        const queryOptions = {
            paginationLimit: 50,
            timeStart: now,
            timeEnd: timeEnd,
            paginationForward: true, // true = oldest first for upcoming events
            includeData: true,
        };

        await this.node.store.queryWithOrderedCallback(
            [this.node.createDecoder({ contentTopic: TOPIC_EVENTS })],
            (message: IDecodedMessage) => {
                try {
                    if (!message.payload) return;
                    
                    const decodedEvent = EventDataPacket.decode(message.payload) as unknown as PortalEvent;
                    
                    if (decodedEvent && decodedEvent.id && decodedEvent.title && decodedEvent.isActive) {
                        const eventStart = new Date(decodedEvent.startDateTime);
                        if (eventStart >= now && eventStart <= timeEnd) {
                            result.push(decodedEvent);
                        }
                    }
                } catch (decodeError) {
                    console.warn('⚠️ Failed to decode upcoming event:', decodeError);
                }
            },
            queryOptions
        );

        result.sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
        console.log(`📅 Upcoming events query completed: ${result.length} events`);

    } catch (error) {
        console.error("❌ Error querying upcoming events:", error);
        return [];
    }

    return result;
  }

  /**
   * Query events created by a specific user
   */
  public async queryUserEvents(creatorPubkey: string): Promise<PortalEvent[]> {
    try {
        const allEvents = await this.queryStore();
        return allEvents.filter(event => event.creatorPubkey === creatorPubkey);
    } catch (error) {
        console.error(`❌ Error querying events for user ${creatorPubkey}:`, error);
        return [];
    }
  }

  /**
   * Query events that a user is attending
   */
  public async queryAttendingEvents(userPubkey: string): Promise<PortalEvent[]> {
    try {
        const allEvents = await this.queryStore();
        return allEvents.filter(event => event.attendees.includes(userPubkey));
    } catch (error) {
        console.error(`❌ Error querying attending events for user ${userPubkey}:`, error);
        return [];
    }
  }

  /**
   * Get event store statistics
   */
  public async getStoreStats(): Promise<{
    totalEvents: number;
    activeEvents: number;
    upcomingEvents: number;
    oldestEvent?: Date;
    newestEvent?: Date;
    averageAttendeesPerEvent: number;
  }> {
    try {
        const events = await this.queryStore();
        
        if (events.length === 0) {
            return {
                totalEvents: 0,
                activeEvents: 0,
                upcomingEvents: 0,
                averageAttendeesPerEvent: 0,
            };
        }

        const now = new Date();
        const activeEvents = events.filter(e => e.isActive).length;
        const upcomingEvents = events.filter(e => new Date(e.startDateTime) > now).length;
        
        let totalAttendees = 0;
        
        events.forEach(event => {
            totalAttendees += event.attendees.length;
        });

        const timestamps = events
            .map(event => new Date(event.createdAt).getTime())
            .filter(t => !isNaN(t));
        
        return {
            totalEvents: events.length,
            activeEvents,
            upcomingEvents,
            oldestEvent: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined,
            newestEvent: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined,
            averageAttendeesPerEvent: events.length > 0 ? Math.round(totalAttendees / events.length * 100) / 100 : 0,
        };
    } catch (error) {
        console.error("❌ Error getting event store stats:", error);
        return {
            totalEvents: 0,
            activeEvents: 0,
            upcomingEvents: 0,
            averageAttendeesPerEvent: 0,
        };
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Force clean up expired events from query results
   */
  public filterActiveEvents(events: PortalEvent[]): PortalEvent[] {
    const now = new Date();
    return events.filter(event => {
        const eventEnd = new Date(event.endDateTime);
        return event.isActive && eventEnd > now;
    });
  }
}

export default EventStore;