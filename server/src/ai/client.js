// ai/client.js — Cafe24 LLM Router 호출 한 군데로.
//
// OpenAI 호환 SDK는 여기서만, 키가 있을 때만 지연 import합니다.
import { config } from '../config.js';
import { getDb } from '../db/index.js';

let clientPromise = null;

export const aiEnabled = () => !!config.ai.apiKey;

async function getClient() {
  if (!aiEnabled()) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const { default: OpenAI } = await import('openai');
        return new OpenAI({
          apiKey: config.ai.apiKey,
          baseURL: config.ai.baseUrl,
        });
      } catch (e) {
        console.error('[ai] openai SDK를 불러오지 못했습니다. `cd server && npm install` 후 다시 시도하세요.');
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
 * @param {string} o.feature     search_assist | meme_enrichment
 * @returns {Promise<?object>}   실패하면 null — 호출한 쪽은 AI 없이도 동작해야 합니다
 */
export async function askJson({ system, content, schema, feature, effort = 'low', maxTokens = 2000 }) {
  const client = await getClient();
  if (!client) return null;

  const started = Date.now();
  let status = 'error';
  let inputTokens = null;
  let outputTokens = null;
  let errorCode = null;
  try {
    const userContent = content.map(block => block.type === 'image'
      ? { type: 'image_url', image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` } }
      : block);
    const res = await client.chat.completions.create({
      model: config.ai.model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'zzal_result', strict: true, schema },
      },
    });
    inputTokens = res.usage?.prompt_tokens ?? null;
    outputTokens = res.usage?.completion_tokens ?? null;
    if (res.choices?.[0]?.message?.refusal) {
      status = 'refusal';
      return null;
    }
    const text = res.choices?.[0]?.message?.content;
    if (!text) return null;
    const result = JSON.parse(text);
    status = 'success';
    return result;
  } catch (e) {
    errorCode = String(e?.code || e?.name || 'unknown').slice(0, 80);
    console.error('[ai] 호출 실패:', e && e.message ? e.message : e);
    return null;
  } finally {
    try {
      const db = await getDb();
      await db.aiRequests.record({ feature, model: config.ai.model, status, inputTokens,
        outputTokens, latencyMs: Date.now() - started, errorCode });
    } catch (error) {
      console.warn('[ai] 사용량 기록 실패:', error?.message || error);
    }
  }
}
