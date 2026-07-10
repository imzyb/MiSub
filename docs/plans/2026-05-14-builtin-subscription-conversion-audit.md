# MiSub 内置订阅转换梳理计划清单

> **For Hermes:** 后续实现阶段使用 `subagent-driven-development` skill，按任务逐项执行、逐项验证。

**Goal:** 系统梳理 MiSub 内置订阅转换链路，明确当前架构、重复逻辑、兼容性风险与测试缺口，并形成可执行的重构/修复顺序。

**Architecture:** 当前内置转换有两条主线：一条是 `builtin-*-generator.js` 直接生成各客户端配置；另一条是 `builtin-template-registry.js` 的 ini 模板经 `template-pipeline.js` 解析为统一模型，再由 `template-renderers/*` 输出不同客户端格式。入口由 `main-handler.js` 根据 engine、target、templateSource、ruleLevel、UA 等组合决定，最终由 `ProcessorService.renderOutput()` 调度。

**Tech Stack:** Cloudflare Pages Functions / JavaScript ESM / Vue 3 / Vitest / js-yaml。

**Execution Boundary:** 本轮只做查缺补漏与测试加固，不能影响当前已正常工作的订阅转换能力。默认不改运行逻辑、不改默认配置、不调整现有模板输出；任何发现的问题先用测试或文档记录，只有确认是明确 bug 且有回归保护时才做最小修复。

**Non-goals:**
- 不做大重构。
- 不移除现有生成器或模板。
- 不改变当前默认内置转换行为。
- 不改变用户已有订阅链接的输出格式。
- 不为了“统一”而改动已经可用的客户端兼容路径。

**Safety Rules:**
- 先补测试，后考虑修复。
- 每次改动只覆盖一个风险点。
- 优先新增测试文件或补充断言，避免触碰生产路径。
- 如果测试暴露差异但当前行为可用，先标记为“待确认”，不直接修。
- 每一步都跑定向测试；最终再跑 `npm run test:run` 和 `npm run build`。

---

## 0. 当前入口与关键文件盘点

### 请求入口
- `functions/modules/subscription/main-handler.js`
  - `resolveEffectiveEngine()`：决定 builtin / external。
  - `resolveTemplateUrl()` / `resolveTemplateSource()`：解析全局/订阅组模板来源。
  - `resolveBuiltinEngineFlags()`：builtin 与 external 模式下 UDP / skip-cert 参数行为。
  - `ruleLevel` 解析：URL 参数 > 订阅组 > 全局；remote template 时强制 `none`。
  - `shouldUseBuiltin`：支持 `clash`、`egern`、`surge*`、`loon`、`quanx`、`singbox/sing-box`。
  - `list=true`：通过 `extractProxySectionFromBuiltin()` 只抽取节点片段。

### 调度层
- `functions/services/processor-service.js`
  - `ProcessorService.renderOutput()`：先生成内置默认配置，再根据 `templateSource` 决定是否套用 builtin/remote ini 模板。
  - `isIniTemplateSource()`：识别远程 `.ini?query` 与内置 ini 模板。
  - Hiddify 兼容：`builtinOptions.hiddifyCompatible` 时跳过模板渲染，使用保守 builtin 输出。

### 直接生成器
- `functions/modules/subscription/transformer-factory.js`
- `functions/modules/subscription/builtin-clash-generator.js`
- `functions/modules/subscription/builtin-singbox-generator.js`
- `functions/modules/subscription/builtin-surge-generator.js`
- `functions/modules/subscription/builtin-loon-generator.js`
- `functions/modules/subscription/builtin-quanx-generator.js`
- `functions/modules/subscription/builtin-egern-generator.js`
- `functions/modules/subscription/builtin-rules-provider.js`

