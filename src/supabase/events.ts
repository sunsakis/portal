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

// Helper function to set user context for RLS (now uses address)
const setUserContext = async (userAddress) => {
  if (!userAddress) {
    console.warn('No user address provided for context setting');
    return { error: 'No user address provided' };
  }

  try {
    const { error } = await supabase.rpc('set_current_user_context', {
      user_address: userAddress
    });

    if (error) {
      console.error('Failed to set user context:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (err) {
    console.error('Error setting user context:', err);
    return { error: err.message };
  }
};

// Helper function to generate coordinate-based event ID (matches database function)
export const generateEventId = (latitude, longitude) => {
  const x = Math.round(latitude * 1000000);
  const y = Math.round(longitude * 1000000);
  return `${x},${y}`;
};

// Event management functions (updated for address-based system)
export const createEvent = async (eventData, user) => {
  try {
    console.log('Creating event with address-based system:', eventData);

    // Set user context for RLS (now uses address instead of publicKey)
    const { error: contextError } = await setUserContext(user.address);
    if (contextError) {
      return { data: null, error: `Context error: ${contextError}` };
    }

    const { data, error } = await supabase.rpc('check_event_proximity_and_create', {
      p_latitude: eventData.latitude,
      p_longitude: eventData.longitude,
      p_user_address: user.address, // Use address instead of publicKey
      p_title: eventData.title,
      p_description: eventData.description || '',
      p_emoji: eventData.emoji || '🎉',
      p_start_datetime: eventData.startDateTime,
      p_end_datetime: eventData.endDateTime,
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

export const joinEvent = async (eventId, userAddress) => {
  try {
    // Set user context for RLS
    const { error: contextError } = await setUserContext(userAddress);
    if (contextError) {
      throw new Error(`Context error: ${contextError}`);
    }

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
    if (event.attendees.includes(userAddress)) {
      throw new Error('Already attending this event');
    }

    // Check capacity
    if (event.max_attendees && event.attendees.length >= event.max_attendees) {
      throw new Error('Event is full');
    }

    // Add user to attendees
    const updatedAttendees = [...event.attendees, userAddress];

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

export const leaveEvent = async (eventId, userAddress) => {
  try {
    // Set user context for RLS
    const { error: contextError } = await setUserContext(userAddress);
    if (contextError) {
      throw new Error(`Context error: ${contextError}`);
    }

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
    if (!event.attendees.includes(userAddress)) {
      throw new Error('Not attending this event');
    }

    // Prevent creator from leaving
    if (event.creator_address === userAddress) {
      throw new Error('Cannot leave your own event.');
    }

    // Remove user from attendees
    const updatedAttendees = event.attendees.filter(address => address !== userAddress);

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

// Ultra-comprehensive debug version to find the exact issue
export const cancelEvent = async (eventId, userAddress) => {
  try {
    console.log('🔍 COMPREHENSIVE DEBUG: Starting cancel process');
    console.log('📋 Input params:', { eventId, userAddress });

    // STEP 1: Set user context
    console.log('\n=== STEP 1: Setting User Context ===');
    const { error: contextError } = await setUserContext(userAddress);
    if (contextError) {
      console.error('❌ Context error:', contextError);
    } else {
      console.log('✅ Context set successfully');
    }

    // STEP 2: Verify context was set
    console.log('\n=== STEP 2: Verifying Context ===');
    try {
      const { data: setting, error: settingError } = await supabase.rpc('get_current_user_setting');
      console.log('🔍 Current setting:', { setting, settingError, matches: setting === userAddress });
    } catch (err) {
      console.log('⚠️ Could not check setting:', err.message);
    }

    // STEP 3: Check RLS policies
    console.log('\n=== STEP 3: Checking RLS Policies ===');
    try {
      const { data: policies, error: policyError } = await supabase
        .from('pg_policies')
        .select('policyname, cmd, qual')
        .eq('tablename', 'events');
      console.log('🔍 Active policies:', policies);
    } catch (err) {
      console.log('⚠️ Could not check policies:', err.message);
    }

    // STEP 4: Verify event exists
    console.log('\n=== STEP 4: Event Existence Check ===');
    const { data: eventCheck, error: eventError, count: eventCount } = await supabase
      .from('events')
      .select('*', { count: 'exact' })
      .eq('id', eventId);

    console.log('🔍 Event check result:', { 
      eventCheck, 
      eventError, 
      eventCount,
      found: eventCheck && eventCheck.length > 0 
    });

    if (eventError) {
      throw new Error('Event fetch failed: ' + eventError.message);
    }

    if (!eventCheck || eventCheck.length === 0) {
      throw new Error('Event not found');
    }

    const event = eventCheck[0];
    console.log('📋 Event details:', {
      id: event.id,
      title: event.title,
      creator_address: event.creator_address,
      is_active: event.is_active,
      attendees: event.attendees
    });

    // STEP 5: Ownership verification
    console.log('\n=== STEP 5: Ownership Verification ===');
    const ownershipMatch = event.creator_address === userAddress;
    console.log('🔍 Ownership check:', {
      eventCreator: event.creator_address,
      currentUser: userAddress,
      matches: ownershipMatch,
      creatorLength: event.creator_address.length,
      userLength: userAddress.length,
      caseSensitive: event.creator_address.toLowerCase() === userAddress.toLowerCase()
    });

    if (!ownershipMatch) {
      throw new Error(`Ownership mismatch: Event creator "${event.creator_address}" !== User "${userAddress}"`);
    }

    if (!event.is_active) {
      throw new Error('Event is already cancelled');
    }

    // STEP 6: Test different update approaches
    console.log('\n=== STEP 6: Testing Update Approaches ===');

    // Approach 1: Basic update with both filters
    console.log('🔄 Approach 1: Basic update with filters...');
    const { data: data1, error: error1, status: status1, statusText: statusText1 } = await supabase
      .from('events')
      .update({ is_active: false })
      .eq('id', eventId)
      .eq('creator_address', userAddress)
      .select('*');

    console.log('🔍 Approach 1 result:', { 
      data: data1, 
      error: error1, 
      status: status1, 
      statusText: statusText1,
      dataLength: data1 ? data1.length : 0 
    });

    if (error1) {
      console.error('❌ Approach 1 error details:', {
        message: error1.message,
        details: error1.details,
        hint: error1.hint,
        code: error1.code
      });
    }

    if (data1 && data1.length > 0) {
      console.log('✅ Approach 1 succeeded!');
      return { data: data1[0], error: null };
    }

    // Approach 2: Update with only ID filter
    console.log('🔄 Approach 2: Update with only ID filter...');
    const { data: data2, error: error2 } = await supabase
      .from('events')
      .update({ is_active: false })
      .eq('id', eventId)
      .select('*');

    console.log('🔍 Approach 2 result:', { 
      data: data2, 
      error: error2,
      dataLength: data2 ? data2.length : 0 
    });

    if (error2) {
      console.error('❌ Approach 2 error:', error2);
    }

    if (data2 && data2.length > 0) {
      // Verify we updated the right event
      const updated = data2[0];
      if (updated.creator_address === userAddress) {
        console.log('✅ Approach 2 succeeded!');
        return { data: updated, error: null };
      } else {
        // Rollback
        await supabase
          .from('events')
          .update({ is_active: true })
          .eq('id', eventId);
        throw new Error('Security violation: Updated wrong event');
      }
    }

    // Approach 3: Use upsert
    console.log('🔄 Approach 3: Using upsert...');
    const { data: data3, error: error3 } = await supabase
      .from('events')
      .upsert({ 
        id: eventId,
        is_active: false,
        // Include other required fields to avoid constraint errors
        latitude: event.latitude,
        longitude: event.longitude,
        title: event.title,
        creator_address: event.creator_address,
        start_datetime: event.start_datetime,
        end_datetime: event.end_datetime
      })
      .select('*');

    console.log('🔍 Approach 3 result:', { 
      data: data3, 
      error: error3,
      dataLength: data3 ? data3.length : 0 
    });

    if (data3 && data3.length > 0) {
      console.log('✅ Approach 3 succeeded!');
      return { data: data3[0], error: null };
    }

    // STEP 7: Check database constraints
    console.log('\n=== STEP 7: Checking Constraints ===');
    try {
      const { data: constraints } = await supabase
        .rpc('check_table_constraints', { table_name: 'events' })
        .single();
      console.log('🔍 Table constraints:', constraints);
    } catch (err) {
      console.log('⚠️ Could not check constraints:', err.message);
    }

    // If we get here, nothing worked
    throw new Error('All update approaches failed - this is a deep database issue');

  } catch (err) {
    console.error('❌ Comprehensive debug error:', err);
    return { data: null, error: err.message };
  }
};

export const fetchEvents = async (userAddress = null) => {
  try {
    // Set user context if provided (for RLS)
    if (userAddress) {
      const { error: contextError } = await setUserContext(userAddress);
      if (contextError) {
        console.warn('Could not set user context for fetch:', contextError);
        // Continue anyway since read operations might still work
      }
    }

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


// -- SIMPLIFIED DATABASE SCHEMA WITH ADDRESSES AND COORDINATE IDS

// -- Drop existing table and related objects
// DROP TABLE IF EXISTS events CASCADE;
// DROP FUNCTION IF EXISTS check_event_proximity_and_create CASCADE;
// DROP FUNCTION IF EXISTS set_current_user_context CASCADE;
// DROP FUNCTION IF EXISTS get_current_user_setting CASCADE;

// -- Create events table with simplified IDs
// CREATE TABLE events (
//   -- Use coordinate-based ID as primary key (matches portal system)
//   id TEXT PRIMARY KEY, -- Format: "lat_micro,lng_micro" e.g., "56871370,24025852"
  
//   -- Location data (for proximity checks)
//   latitude DECIMAL(10, 8) NOT NULL,
//   longitude DECIMAL(11, 8) NOT NULL,
  
//   -- Event data
//   title TEXT NOT NULL,
//   description TEXT,
//   emoji TEXT NOT NULL DEFAULT '👽',
  
//   -- Time data
//   start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
//   end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
//   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
//   -- Use Ethereum address as creator ID (42 chars, familiar format)
//   creator_address TEXT NOT NULL, -- e.g., "0x742d35Cc6B4B0532d3D8B"
//   attendees TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of addresses
//   max_attendees INTEGER,
  
//   -- Status
//   is_active BOOLEAN DEFAULT true,
  
//   -- Chat functionality
//   chat_enabled BOOLEAN DEFAULT true,
  
//   -- Constraints
//   CONSTRAINT valid_coordinates CHECK (
//     latitude >= -90 AND latitude <= 90 AND
//     longitude >= -180 AND longitude <= 180
//   ),
//   CONSTRAINT valid_times CHECK (end_datetime > start_datetime),
//   CONSTRAINT valid_attendee_limit CHECK (max_attendees IS NULL OR max_attendees > 0),
//   CONSTRAINT valid_creator_address CHECK (creator_address ~ '^0x[a-fA-F0-9]{40}$'),
//   CONSTRAINT valid_id_format CHECK (id ~ '^-?[0-9]+,-?[0-9]+$')
// );

// -- Indexes optimized for new structure
// CREATE INDEX idx_events_location_lat ON events (latitude);
// CREATE INDEX idx_events_location_lng ON events (longitude);
// CREATE INDEX idx_events_location_combined ON events (latitude, longitude);
// CREATE INDEX idx_events_creator_address ON events (creator_address);
// CREATE INDEX idx_events_time ON events (start_datetime, end_datetime);
// CREATE INDEX idx_events_active ON events (is_active) WHERE is_active = true;
// CREATE INDEX idx_events_attendees ON events USING gin(attendees);

// -- Enable RLS
// ALTER TABLE events ENABLE ROW LEVEL SECURITY;

// -- Helper function to set user context for RLS
// CREATE OR REPLACE FUNCTION set_current_user_context(user_address TEXT)
// RETURNS void
// LANGUAGE plpgsql
// SECURITY DEFINER
// AS $$
// BEGIN
//   -- Set the current user's address in the session
//   PERFORM set_config('app.current_user_address', user_address, true);
  
//   -- Log for debugging (remove in production)
//   RAISE NOTICE 'User context set to: %', user_address;
// END;
// $$;

// -- Helper function to check current setting
// CREATE OR REPLACE FUNCTION get_current_user_setting()
// RETURNS TEXT
// LANGUAGE sql
// SECURITY DEFINER
// AS $$
//   SELECT current_setting('app.current_user_address', true);
// $$;

// -- Helper function to generate coordinate-based ID
// CREATE OR REPLACE FUNCTION generate_event_id(lat DECIMAL, lng DECIMAL)
// RETURNS TEXT
// LANGUAGE sql
// IMMUTABLE
// AS $$
//   SELECT ROUND(lat * 1000000)::TEXT || ',' || ROUND(lng * 1000000)::TEXT;
// $$;

// -- RLS policies for simplified identity
// CREATE POLICY "Anyone can read active events" ON events 
//   FOR SELECT USING (is_active = true);

// CREATE POLICY "Anyone can create events" ON events 
//   FOR INSERT WITH CHECK (true);

// CREATE POLICY "Creators can update their events via address" ON events 
//   FOR UPDATE USING (
//     creator_address = current_setting('app.current_user_address', true)
//   );

// CREATE POLICY "Creators can delete their events via address" ON events 
//   FOR DELETE USING (
//     creator_address = current_setting('app.current_user_address', true)
//   );

// -- Simplified proximity check function
// CREATE OR REPLACE FUNCTION check_event_proximity_and_create(
//   p_latitude DECIMAL(10, 8),
//   p_longitude DECIMAL(11, 8),
//   p_user_address TEXT,
//   p_title TEXT,
//   p_description TEXT DEFAULT NULL,
//   p_emoji TEXT DEFAULT '🎉',
//   p_start_datetime TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
//   p_end_datetime TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '2 hours',
//   p_max_attendees INTEGER DEFAULT NULL
// ) 
// RETURNS JSON 
// LANGUAGE plpgsql 
// SECURITY DEFINER
// AS $$
// DECLARE
//   nearest_distance DECIMAL;
//   event_id TEXT;
//   result JSON;
//   temp_lat DECIMAL;
//   temp_lng DECIMAL;
//   calculated_distance DECIMAL;
//   earth_radius CONSTANT DECIMAL := 6371000;
//   lat1_rad DECIMAL;
//   lat2_rad DECIMAL;
//   delta_lat_rad DECIMAL;
//   delta_lng_rad DECIMAL;
//   a DECIMAL;
//   c DECIMAL;
// BEGIN
//   -- Set user context for RLS
//   PERFORM set_config('app.current_user_address', p_user_address, true);
  
//   -- Generate coordinate-based ID
//   event_id := generate_event_id(p_latitude, p_longitude);
  
//   -- Check if event already exists at this exact location
//   IF EXISTS (SELECT 1 FROM events WHERE id = event_id AND is_active = true) THEN
//     result := json_build_object(
//       'success', false,
//       'error', 'LOCATION_TAKEN',
//       'message', 'An active event already exists at this exact location',
//       'distance', 0,
//       'data', null
//     );
//     RETURN result;
//   END IF;
  
//   -- Initialize minimum distance
//   nearest_distance := NULL;
  
//   -- Check for nearby active events using Haversine formula
//   FOR temp_lat, temp_lng IN 
//     SELECT latitude, longitude 
//     FROM events 
//     WHERE is_active = true 
//       AND end_datetime > NOW()
//       AND id != event_id -- Exclude the current location
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

//   -- Create the event with coordinate-based ID and address
//   INSERT INTO events (
//     id, latitude, longitude, creator_address, title, description, emoji, 
//     start_datetime, end_datetime, max_attendees, attendees
//   ) VALUES (
//     event_id, p_latitude, p_longitude, p_user_address, p_title, p_description, p_emoji,
//     p_start_datetime, p_end_datetime, p_max_attendees,
//     ARRAY[p_user_address] -- Creator automatically attends
//   );

//   -- Return success
//   result := json_build_object(
//     'success', true,
//     'error', null,
//     'message', 'Event created successfully',
//     'distance', null,
//     'data', json_build_object(
//       'id', event_id,
//       'latitude', p_latitude,
//       'longitude', p_longitude,
//       'title', p_title,
//       'creator_address', p_user_address,
//       'created_at', NOW()
//     )
//   );
  
//   RETURN result;
// END;
// $$;

// -- Grant execute permissions
// GRANT EXECUTE ON FUNCTION set_current_user_context(TEXT) TO anon, authenticated;
// GRANT EXECUTE ON FUNCTION get_current_user_setting() TO anon, authenticated;
// GRANT EXECUTE ON FUNCTION generate_event_id(DECIMAL, DECIMAL) TO anon, authenticated;
// GRANT EXECUTE ON FUNCTION check_event_proximity_and_create(
//   DECIMAL(10, 8), DECIMAL(11, 8), TEXT, TEXT, TEXT, TEXT, 
//   TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER
// ) TO anon, authenticated;

// -- Grant table permissions
// GRANT ALL ON events TO anon, authenticated;