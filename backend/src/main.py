from litestar import Litestar, get
from litestar.config.cors import CORSConfig

from database.models import Base
from database.connection import engine
from routes.gantt import GoalController, MilestoneController


@get("/")
async def index() -> str:
    return "Aegis Autonomous Wealth OS API is running."


def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


cors_config = CORSConfig(
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app = Litestar(
    route_handlers=[index, GoalController, MilestoneController],
    on_startup=[on_startup],
    cors_config=cors_config,
)
