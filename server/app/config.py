"""运行配置。

设计原则：默认零依赖可跑。没有 DATABASE_URL 时使用 mock 模式（内存 + JSON 种子），
方便前端联调与答辩演示；接真库时只改环境变量，不改业务代码。
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVER_DIR = Path(__file__).resolve().parent.parent
SEED_PATH = Path(__file__).resolve().parent / "seed_knowledge.json"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=SERVER_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Lux3D Narrative Space API"
    app_version: str = "0.1.0"
    mode: str = "mock"  # mock | pg
    database_url: str = ""
    embedding_dim: int = 1024
    cors_origins: str = "http://127.0.0.1:5180,http://localhost:5180"

    @property
    def use_pg(self) -> bool:
        return self.mode == "pg" and bool(self.database_url)

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    # 允许 LUX3D_MODE 直接覆盖
    if os.getenv("LUX3D_MODE"):
        os.environ.setdefault("MODE", os.environ["LUX3D_MODE"])
    return Settings()
