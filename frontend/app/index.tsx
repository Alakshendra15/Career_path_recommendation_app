import { Redirect } from 'expo-router';
import { useAuth } from '../src/store/auth';

/** Entry point: send the user where their session state says they belong. */
export default function Index() {
  const status = useAuth((s) => s.status);
  const completed = useAuth((s) => !!s.profile?.completed);
  if (status !== 'signedIn') return <Redirect href="/welcome" />;
  return <Redirect href={completed ? '/career' : '/onboarding'} />;
}
