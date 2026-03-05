from litestar import Litestar, get


@get("/")
async def index() -> str:
    return "Aegis Autonomous Wealth OS API is running."


app = Litestar(route_handlers=[index])
