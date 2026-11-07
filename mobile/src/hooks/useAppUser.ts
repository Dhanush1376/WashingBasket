import { keys, useQuery } from '../lib/query';
import { getUser } from '../services/mock/account.service';
import { useSession } from '../session/session';

/**
 * The signed-in customer: the mock profile, with anything the person entered during onboarding
 * (name, email, phone) taking precedence, so the app greets them by their real details.
 */
export function useAppUser() {
  const { session, guest } = useSession();
  const { data: user } = useQuery(keys.user, getUser);
  const phoneFromSignIn = session?.displayPhone && /\d/.test(session.displayPhone) ? session.displayPhone : undefined;
  const name = session?.profile?.fullName || user?.name || '';
  return {
    guest,
    name,
    firstName: name.split(' ')[0] ?? '',
    phone: phoneFromSignIn ?? user?.phone ?? '',
    email: session?.profile?.email || user?.email || '',
    pincode: session?.pincode,
    user,
  };
}
