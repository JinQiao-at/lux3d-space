# zcode · ZCode 工作区适配件

| 文件 | 作用 |
|---|---|
| `../zcode.json` | 项目运行配置：启用 skill/mcp/memory，禁用 plugins（本项目不需要 ZCode UI 插件） |
| `../.agents/skills/lux3d-space/SKILL.md` | 项目技能：ZCode 打开工作区后可发现并加载（含 references/） |
| `hooks/guard-protected.mjs` | PreToolUse 守卫：拒改生成物/契约/密钥，拦危险 Shell 命令 |
| `hooks.example.json` | Hook 配置示例（把 `<ABS_PATH>` 换成本机绝对路径后合并进运行配置） |

## 启用步骤

```powershell
# 1) 把 hooks.example.json 的内容合入项目运行配置（zcode.json 或 .zcode/config.json 的 hooks 字段）
#    注意 <ABS_PATH> 换成 lux3d-space 的绝对路径

# 2) 让 ZCode 审查并信任项目 Hook（必须）
zcode hooks trust review --workspace C:\Users\王潇\Documents\deepseek-harness\default-workspace\lux3d-space --json
zcode hooks trust grant  --workspace C:\Users\王潇\Documents\deepseek-harness\default-workspace\lux3d-space --hook-digest <review 返回的 SHA256>

# 3) 验证技能与 Hook 被发现
zcode skills list --cwd C:\Users\王潇\Documents\deepseek-harness\default-workspace\lux3d-space --json
zcode hooks trust status --workspace C:\Users\王潇\Documents\deepseek-harness\default-workspace\lux3d-space --json
```

> Hook 是"隐形约束"：即使模型想改 `assetRegistry.ts` 或执行 `git reset --hard`，也会被本地脚本拒绝。
> Hook 不是完整沙箱；仍需任务板单写者 + DSH 验收。详见 ZCode 源码文档 `apps/zcode-cli/docs/usage/09-hooks.md`。
