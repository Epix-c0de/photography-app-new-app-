import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '@/services/client';

export function usePhotographerAssignment() {
  const [needsAssignment, setNeedsAssignment] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkAssignment();
  }, []);

  const checkAssignment = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setNeedsAssignment(false);
        setLoading(false);
        return;
      }

      // Check if user needs assignment
      const { data, error } = await supabase.rpc('client_needs_assignment', {
        p_client_id: user.id
      });

      if (error) {
        console.error('Error checking assignment:', error);
        setNeedsAssignment(false);
      } else {
        setNeedsAssignment(data === true);
        
        // If needs assignment and not on assignment screen, redirect
        if (data === true && segments[0] !== 'photographer-assignment') {
          router.replace('/photographer-assignment');
        }
      }
    } catch (error) {
      console.error('Assignment check failed:', error);
      setNeedsAssignment(false);
    } finally {
      setLoading(false);
    }
  };

  return { needsAssignment, loading, recheckAssignment: checkAssignment };
}
