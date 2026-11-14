/**
 * dsh-dafeiyu-zh-thinking — Host half.
 *
 * Appends one short reminder to the tail of every prepared request so the model
 * reasons in Chinese.
 *
 * Why this exists: the system prompt already carries the rule (persona prefix +
 * suffix at order 10200) and a brand-new session obeys it. A long session does
 * not, because thousands of tokens of its own earlier English reasoning outvote
 * one instruction far away at the top. The last thing before generation is the
 * only position with real weight, so it goes there.
 *
 * Modelled on the harness's own time-context plugin: same `agent/pre-step`
 * middleware, same `createUserMessage` shape, same `source.form: 'snapshot'`.
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm';

const NAME = 'dafeiyu-zh-thinking';

const DEFAULT_TEXT =
  '提醒：这一步的推理流（thinking）也要用中文写。技术名词、代码、命令、路径可以保留英文，但句子必须是中文，不要切回英文。';

export function apply(ctx, config = {}) {
  const text =
    typeof config.text === 'string' && config.text.trim() !== '' ? config.text : DEFAULT_TEXT;
  const every = Number.isInteger(config.every) && config.every > 0 ? config.every : 1;

  ctx.effect(
    () =>
      ctx.on(
        'agent/pre-step',
        async (payload, next) => {
          const decision = await next();
          if (decision.kind === 'reject') return decision;

          const step = payload && typeof payload.step === 'number' ? payload.step : 1;
          if (step % every !== 0) return decision;

          return {
            ...decision,
            messages: [
              ...decision.messages,
              createUserMessage({
                content: [{ type: 'text', text }],
                source: { kind: NAME, form: 'snapshot', sections: [{ name: NAME, text }] },
              }),
            ],
          };
        },
        { prepend: true },
      ),
    'dafeiyu-zh-thinking: per-step reasoning-language reminder',
  );
}
