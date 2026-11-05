export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url)
  const target = new URL(url.pathname + url.search, 'https://dukavo-backend.ethiodeploy.app')
  const req = new Request(target, request)
  req.headers.set('X-Forwarded-Host', url.host)
  return fetch(req)
}
