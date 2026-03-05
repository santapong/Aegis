from decimal import Decimal


class CurrencyConverter:
    def __init__(self, base_currency: str = "THB"):
        self.base_currency = base_currency
        self.rates = {
            "THB": Decimal("1.0"),
            "SGD": Decimal("26.5"),  # Example fixed rate for prototyping
        }

    def convert(self, amount: Decimal, from_currency: str, to_currency: str) -> Decimal:
        if from_currency not in self.rates or to_currency not in self.rates:
            raise ValueError("Unsupported currency")

        amount_in_base = amount / self.rates[from_currency]
        return amount_in_base * self.rates[to_currency]
