from typing import Literal

from .cashflow import Strict


class LineFinanceLinkCreate(Strict):
    workspace_id: str
    account_id: str
    confirmed_currency: Literal["THB"]
