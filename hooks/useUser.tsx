import type { User } from '@supabase/auth-helpers-nextjs';
import { useSessionContext, useUser as useSupaUser } from '@supabase/auth-helpers-react';
import type { UserDetails } from '@/types';
import { useState, createContext, useEffect, useContext } from 'react';

//* Define a type for the user context
type UserContextType = {
  accessToken: string | null;
  user: User | null;
  userDetails: UserDetails | null;
  isLoading: boolean;
};

//* Create a user context with the above type
export const UserContext = createContext<UserContextType | undefined>(undefined);

//* Define a interface for component props
export interface Props {
  [propName: string]: any;
}

//* Define a user context provider component
export const MyUserContextProvider = (props: Props) => {
  //* Use the session context hook to get the session and loading status
  const { session, isLoading: isLoadingUser, supabaseClient: supabase } = useSessionContext();

  //* Use the Supabase user hook to get the user
  const user = useSupaUser();

  //* Get the access token from the session, or null if it doesn't exist
  const accessToken = session?.access_token ?? null;

  //* Create a state for loading data and user details
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);

  //* Define function to get user details from Supabase
  const getUserDetails = () => supabase.from('users').select('*').single();

  //* Fetch user info
  useEffect(() => {
    //* If user exists and data is not loading, fetch data
    if (user && !isLoadingData && !userDetails) {
      setIsLoadingData(true);

      //* Fetch user details
      getUserDetails().then(({ data, error }) => {
        if (error) {
          console.error('Error fetching user details:', error);
        } else {
          setUserDetails(data as UserDetails);
        }
        setIsLoadingData(false);
      });
    } else if (!user && !isLoadingUser && !isLoadingData) {
      //* If user does not exist and data is not loading, reset user details
      setUserDetails(null);
    }
  }, [user, isLoadingUser]); //* Run effect when user or loading user state changes

  //* Define the value to pass to the user context
  const value = {
    accessToken,
    user,
    userDetails,
    isLoading: isLoadingUser || isLoadingData,
  };

  return <UserContext.Provider value={value} {...props} />;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a MyUserContextProvider');
  }
  return context;
};
