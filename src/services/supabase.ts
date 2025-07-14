import { createClient } from '@supabase/supabase-js'
import { generateUniqueShareId } from '../utils/shareId';

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

// Helper function to generate coordinate-based event ID
export const generateEventId = (latitude, longitude) => {
  const x = Math.round(latitude * 1000000);
  const y = Math.round(longitude * 1000000);
  return `${x},${y}`;
};

export const fetchEventByShareId = async (shareId, userAddress = null) => {
  try {
    console.log('Fetching event by share ID:', shareId);

    // Set user context if provided
    if (userAddress) {
      const { error: contextError } = await setUserContext(userAddress);
      if (contextError) {
        console.warn('Could not set user context for event fetch:', contextError);
      }
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('share_id', shareId)
      .eq('is_active', true)
      .single(); // Expect single result

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: 'Event not found' };
      }
      console.error('Failed to fetch event:', error);
      return { data: null, error: error.message };
    }

    // Check if event has expired
    const now = new Date();
    const eventEnd = new Date(data.end_datetime);
    if (eventEnd < now) {
      return { data: null, error: 'Event has ended' };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Error fetching event by share ID:', err);
    return { data: null, error: err.message };
  }
};

export const createEvent = async (eventData, user) => {
  try {
    console.log('Creating event with address-based system:', eventData);

    // Set user context for RLS
    const { error: contextError } = await setUserContext(user.address);
    if (contextError) {
      return { data: null, error: `Context error: ${contextError}` };
    }

    // Generate guaranteed unique share ID
    let shareId;
    try {
      shareId = await generateUniqueShareId();
    } catch (shareIdError) {
      console.error('Failed to generate unique share ID:', shareIdError);
      return { data: null, error: 'Failed to generate event link. Please try again.' };
    }

    // Create event with unique share ID
    const { data, error } = await supabase.rpc('check_event_proximity_and_create', {
      p_latitude: eventData.latitude,
      p_longitude: eventData.longitude,
      p_user_address: user.address,
      p_title: eventData.title,
      p_start_datetime: eventData.startDateTime,
      p_end_datetime: eventData.endDateTime,
      p_description: eventData.description || '',
      p_emoji: eventData.emoji || '🎉',
      p_max_attendees: eventData.maxAttendees || null,
      p_image_url: eventData.imageUrl || null,
      p_image_ipfs_hash: eventData.imageIpfsHash || null,
      p_share_id: shareId
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

export const joinEvent = async (eventId: string, userAddress: string) => {
  try {
    console.log('🔍 Joining event with transaction approach:', { eventId, userAddress });

    // Use RPC function for proper transaction handling
    const { data, error } = await supabase.rpc('join_event_with_rls', {
      p_event_id: eventId,
      p_user_address: userAddress
    });

    if (error) {
      console.error('❌ RPC call failed:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    // Parse the JSON response
    const result = data;
    
    console.log('🔍 Join result:', result);
    
    if (!result.success) {
      console.error('❌ Join operation failed:', result.error);
      if (result.debug) {
        console.log('🔍 Debug info:', result.debug);
      }
      throw new Error(result.error);
    }

    console.log('✅ Event joined successfully:', result.data.title);
    return { data: result.data, error: null };

  } catch (err) {
    console.error('❌ Join event failed:', err);
    return { data: null, error: (err as Error).message };
  }
};

export const leaveEvent = async (eventId: string, userAddress: string) => {
  try {
    console.log('🔍 Leaving event with transaction approach:', { eventId, userAddress });

    // Use RPC for proper transaction handling
    const { data, error } = await supabase.rpc('leave_event_with_rls', {
      p_event_id: eventId,
      p_user_address: userAddress
    });

    if (error) {
      console.error('❌ RPC call failed:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    // Parse the JSON response
    const result = data;
    
    console.log('🔍 Leave result:', result);
    
    if (!result.success) {
      console.error('❌ Leave operation failed:', result.error);
      if (result.debug) {
        console.log('🔍 Debug info:', result.debug);
      }
      throw new Error(result.error);
    }

    console.log('✅ Event left successfully:', result.data.title);
    return { data: result.data, error: null };

  } catch (err) {
    console.error('❌ Leave event failed:', err);
    return { data: null, error: (err as Error).message };
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