### 模板模型链路
- `functions/modules/subscription/builtin-template-registry.js`
- `functions/modules/subscription/template-pipeline.js`
- `functions/modules/subscription/template-model.js`
- `functions/modules/subscription/template-parsers/ini-template-parser.js`
- `functions/modules/subscription/template-processor.js`
- `functions/modules/subscription/template-renderers/render-clash.js`
- `functions/modules/subscription/template-renderers/render-singbox.js`
- `functions/modules/subscription/template-renderers/render-surge.js`
- `functions/modules/subscription/template-renderers/render-loon.js`
- `functions/modules/subscription/template-renderers/render-quanx.js`
- `functions/modules/subscription/template-renderers/render-egern.js`

### 前端配置入口
- `src/constants/transform-assets.js`
- `src/constants/default-settings.js`
- `src/composables/useSettingsLogic.js`
- `src/composables/useProfiles.js`
- `src/stores/useDataStore.js`

### 已有测试重点
- `tests/unit/template-pipeline.test.js`
- `tests/unit/processor-service-render-output.test.js`
- `tests/unit/builtin-relay-policy.test.js`
- `tests/unit/builtin-clash-generator.test.js`
- `tests/unit/builtin-singbox-generator.test.js`
- `tests/unit/builtin-surge-generator.test.js`
- `tests/unit/builtin-loon-generator.test.js`
- `tests/unit/builtin-quanx-generator.test.js`
- `tests/unit/egern-renderer.test.js`
- `tests/unit/transform-assets.test.js`
- `tests/unit/main-handler-template-url.test.js`
- `tests/unit/settings-transform-config.test.js`
- `tests/unit/template-compatibility.test.js`
- `tests/unit/hiddify-clash-compatibility.test.js`
- `tests/unit/hiddify-engine-selection.test.js`
- `tests/unit/external-engine-builtin-flags.test.js`

---

## 1. 第一阶段：画清楚“模式矩阵”

### Task 1.1：整理 engine / target / templateSource 决策矩阵

**Objective:** 明确每种请求最终走 external、直接 builtin 还是模板模型渲染。

**Files:**
- Read: `functions/modules/subscription/main-handler.js`
- Read: `functions/services/processor-service.js`
- Create/Update: `docs/plans/2026-05-14-builtin-subscription-conversion-audit.md`

**检查项:**
- `engine=external`、`builtin=external`、全局/订阅组 external 设置的优先级。
- `builtin=1/true/builtin` 与 Hiddify UA 自动 builtin 的优先级。
- `target=nodes/base64/clash/singbox/surge/loon/quanx/egern` 的分支。
- `templateSource.kind = none | builtin | remote` 对 `ruleLevel` 和渲染链路的影响。

**Verification:**
- 形成一张文本矩阵，不用 Markdown 表格，避免 Telegram 展示差。
- 每个分支标注对应函数与文件行附近位置。

### Task 1.2：整理 ruleLevel 语义

**Objective:** 统一解释 `none/base/std/full/relay` 在直接生成器与模板模型中的语义。

**Files:**
- Read: `functions/modules/subscription/builtin-rules-provider.js`
- Read: `functions/modules/subscription/template-processor.js`
- Read: `functions/modules/subscription/main-handler.js`

**检查项:**
- `remote template => ruleLevel=none` 是否仍符合预期。
- `base` 在模板模型中是否只做最小清理，不注入智能地区组。
- `std/full/relay` 在各客户端输出是否语义一致。
- `relay` 在普通 Clash、Mihomo、Surge/Loon、Sing-box、QuanX 的差异是否文档化。

**Verification:**
- 对每个 level 给出“应输出什么 / 不应输出什么”。

---

## 2. 第二阶段：对齐前后端内置模板注册表

### Task 2.1：检查前端 `TRANSFORM_ASSETS` 与后端 `BUILTIN_TEMPLATE_REGISTRY` 是否一致

**Objective:** 避免前端可选项与后端实际可用模板不一致。

**Files:**
- Read: `src/constants/transform-assets.js`
- Read: `functions/modules/subscription/builtin-template-registry.js`
- Test: `tests/unit/transform-assets.test.js`

**当前发现:**
- 前端只暴露 4 个 builtin：
  - `clash_misub_minimal`
  - `clash_acl4ssr_lite`
  - `clash_misub_media_ai`
  - `clash_acl4ssr_full`
