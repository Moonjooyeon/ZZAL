// ai/client.js — Claude 호출 한 군데로.
//
// SDK는 여기서만, 그것도 키가 있을 때만 불러옵니다(지연 import).
// 그래서 ANTHROPIC_API_KEY 없이도 서버는 npm install 없이 그대로 뜹니다.
import { config } from '../config.js';

let clientPromise = null;

export const aiEnabled = () => !!config.ai.apiKey;

async function getClient() {
  if (!aiEnabled()) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        return new Anthropic({
          apiKey: config.ai.apiKey,
          ...(config.ai.baseUrl ? { baseURL: config.ai.baseUrl } : {}),
        });
      } catch (e) {
        console.error('[ai] @anthropic-ai/sdk를 불러오지 못했습니다. `cd server && npm install` 후 다시 시도하세요.');
        return null;
      }
    })();
  }
  return clientPromise;
}

/**
 * 스키마에 맞는 JSON 하나를 돌려받습니다.
 * @param {object} o
 * @param {string} o.system      고정 지시문 — 캐시가 걸리도록 매 호출 같은 문자열을 넘기세요
 * @param {Array}  o.content     user 콘텐츠 블록 (텍스트/이미지)
 * @param {object} o.schema      JSON Schema
 * @param {string} [o.effort]    low | medium | high
 * @returns {Promise<?object>}   실패하면 null — 호출한 쪽은 AI 없이도 동작해야 합니다
 */
export async function askJson({ system, content, schema, effort = 'low', maxTokens = 2000 }) {
  const client = await getClient();
  if (!client) return null;

  try {
    const res = await client.messages.create({
      model: config.ai.model,
      max_tokens: maxTokens,
      // 고정 지시문을 캐시해 반복 호출 비용을 줄입니다
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
      output_config: {
        effort,
        format: { type: 'json_schema', schema },
      },
    });

    if (res.stop_reason === 'refusal') {
      console.warn('[ai] 요청이 거절되었습니다:', res.stop_details?.category);
      return null;
    }
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    console.error('[ai] 호출 실패:', e && e.message ? e.message : e);
    return null;
  }
}
