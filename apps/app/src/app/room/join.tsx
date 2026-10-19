import { Redirect, useLocalSearchParams } from 'expo-router';

/** Vecchi link d'invito (/room/join?code=ABCD): ora si entra direttamente dalla home. */
export default function JoinRedirect() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <Redirect href={code ? { pathname: '/', params: { code } } : '/'} />;
}
