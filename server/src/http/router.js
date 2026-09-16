// http/router.js — 메서드 + 경로 패턴 매칭. ':이름' 자리는 params로 들어옵니다.

export function createRouter() {
  const routes = [];

  const add = (method, pattern, handler) => {
    const names = [];
    const re = new RegExp('^' + pattern.replace(/:[A-Za-z_]\w*/g, m => {
      names.push(m.slice(1));
      return '([^/]+)';
    }) + '$');
    routes.push({ method, re, names, handler });
  };

  return {
    get: (p, h) => add('GET', p, h),
    post: (p, h) => add('POST', p, h),
    put: (p, h) => add('PUT', p, h),
    delete: (p, h) => add('DELETE', p, h),

    /** 맞는 라우트를 찾아 실행. 없으면 false */
    async handle(req, res, ctx) {
      const url = new URL(req.url, 'http://localhost');
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(url.pathname);
        if (!m) continue;
        const params = {};
        r.names.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
        await r.handler(req, res, { ...ctx, params, query: url.searchParams });
        return true;
      }
      return false;
    },
  };
}
