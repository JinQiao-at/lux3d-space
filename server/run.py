"""pg 模式启动器。

Windows 上 psycopg 异步模式要求 SelectorEventLoop。直接 `python -m uvicorn` 会在
uvicorn 内部先建 loop 再 import app，且其 loop 选择不受模块级 policy 干预，导致
连接池初始化超时（PoolTimeout）。本文件显式创建 Selector loop 后再跑 uvicorn
server，pg 模式请用它启动：

    python run.py            # 默认 127.0.0.1:25432
"""

import asyncio
import sys

if sys.platform == "win32":
    # 技术债：WindowsSelectorEventLoopPolicy 在 Python 3.16 将移除（3.14 已 deprecate）。
    # 升级 Python 时改用 asyncio.run(..., loop_factory=asyncio.SelectorEventLoop) 或等价方案。
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn  # noqa: E402


def main() -> None:
    config = uvicorn.Config("app.main:app", host="127.0.0.1", port=25432, reload=False)
    server = uvicorn.Server(config)
    loop = asyncio.new_event_loop()  # policy 已切 Selector，此处拿到的是 SelectorEventLoop
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(server.serve())
    finally:
        loop.close()


if __name__ == "__main__":
    main()