- 后端 registry 额外存在：
  - `clash_exclusive_ai`
  - `clash_game_optimized`
- 需要决定：隐藏保留、前端补入口、或删除未使用模板。

**建议默认:**
- 先保留后端模板，但在测试里显式声明“未暴露模板允许存在”；如果要产品化，再补前端资产。

**Verification command:**
```bash
npm run test:run -- tests/unit/transform-assets.test.js
```

### Task 2.2：确定默认内置模板

**Objective:** 解决前端 `is_default` 与全局默认设置之间潜在冲突。

**Files:**
- Read: `src/constants/default-settings.js`
- Read: `src/constants/transform-assets.js`
- Read: `tests/unit/settings-transform-config.test.js`

**检查项:**
- `DEFAULT_SETTINGS.transformConfigMode` 当前为 `builtin`。
- `DEFAULT_SETTINGS.transformConfig` 当前为空，是否表示使用直接生成器，而不是某个 builtin template。
- `TRANSFORM_ASSETS` 中 `clash_acl4ssr_lite` 与外部 ACL4SSR preset 同时 `is_default: true`，是否会造成 UI 默认选择歧义。

**建议默认:**
- 明确“内置转换默认”与“预设列表默认高亮”是两件事。
- 如果 UI 只允许一个默认项，保留 builtin 默认，外部 preset 不标默认。

---

## 3. 第三阶段：统一“直接生成器”和“模板模型”能力边界

### Task 3.1：列出各 target 的输出能力清单

**Objective:** 明确不同 target 支持协议、规则、策略组、托管头、链式代理的能力差异。

**Files:**
- Read: `builtin-*-generator.js`
- Read: `template-renderers/render-*.js`
- Read: `tests/unit/builtin-*-generator.test.js`
- Read: `tests/unit/template-pipeline.test.js`

**维度:**
- 协议支持：ss / ss2022 / vmess / vless reality / trojan / hysteria / tuic / wireguard / snell。
- 规则支持：本地规则、远程规则集、rule-provider/rule_set/filter_remote。
- 策略组支持：select、url-test、fallback、load-balance、relay/dialer-proxy/detour。
- 客户端特殊项：QuanX `#!MANAGED-CONFIG`、Surge/Loon section、Sing-box JSON、Egern YAML。

**Verification:**
- 每个 target 至少有一个最小 fixture 能被现有测试覆盖。

### Task 3.2：明确直接生成器是否继续作为 fallback

**Objective:** 决定长期主线：模板模型为主，直接生成器为兼容兜底；还是两者长期并行。

**当前链路:**
- `ProcessorService.renderOutput()` 总是先 `transformBuiltinSubscription()` 生成一次直接 builtin。
- 如果存在 builtin/remote ini template，再用模板模型覆盖 `finalContent`。
- 如果模板缺失或不支持，就保留直接 builtin 输出。

**建议默认:**
- 保持当前策略：直接生成器是强 fallback，模板模型是“有模板时的统一渲染主线”。
- 后续重构只抽公共函数，不急于删除直接生成器。

---

## 4. 第四阶段：梳理兼容性风险点

### Task 4.1：Hiddify 兼容路径复核

**Objective:** 确认 Hiddify UA 下不会输出 Hiddify 无法识别的 Clash rule-providers / RULE-SET / 复杂模板结构。

**Files:**
- Read: `functions/modules/subscription/user-agent-utils.js`
- Read: `functions/modules/subscription/main-handler.js`
- Read: `functions/services/processor-service.js`
- Test: `tests/unit/hiddify-clash-compatibility.test.js`
- Test: `tests/unit/hiddify-engine-selection.test.js`
- Test: `tests/unit/processor-service-render-output.test.js`

**已有行为:**
- 未显式 target 且 Hiddify UA：默认 builtin。
- Hiddify Clash 渲染跳过 ini template，走保守 builtin 输出。
- Hiddify 输出不包含 `rule-providers:` / `RULE-SET,`。

**Verification command:**
```bash
npm run test:run -- tests/unit/hiddify-clash-compatibility.test.js tests/unit/hiddify-engine-selection.test.js tests/unit/processor-service-render-output.test.js
```

