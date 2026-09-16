// http/static.js — 개발할 때 프론트를 같은 서버에서 같이 띄우기 위한 것.
// 배포에서는 정적 호스팅(Render Static Site 등)이 이 역할을 대신합니다.
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

export function serveStatic(root) {
  return (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';

    // 루트 밖으로 나가는 경로는 거부합니다
    const file = path.join(root, rel);
    if (!file.startsWith(path.resolve(root) + path.sep)) { res.writeHead(403); res.end(); return true; }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;

    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': fs.statSync(file).size,
    });
    fs.createReadStream(file).pipe(res);
    return true;
  };
}
