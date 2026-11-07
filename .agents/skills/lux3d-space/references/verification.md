# 验收命令与期望输出

## Demo（改 `demo/` 后必跑）

```powershell
cd demo
node "C:\Users\王潇\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" build
# 期望：exit 0，输出含 "✓ built in ..."，tsc 无错误

node --experimental-strip-types --test tests/state-machine.test.ts
# 期望：pass 21 / fail 0（2026-11-04 起为 21 项；历史口径 19）
```

## 资产链路（涉及 GLB 时）

```powershell
# dev server 启动后
curl.exe -I http://127.0.0.1:5180/models/<objectId>.glb
# 期望：HTTP 200，Content-Type: model/gltf-binary
```

## 后端（涉及 server/ 时）

```powershell
cd server
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 5182
curl.exe http://127.0.0.1:5182/api/health
# 期望：{"status":"ok","mode":"mock","entries":11}
```

## 视觉/交互改动

- 必须给 5180 的前后截图或录屏（放在 `assets/` 或交接单里）；自动化截图用 `demo/scripts/screenshot.mjs`（4 张 UI 图）或 `references/automation-recipe.md` 的种子存档技法（任意机位场景图）。
- 不改 7 步主线；不改状态机断言。

## 密钥自查（每次 done 前）

```powershell
# 在仓库根目录：正则扫 demo/src 与 collab，输出 CLEAN 才算过
node -e "const fs=require('fs'),path=require('path');const roots=['demo/src','collab'];const re=/(AHOLO_API_KEY\s*=\s*['\"][A-Za-z0-9]|sk-[A-Za-z0-9]{20,}|x-api-key\s*[:=]\s*['\"][A-Za-z0-9])/;const bad=[];function walk(d){let es;try{es=fs.readdirSync(d,{withFileTypes:true})}catch(e){return}for(const en of es){const p=path.join(d,en.name);if(en.isDirectory()){if(en.name==='node_modules'||en.name==='.git')continue;walk(p);}else if(/\.(ts|tsx|js|mjs|cjs|json|md|css|html)$/.test(en.name)){let t;try{t=fs.readFileSync(p,'utf8')}catch(e){continue}if(re.test(t))bad.push(p);}}}roots.forEach(walk);console.log(bad.length?'LEAK '+bad.join('|'):'SECRETS CLEAN');"
```

## 失败处理

- 先定位根因，不连续盲改；2 次尝试失败 → `block` 并写原因。
- 验收失败不要 `done`；DSH 会用同样命令复验。
