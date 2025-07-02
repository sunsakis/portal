import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Helper function to generate portal/event ID from coordinates
export const generateEventId = (latitude, longitude) => {
  const x = Math.round(latitude * 1000000);
  const y = Math.round(longitude * 1000000);
  return `${x},${y}`;
};

// Event management functions
export const createEvent = async (eventData, user) => {
  try {
    console.log('Creating event/portal:', eventData);

    const { data, error } = await supabase.rpc('check_event_proximity_and_create', {
      p_latitude: eventData.latitude,
      p_longitude: eventData.longitude,
      p_user_id: user.id,
      p_title: eventData.title,
      p_description: eventData.description || '',
      p_emoji: eventData.emoji || '🎉',
      p_category: eventData.category || 'social',
      p_start_datetime: eventData.startDateTime,
      p_end_datetime: eventData.endDateTime,
      p_creator_pubkey: user.wakuIdent?.publicKey || '',
      p_max_attendees: eventData.maxAttendees || null
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      return { data: null, error: error.message };
    }

    if (!data.success) {
      return { data: null, error: data.message };
    }

    return { data: data.data, error: null };
  } catch (err) {
    console.error('Event creation failed:', err);
    return { data: null, error: err.message };
  }
};

export const joinEvent = async (eventId, userPubkey) => {
  try {
    // Get current event
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError) {
      throw new Error('Event not found');
    }

    // Check if already attending
    if (event.attendees.includes(userPubkey)) {
      throw new Error('Already attending this event');
    }

    // Check capacity
    if (event.max_attendees && event.attendees.length >= event.max_attendees) {
      throw new Error('Event is full');
    }

    // Add user to attendees
    const updatedAttendees = [...event.attendees, userPubkey];

    const { data, error } = await supabase
      .from('events')
      .update({ attendees: updatedAttendees })
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to join event');
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
};

export const leaveEvent = async (eventId, userPubkey) => {
  try {
    // Get current event
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError) {
      throw new Error('Event not found');
    }

    // Check if attending
    if (!event.attendees.includes(userPubkey)) {
      throw new Error('Not attending this event');
    }

    // Prevent creator from leaving
    if (event.creator_pubkey === userPubkey) {
      throw new Error('Cannot leave your own event. Cancel it instead.');
    }

    // Remove user from attendees
    const updatedAttendees = event.attendees.filter(pubkey => pubkey !== userPubkey);

    const { data, error } = await supabase
      .from('events')
      .update({ attendees: updatedAttendees })
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to leave event');
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
};

export const cancelEvent = async (eventId, userPubkey) => {
  try {
    // Verify ownership and set inactive
    const { data, error } = await supabase
      .from('events')
      .update({ is_active: false })
      .eq('id', eventId)
      .eq('creator_pubkey', userPubkey)
      .select()
      .single();

    if (error || !data) {
      throw new Error('Only the event creator can cancel this event');
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
};

export const fetchEvents = async () => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .gte('end_datetime', new Date().toISOString())
      .order('start_datetime', { ascending: true });

    if (error) {
      console.error('Failed to fetch events:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err) {
    console.error('Error fetching events:', err);
    return { data: [], error: err.message };
  }
};

// -- SUPABASE portal schema:

// CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

// -- Drop existing portals table and create events table
// DROP TABLE IF EXISTS portals CASCADE;

// CREATE TABLE events (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
//   -- Location data (from portals)
//   latitude DECIMAL(10, 8) NOT NULL,
//   longitude DECIMAL(11, 8) NOT NULL,
  
//   -- Event data
//   title TEXT NOT NULL,
//   description TEXT,
//   emoji TEXT NOT NULL DEFAULT '👽',
//   category TEXT NOT NULL DEFAULT 'social',
  
//   -- Time data
//   start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
//   end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
//   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
//   -- User data
//   creator_user_id TEXT NOT NULL,
//   creator_pubkey TEXT NOT NULL,
//   attendees TEXT[] DEFAULT ARRAY[]::TEXT[],
//   max_attendees INTEGER,
  
//   -- Status
//   is_active BOOLEAN DEFAULT true,
  
//   -- Chat functionality (inherited from portals)
//   chat_enabled BOOLEAN DEFAULT true,
  
//   -- Constraints
//   CONSTRAINT valid_coordinates CHECK (
//     latitude >= -90 AND latitude <= 90 AND
//     longitude >= -180 AND longitude <= 180
//   ),
//   CONSTRAINT valid_times CHECK (end_datetime > start_datetime),
//   CONSTRAINT valid_attendee_limit CHECK (max_attendees IS NULL OR max_attendees > 0)
// );

// -- Simple indexes for performance (without PostGIS)
// CREATE INDEX idx_events_location_lat ON events (latitude);
// CREATE INDEX idx_events_location_lng ON events (longitude);
// CREATE INDEX idx_events_location_combined ON events (latitude, longitude);
// CREATE INDEX idx_events_creator ON events (creator_user_id);
// CREATE INDEX idx_events_time ON events (start_datetime, end_datetime);
// CREATE INDEX idx_events_active ON events (is_active) WHERE is_active = true;
// CREATE INDEX idx_events_category ON events (category);

// -- Enable RLS
// ALTER TABLE events ENABLE ROW LEVEL SECURITY;

// -- Policies
// CREATE POLICY "Anyone can read active events" ON events 
//   FOR SELECT USING (is_active = true);

// CREATE POLICY "Anyone can create events" ON events 
//   FOR INSERT WITH CHECK (true);

// CREATE POLICY "Creators can update their events" ON events 
//   FOR UPDATE USING (creator_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

// CREATE POLICY "Creators can delete their events" ON events 
//   FOR DELETE USING (creator_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

// -- Grant permissions
// GRANT ALL ON events TO anon, authenticated;

// -- Proximity check function using Haversine formula (no PostGIS required)
// CREATE OR REPLACE FUNCTION check_event_proximity_and_create(
//   p_latitude DECIMAL(10, 8),
//   p_longitude DECIMAL(11, 8),
//   p_user_id TEXT,
//   p_title TEXT,
//   p_description TEXT DEFAULT NULL,
//   p_emoji TEXT DEFAULT '🎉',
//   p_category TEXT DEFAULT 'social',
//   p_start_datetime TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
//   p_end_datetime TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '2 hours',
//   p_creator_pubkey TEXT DEFAULT '',
//   p_max_attendees INTEGER DEFAULT NULL
// ) RETURNS JSON AS $$
// DECLARE
//   nearest_distance DECIMAL;
//   new_event_id UUID;
//   result JSON;
//   temp_lat DECIMAL;
//   temp_lng DECIMAL;
//   calculated_distance DECIMAL;
//   earth_radius CONSTANT DECIMAL := 6371000; -- Earth radius in meters
//   lat1_rad DECIMAL;
//   lat2_rad DECIMAL;
//   delta_lat_rad DECIMAL;
//   delta_lng_rad DECIMAL;
//   a DECIMAL;
//   c DECIMAL;
// BEGIN
//   -- Initialize minimum distance
//   nearest_distance := NULL;
  
//   -- Check for nearby active events using Haversine formula
//   FOR temp_lat, temp_lng IN 
//     SELECT latitude, longitude 
//     FROM events 
//     WHERE is_active = true 
//       AND end_datetime > NOW()
//   LOOP
//     -- Convert degrees to radians
//     lat1_rad := RADIANS(p_latitude);
//     lat2_rad := RADIANS(temp_lat);
//     delta_lat_rad := RADIANS(temp_lat - p_latitude);
//     delta_lng_rad := RADIANS(temp_lng - p_longitude);
    
//     -- Haversine formula
//     a := SIN(delta_lat_rad/2) * SIN(delta_lat_rad/2) + 
//          COS(lat1_rad) * COS(lat2_rad) * 
//          SIN(delta_lng_rad/2) * SIN(delta_lng_rad/2);
//     c := 2 * ATAN2(SQRT(a), SQRT(1-a));
//     calculated_distance := earth_radius * c;
    
//     -- Keep track of the nearest distance
//     IF nearest_distance IS NULL OR calculated_distance < nearest_distance THEN
//       nearest_distance := calculated_distance;
//     END IF;
//   END LOOP;

//   -- If there's an event within 10 meters, reject
//   IF nearest_distance IS NOT NULL AND nearest_distance < 10 THEN
//     result := json_build_object(
//       'success', false,
//       'error', 'PROXIMITY_VIOLATION',
//       'message', 'Events can only be created 10+ meters away from existing events',
//       'distance', ROUND(nearest_distance::numeric, 1),
//       'data', null
//     );
//     RETURN result;
//   END IF;

//   -- Create the event
//   INSERT INTO events (
//     latitude, longitude, creator_user_id, title, description, emoji, 
//     category, start_datetime, end_datetime, creator_pubkey, max_attendees,
//     attendees
//   ) VALUES (
//     p_latitude, p_longitude, p_user_id, p_title, p_description, p_emoji,
//     p_category, p_start_datetime, p_end_datetime, p_creator_pubkey, p_max_attendees,
//     ARRAY[p_creator_pubkey]
//   ) RETURNING id INTO new_event_id;

//   -- Return success
//   result := json_build_object(
//     'success', true,
//     'error', null,
//     'message', 'Event created successfully',
//     'distance', null,
//     'data', json_build_object(
//       'id', new_event_id,
//       'latitude', p_latitude,
//       'longitude', p_longitude,
//       'title', p_title,
//       'created_at', NOW()
//     )
//   );
  
//   RETURN result;
// END;
// $$ LANGUAGE plpgsql SECURITY DEFINER;