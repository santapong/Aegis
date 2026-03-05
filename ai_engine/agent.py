from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI


class AdvisorAgent:
    def __init__(self):
        self.llm = ChatOpenAI(temperature=0.7)
        self.prompt = PromptTemplate.from_template(
            "You are a financial advisor for Aegis OS. Given the user's spending prediction "
            "and liquidity, advise them on their next actions: {financial_context}"
        )
        self.chain = self.prompt | self.llm

    def get_advice(self, financial_context: str) -> str:
        # Stub for getting advice from LangChain
        return self.chain.invoke({"financial_context": financial_context}).content
