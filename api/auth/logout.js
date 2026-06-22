export const config = { runtime: 'edge' };

// Clears the sv_session cookie and sends the user to the login page with a
// logout flag so the site also signs out of Supabase. Reachable without auth
// (middleware matcher excludes /api/).
export default async function handler(request) {
  const headers = new Headers();
  headers.set('Location', 'https://scrivaelo.com/login/?logout=1');
  headers.set('Set-Cookie', 'sv_session=; Domain=.scrivaelo.com; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly');
  headers.set('Cache-Control', 'no-store');
  return new Response(null, { status: 302, headers });
}
