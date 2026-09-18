from __future__ import annotations

from functools import lru_cache

import pandas as pd

import config
from src.models.schemas import AssetClass


@lru_cache(maxsize=1)
def load_universe() -> pd.DataFrame:
    df = pd.read_csv(config.ASSET_UNIVERSE_CSV)
    df["keywords"] = df["keywords"].fillna("").apply(lambda s: [k.strip().lower() for k in s.split("|") if k.strip()])
    df["asset_class"] = df["asset_class"].apply(AssetClass)
    return df


def lookup_symbol(symbol: str) -> dict | None:
    df = load_universe()
    match = df[df["symbol"].str.upper() == symbol.upper()]
    if match.empty:
        return None
    row = match.iloc[0]
    return {"symbol": row["symbol"], "name": row["name"], "asset_class": row["asset_class"]}
