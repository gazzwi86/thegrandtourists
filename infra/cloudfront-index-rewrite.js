// CloudFront Function — viewer-request — JavaScript runtime 2.0
// Rewrites directory requests to serve index.html from S3 (OAC origin)
async function handler(event) {
  var uri = event.request.uri;

  // Trailing slash: /path/ → /path/index.html
  if (uri.endsWith('/')) {
    event.request.uri = uri + 'index.html';
  }
  // No extension: /path → /path/index.html
  else if (!uri.includes('.')) {
    event.request.uri = uri + '/index.html';
  }

  return event.request;
}
