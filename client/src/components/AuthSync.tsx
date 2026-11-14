'use client';

import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import axios from 'axios';

/**
 * Invisible utility component that automatically attaches Clerk authentication
 * credentials (JWT token, user ID, user email, and name) to all outgoing Axios requests.
 * Renders null so it does not alter or impact the UI in any way.
 */
export default function AuthSync() {
  const { userId, getToken, isSignedIn } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    const interceptor = axios.interceptors.request.use(async (config) => {
      try {
        if (userId) {
          config.headers['X-User-Id'] = userId;
        }
        if (user?.primaryEmailAddress?.emailAddress) {
          config.headers['X-User-Email'] = user.primaryEmailAddress.emailAddress;
        }
        if (user?.fullName) {
          config.headers['X-User-Name'] = user.fullName;
        }
        if (isSignedIn) {
          const token = await getToken();
          if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
          }
        }
      } catch (err) {
        // Silently continue if token retrieval fails
      }
      return config;
    });

    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, [userId, getToken, isSignedIn, user]);

  return null;
}