### Task 4.2：Relay / 链式代理路径复核

**Objective:** 防止 Meta/Mihomo、普通 Clash、Surge/Loon、Sing-box、QuanX 的 relay 语义混用。

**Files:**
- Read: `functions/modules/subscription/builtin-clash-generator.js`
- Read: `functions/modules/subscription/builtin-singbox-generator.js`
- Read: `functions/modules/subscription/builtin-surge-generator.js`
- Read: `functions/modules/subscription/builtin-loon-generator.js`
- Read: `functions/modules/subscription/builtin-quanx-generator.js`
- Test: `tests/unit/builtin-relay-policy.test.js`

**既定原则:**
- 普通 Clash：不用 `relay` 策略组，不输出 `dialer-proxy`，用 select 降级。
- Mihomo/Meta：不用旧 relay group 语义，用节点级 `dialer-proxy`。
- Surge/Loon：可输出原生 `relay` 策略组。
- Sing-box：使用 `detour` 链式出站。
- QuanX：不支持真链式时 static 降级。

**Verification command:**
```bash
npm run test:run -- tests/unit/builtin-relay-policy.test.js
```

### Task 4.3：远程模板与 external engine 边界复核

**Objective:** 保证 remote ini template 在 builtin 模式下能渲染，在 external 模式下只作为第三方 subconverter `config` 参数传递。

**Files:**
- Read: `functions/modules/subscription/main-handler.js`
- Read: `functions/services/processor-service.js`
- Test: `tests/unit/main-handler-template-url.test.js`
- Test: `tests/unit/external-engine-builtin-flags.test.js`
- Test: `tests/unit/processor-service-render-output.test.js`

**Verification command:**
```bash
npm run test:run -- tests/unit/main-handler-template-url.test.js tests/unit/external-engine-builtin-flags.test.js tests/unit/processor-service-render-output.test.js
```

---

## 5. 第五阶段：补测试缺口

### Task 5.1：新增“内置转换矩阵”单测

**Objective:** 用一个集中测试文件锁定关键决策，防止后续 UI/配置改动破坏转换路径。

**Files:**
- Create: `tests/unit/builtin-conversion-matrix.test.js`
- Import from:
  - `functions/modules/subscription/main-handler.js`
  - `functions/services/processor-service.js`
  - `functions/modules/subscription/transformer-factory.js`

**建议测试点:**
- `resolveTemplateSource('builtin:clash_acl4ssr_full')` 返回 builtin。
- remote template 时 `resolveExternalTemplateConfigUrl()` 返回 URL。
- builtin template 对 clash/singbox/surge/loon/quanx 均走 ini renderer。
- Hiddify compatible 时忽略 templateSource。
- unsupported target fallback base64。

**Verification command:**
```bash
npm run test:run -- tests/unit/builtin-conversion-matrix.test.js
```

### Task 5.2：新增“前后端模板 registry 一致性”单测

**Objective:** 明确前端暴露模板必须后端可解析，避免点了内置配置但后端拿不到内容。

**Files:**
- Modify: `tests/unit/transform-assets.test.js`

**建议断言:**
- 所有 `sourceType === 'builtin-preset'` 且 `url` 为 `builtin:*` 的前端 asset，后端 `getBuiltinTemplate(id)` 必须存在。
- 后端额外模板允许存在，但要在测试名里说明“backend-only templates are allowed”。
- 所有 builtin asset 的 `strategy` 应为 `model-driven`。

**Verification command:**
```bash
npm run test:run -- tests/unit/transform-assets.test.js
```

### Task 5.3：新增 target 输出 smoke tests

**Objective:** 保证 6 类客户端输出最小可用。

**Files:**
- Modify/Create: `tests/unit/builtin-target-smoke.test.js`

**建议断言:**
- Clash：YAML 可 parse，有 `proxies` / `proxy-groups` / `rules`。
- Sing-box：JSON 可 parse，有 `outbounds` / `route`。
- Surge：包含 `[Proxy]`、`[Proxy Group]`、`[Rule]`。
- Loon：包含 `[Proxy]`、`[Proxy Group]`、`[Rule]`。
- QuanX：包含 `[server_local]`、`[policy]`、`[filter_*]`。
- Egern：YAML 可 parse，有 policy group 与 proxy。

