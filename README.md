# dsh-dafeiyu-zh-thinking

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 用的宿主插件：**在每次请求的末尾追加一句提醒，让模型用中文写推理流（thinking）。**

## 它解决什么

系统提示里写「请用中文思考」通常没用。实测下来：

| 场景 | 结果 |
|---|---|
| 全新会话 | 有效，推理是中文 |
| 跑久的长会话 | **失效**，推理回到英文 |

原因不在配置，在**位置**：长会话里已经堆了几万 token 的英文推理，模型倾向于延续自己上一次的语言习惯，一句远在提示词头部的话压不住。换模型也救不回来——真正的变量是上下文里已经存在的语言。

这个插件挂在 `agent/pre-step`，把提醒塞进 `decision.messages` 的末尾，正好是模型开口前的最后一句。

## 安装

```sh
dsh plugin add github:sblzc/dsh-dafeiyu-zh-thinking
```

安装后**重启 DSH** 生效（宿主插件在启动时装配）。

## 配置

默认每步提醒一次。想省 token 就在 profile 的 `cordis.patch.yml` 里调：

```yaml
- id: dafeiyu-zh-thinking
  name: dsh-dafeiyu-zh-thinking
  config:
    every: 3                    # 每 N 步提醒一次，默认 1
    text: "自定义提醒文本"        # 不写则用内置文案
```

## 局限（请务必读完）

- **是软约束，不是开关。** 它提高概率，不提供保证。模型仍可能不听话。
- **每步都会在会话里留下一条 user 级消息**，刷新后能在对话记录里看到。嫌吵就调大 `every`。
- **有 token 成本。** 一条约 40 token，每步一次。长任务会累积。
- **只对下一次请求生效**，不能改写已经生成的推理；也不做翻译。
- **只对支持 reasoning 的模型有意义**，不推理的模型装了等于没装。
- **对子 agent 同样生效**，不只是主会话。
- **依赖 harness 内部事件**（`agent/pre-step`）和 `@deepseek-ai/dsh-llm` 的 `createUserMessage`，属于非公开稳定 API。DSH 升级后可能失效——失效时表现为插件加载警告或提醒不再出现，不会静默改坏其它东西。
- **要有 100% 的确定性，只能用关推理**：把 `reasoningEffort` 调到最低。本插件不做这件事。

## 工作原理

复用 harness 自身 `time-context` 插件的接法：

```js
ctx.on('agent/pre-step', async (payload, next) => {
  const decision = await next();
  if (decision.kind === 'reject') return decision;
  return {
    ...decision,
    messages: [...decision.messages, createUserMessage({
      content: [{ type: 'text', text }],
      source: { kind: NAME, form: 'snapshot', sections: [{ name: NAME, text }] },
    })],
  };
}, { prepend: true });
```

`prepend: true` 让它成为最外层中间件，追加的消息因此落在最后。

## License

MIT
