import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { fetchEventByShareId } from '../services/supabase';
import { idStore } from '../waku/node';

export const useEventByShareId = (shareId, user) => {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSingleEvent = useCallback(async () => {
    if (!shareId) {
      setEvent(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await fetchEventByShareId(shareId, user?.address);

      if (fetchError) {
        setError(fetchError);
        setEvent(null);
      } else {
        // Add portal compatibility fields
        const formattedEvent = {
          ...data,
          portalId: data.id,
          isMyEvent: data.creator_address === user?.address,
          attendees: data.attendees || [],
          attendeeCount: (data.attendees || []).length,
          profiles: {
            username: data.creator_address === user?.address ? 'You' : 'Event Creator',
            avatar_url: null,
          },
          creator_pubkey: data.creator_address,
        };

        setEvent(formattedEvent);
        
        // Ensure Waku identity exists for this event's chat
        idStore.getPortalIdent(data.id);
      }
    } catch (err) {
      console.error('Error fetching single event:', err);
      setError(err.message);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [shareId, user?.address]);

  useEffect(() => {
    fetchSingleEvent();
  }, [fetchSingleEvent]);

  return { event, loading, error, refetch: fetchSingleEvent };
};

export const useEventSharing = () => {
  const navigate = useNavigate();

  const getEventUrl = (event) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/${event.share_id}`;
  };

  const copyEventUrl = async (event) => {
    try {
      const url = getEventUrl(event);
      await navigator.clipboard.writeText(url);
      return { success: true, url };
    } catch (error) {
      console.error('Copy failed:', error);
      return { success: false, error: error.message };
    }
  };

  const navigateToEvent = (event) => {
    navigate(`/${event.share_id}`);
  };

  const navigateHome = () => {
    navigate('/');
  };

  return {
    getEventUrl,
    copyEventUrl,
    navigateToEvent,
    navigateHome
  };
};