---

## 6. 第六阶段：代码清理与抽象统一

### Task 6.1：抽取重复节点解析/去重逻辑

**Objective:** 减少 `template-pipeline.js` 与各 builtin generator 中重复的 nodeList split、URL parse、deduplicate。

**候选文件:**
- Create: `functions/modules/subscription/node-list-utils.js`
- Modify: `functions/modules/subscription/template-pipeline.js`
- Modify: `functions/modules/subscription/builtin-*-generator.js`

**注意:**
- 先补测试再抽，不要一次改所有 generator。
- 保持输出顺序与名称去重逻辑不变。

### Task 6.2：统一 contentType 与 target normalize

**Objective:** 避免 `surge&ver=4`、`sing-box/singbox` 等别名在各处散落。

**候选文件:**
- Create: `functions/modules/subscription/target-format-utils.js`
- Modify: `transformer-factory.js`
- Modify: `processor-service.js`
- Modify: `main-handler.js`

**建议函数:**
- `normalizeTargetFormat(targetFormat)`
- `getTargetBase(targetFormat)`
- `isBuiltinRenderableTarget(targetFormat)`
- `getContentTypeForTarget(targetFormat)`

### Task 6.3：文档化 feature flags 与 URL 参数

**Objective:** 把 `builtin`、`engine`、`target`、`level/ruleLevel`、`list`、`udp`、`tfo`、`scv`、`emoji` 等参数写清楚。

**候选文件:**
- Create: `docs/builtin-subscription-conversion.md`

---

## 7. 第七阶段：验证与回归命令

### 必跑单测
```bash
npm run test:run -- \
  tests/unit/template-pipeline.test.js \
  tests/unit/processor-service-render-output.test.js \
  tests/unit/builtin-relay-policy.test.js \
  tests/unit/transform-assets.test.js \
  tests/unit/main-handler-template-url.test.js \
  tests/unit/settings-transform-config.test.js \
  tests/unit/hiddify-clash-compatibility.test.js \
  tests/unit/hiddify-engine-selection.test.js \
  tests/unit/external-engine-builtin-flags.test.js
```

### 全量验证
```bash
npm run test:run
npm run build
```

### 人工验收 URL 模板
- `/<token>?target=clash&builtin=1`
- `/<token>?target=clash&builtin=1&level=base`
- `/<token>?target=clash&builtin=1&level=std`
- `/<token>?target=clash&builtin=1&level=full`
- `/<token>?target=clash&builtin=1&level=relay`
- `/<token>?target=singbox&builtin=1`
- `/<token>?target=surge&ver=4&builtin=1`
- `/<token>?target=loon&builtin=1`
- `/<token>?target=quanx&builtin=1`
- `/<token>?target=egern&builtin=1`
- `/<token>?target=nodes&builtin=true`
- `/<token>?target=clash&builtin=1&list=true`

---

## 推荐执行顺序

1. 先做 Task 1.1 / 1.2，只产出矩阵和规则说明，不改代码。
2. 再做 Task 2.1 / 2.2，解决前后端模板默认值和可见性问题。
3. 补 Task 5.1 / 5.2 / 5.3 的测试，先锁行为。
4. 做 Task 4.1 / 4.2 / 4.3，专门处理高风险兼容性。
5. 最后再做 Task 6.x 的抽象清理，避免重构先行导致回归。

## 当前初步结论

- 内置转换主链路已经比较完整，但“直接生成器”和“模板模型渲染”并行，容易让后续修改者不知道应该改哪边。
- 当前最优先不是大重构，而是补一份模式矩阵 + registry 一致性测试 + target smoke tests。
- Relay 与 Hiddify 是最高风险兼容路径，应作为回归测试必跑项。
- 前端暴露的 builtin 模板少于后端 registry，暂不一定是 bug，但需要明确产品策略并用测试固定。
