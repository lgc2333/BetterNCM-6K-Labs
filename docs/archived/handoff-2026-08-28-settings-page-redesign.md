# Handoff: 6K Labs 新版设置页 — 原型定稿 → 生产实装

日期：2026-08-28。上一个会话完成了设置页重设计的拷问、原型迭代与定稿，生产实装刚起步。本文档供新会话继续。

## 状态

- [x] 需求拷问收敛（grilling 两轮，结论已全部落入原型）
- [x] UI 原型定稿（B 变体，经 6 轮用户迭代修改）
- [x] `DESIGN.md`（包根目录，design-md 规范，lint 0 error；warning 为 alpha 色对比度误报 + CSS 层 token 孤儿告警，均已解释）
- [x] `src/ui/theme.ts` 已写入（getNcmThemeMode + useNcmTheme，含 2s 轮询兜底）
- [ ] **实装已冻结**（用户："别动，先写好 DESIGN.md，交给别人"）——从 `src/ui/config.tsx` 重写开始继续
- [ ] 测试（建议补 `src/ui/theme.dom.test.ts`）+ lint/format + `pnpm run build:js` 验证
- [ ] 原型捕获：按 prototype 技能提交到 throwaway 分支（包是独立 git 仓库/子模块）
- [ ] 更新包 `AGENTS.md`（补 theme.ts 与 DESIGN.md 条目）

## 定稿设计（B 变体最终形态，细节以原型文件为准）

参照 `packages/6K-Labs/temp/prototype/settings-page.html`（变量 B 的 render + `.sixk` 相关 CSS），要点：

1. **主题无关**：全部 alpha token（surface/border/text 用 rgba 叠加），跟随 NCM 主题（localStorage `currentTheme` v3 / `NM_SETTING_SKIN` v2，参考 `private/references/inflink-rs/packages/frontend/src/hooks/useNcmTheme.ts`）。config 元素被框架永久缓存、永不重挂载，因此 theme hook 需低频轮询（2s）兜底同文档 storage 事件不触发的问题。
2. **页面结构**：页头（6K Labs + 一句话描述）→ 服务状态卡（单卡竖排 3 项，分隔线）→ 运维操作行 → 封面输出（模式分段控件 + 尺寸可输入下拉框 `input+datalist`）→ 帮助区（使用教程/关于与鸣谢全展开行 + 反馈问题行）。
3. **状态卡 3 项**：
   - 本地 HTTP 服务：右侧状态字 15px/600（up 绿 `运行中 · 9863` / down 红 `未运行`）；下方一行 = 查询地址(mono) + 复制/打开小按钮紧贴地址 + 心跳(相对时间)靠右；仅 up 时显示该行
   - InfLink-rs：`在线`/`离线`；离线时下方错误详情
   - 推送适配器：state 映射中文（idle 待机/waiting 连接中/running 运行中/stopped 已停止/failed 失败），detail 用 lastError ?? lastCoverError
4. **交互**：停止服务两段确认（2.6s 回退）；复制走 clipboard + execCommand 兜底；链接用 `betterncm.ncm.openUrl`
5. **已删除的文案**：运维操作、输出模式两行无 desc

## 实装约束（易踩坑）

- **React 是页面全局**（`window.React`）：只能 `import type`，运行时用 `React.useState` 等全局引用；esbuild 直接 bundle，react 值导入会打包失败
- 挂载：`main.ts` 的 `plugin.onConfig` 渲染 `ConfigWrapper`，**对外接口不要变**
- CSS：样式以 `<style>` 注入（幂等），选择器前缀 `.sixk-config`，主题用根元素 `data-theme` 切换
- 构建 target chrome91；包内测试分 node(`*.test.ts`)/happy-dom(`*.dom.test.ts`) 两项目
- 仓库规则：TS 改动跑 Prettier + ESLint；commit 用英文 conventional format（见仓库 AGENTS.md）

## 剩余工作建议顺序

1. ~~`src/ui/theme.ts`~~ 已完成，直接用
2. 重写 `src/ui/config.tsx`：见上方定稿设计；配置模型 `settings.ts` 不动（readCoverSettings/writeCoverSettings + normalize）；样式从 `DESIGN.md` token 翻译成 `.sixk-config[data-theme]` 作用域 CSS，`<style>` 幂等注入
3. 新增 `src/ui/theme.dom.test.ts`（getNcmThemeMode 的 v3/v2/非法 JSON 分支）
4. `pnpm exec prettier --write` + `pnpm exec eslint --fix`（改动文件）、`pnpm vitest run`（包内）、`pnpm --filter better-ncm-6k-labs run build:js`
5. 原型捕获到 throwaway 分支（commit 信息注明问题与结论），main/主分支只留定稿决策
6. 更新包 `AGENTS.md`：src 结构加 `ui/theme.ts`，根目录加 `DESIGN.md`

## 关键文件

- 原型（设计唯一权威）：`packages/6K-Labs/temp/prototype/settings-page.html`（temp/ 已 gitignore，**先把它拷出来提交到 throwaway 分支再动别的**）
- 现状代码：`packages/6K-Labs/src/ui/config.tsx`（旧版，待重写）、`src/settings.ts`、`src/native.ts`（`QUERY_URL`/`SERVER_PORT`/`ServerStatus`）、`src/source-adapter.ts`（`SourceDiagnostics`）、`src/runtime.ts`（restart/stop）
- 设计参考：`private/references/inflink-rs/packages/frontend/src/`（theme.css 的 alpha token 体系、SettingItem 行模式、useNcmTheme）
- 包规则：`packages/6K-Labs/AGENTS.md`；ADR 在 `docs/adr/`

## Suggested skills

- `design-md`：写 DESIGN.md（必读；注意 Windows 的 designmd 别名坑）
- `prototype`：定稿后的原型捕获/清理流程（capture to throwaway branch）
- `codebase-design`：模块/seam 词汇（theme.ts 的接口已按此设计好，照做即可）
- `tdd`：如果补 config 交互的 DOM 测试时参考
