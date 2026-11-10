# 二期优化技术适配手册（roadmap-optimization）

> 面向任何领取 T-026~T-032 的 Agent。配套 docs/15-二期路线图.md；硬约束见 ../SKILL.md。
> 核心原则：渲染层只读 flags，写操作全走 applyAction；台词/文案只改 narrative-content.json，代码只是读取器。

## 1. InstancedMesh 合批（T-026 已落地，续作参照）

本项目重复小物件全部是 Props.tsx 程序化几何。合批标准写法（书架书实例）：

```tsx
// ① 数据层：useMemo 生成实例描述（位置/旋转/缩放/颜色），伪随机用 pseudoRandom(seed) 保持分布一致
// ② 写入层 useLayoutEffect：setMatrixAt + setColorAt 后必须
mesh.instanceMatrix.needsUpdate = true
if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
// ③ 材质必须 vertexColors: true（否则逐实例色全黑）
<instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled>
  <boxGeometry args={[1, 1, 1]} />
  <meshStandardMaterial vertexColors roughness={0.85} />
</instancedMesh>
```

- 本项目**无 shadows**（显式关闭）——不设 cast/receiveShadow
- 无逐实例交互需求时不引 drei `<Instances>`（原生更轻）
- 下一批候选：石阶 box 组、浮雕点缀 sphere×7、烛台组（材质可先做模块级共享常量池）

## 2. GLB 压缩（Meshopt 已全量）

```bash
npx @gltf-transform/cli optimize in.glb out.glb \
  --compress meshopt --texture-compress webp --texture-size 1024
```

- 引擎侧：`useGLTF(src, false, true)` 第三参开 meshopt（Draco 恒关=零 CDN 红线）；**AssetModel/DialParts/preloadGlbs 三处必须同步**
- 原件备份在 `demo/public/models-raw-backup/`（可回滚）
- 批量脚本模式见 Temp/meshopt_batch.py（shutil.which 解析 npx 全路径——Windows 直接 "npx" 会 FileNotFoundError）

## 3. dispose 决策表

| 位置 | 该不该 dispose | 理由 |
|---|---|---|
| MemoryPanel gaussian viewer | ✅ 已有 disposeAll | StrictMode 双挂载防泄漏 |
| 17 件 GLB（useLoader 缓存） | ❌ 不做 | 常驻+preload=防换装跳变（设计特性）；重载反而抖动 |
| 45 书独立材质 | ✅ 已被合批消解 | 单材质后无泄漏面 |
| 新增临场 RenderTarget/后期 | ✅ 用完即 dispose+forceContextLoss | 未引入，若做后期再说 |

## 4. Profiler 验收流程

1. dev 起 5800 → 开始探索进书房 → 等 5s
2. 读 `window.__glInfo`（HUD 右下角标同步显示）：门槛 **DC<50 · Tris<100 万**
3. 新增渲染特性后复测；超标先查材质池共享→LOD→合批

## 5. 剧情扩容契约（双结局/环境叙事先例）

- **加台词**：只改 narrative-content.json（追加，不改既有条目）→ schema.ts 若有新结构则补 optional/default → narrative.ts re-export → loader MINIMAL_CONTENT 补齐新字段
- **双结局先例**：新 Action 仅增不改（types.ts Action + actions.ts case，complete 阶段限定）；分支旗标走**自由键**（`ending_keep` 等，**禁入 FLAG_KEYS**——测试 695/732 行契约锁 9）；存档白名单清洗自由键是既定契约——往返测试比较「主线键逐一+自由键断言被清洗」（参照 T-027 适配写法）
- **环境叙事先例**：`ambientLines`（objectId→一句话），applyAction 公共出口一次性追加（自由键 `ambient_seen_<objectId>` 会话内去重）
- **音频**：纯 WebAudio 合成（tone/noise 管道）；环境循环走 App.tsx useEffect 按 zone 起停；新增第三层 music（chamber pad：失谐正弦对+慢包络）；SoundName 扩展需 types.ts+playSound case 同步

## 6. 验收门槛表

| 指标 | 门槛 | 实测（2026-11-10） |
|---|---|---|
| DrawCall | <50 | 43 |
| Tris | <100 万 | 283k |
| GLB 单件 | <800KB（pedestal 例外 1.23MB） | 451KB~1.23MB |
| 单测 | 全绿且数量只增 | 32/32 |
| 主线契约 | FLAG_KEYS===9、7 步 stage、13→15 Action 只增 | 测试锁定 |
