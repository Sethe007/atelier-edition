export const config = { matcher: ['/'] };

export default async function middleware(request) {
  return Response.redirect('https://scrivaelo.com/login/?mw_test=1', 302);
}