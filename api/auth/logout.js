export const config = { runtime: 'edge' };

// Clears the sv_session cookie and returns the user to the login page.
// Reachable without auth (middleware matcher excludes /api/).
export default async function handler(request) {
  const rawNext = new URL(request.url).searchParams.get('next') || '/login/';
  const path = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/login/';
  const headers = new Headers();
  headers.set('Location', 'https://scrivaelo.com' + path);
  headers.set('Set-Cookie', 'sv_session=; Domain=.scrivaelo.com; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly');
  headers.set('Cache-Control', 'no-store');
  return new Response(null, { status: 302, headers });
}
