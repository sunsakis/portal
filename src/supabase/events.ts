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

const setUserContext = async (userAddress) => {
  if (!userAddress) {
    console.warn('No user address provided for context setting');
    return { error: 'No user address provided' };
  }

  try {
    console.log('🔧 Setting user context for:', userAddress);
    
    // Call the function and wait for completion
    const { data, error } = await supabase.rpc('set_current_user_context', {
      user_address: userAddress
    });

    if (error) {
      console.error('❌ Failed to set user context:', error);
      return { error: error.message };
    }

    // Verify the context was set correctly
    const { data: verification, error: verifyError } = await supabase.rpc('get_current_user_setting');
    
    if (verifyError) {
      console.error('❌ Failed to verify user context:', verifyError);
      return { error: 'Failed to verify context' };
    }

    console.log('🔍 Context verification:', {
      expected: userAddress,
      actual: verification,
      matches: verification === userAddress
    });

    if (verification !== userAddress) {
      return { error: `Context mismatch: expected ${userAddress}, got ${verification}` };
    }

    console.log('✅ User context set and verified successfully');
    return { error: null };
  } catch (err) {
    console.error('❌ Error setting user context:', err);
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

export const cancelEvent = async (eventId: string, userAddress: string) => {
  try {
    console.log('🔍 Cancelling event with working transaction approach:', { eventId, userAddress });

    // Use the transaction-based cancel function that we know works
    const { data, error } = await supabase.rpc('cancel_event_with_rls', {
      p_event_id: eventId,
      p_user_address: userAddress
    });

    if (error) {
      console.error('❌ RPC call failed:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    // Parse the JSON response
    const result = data;
    
    console.log('🔍 Cancel result:', result);
    
    if (!result.success) {
      console.error('❌ Cancel operation failed:', result.error);
      if (result.debug) {
        console.log('🔍 Debug info:', result.debug);
      }
      throw new Error(result.error);
    }

    console.log('✅ Event cancelled successfully:', result.data.title);
    return { data: result.data, error: null };

  } catch (err) {
    console.error('❌ Cancel event failed:', err);
    return { data: null, error: (err as Error).message };
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