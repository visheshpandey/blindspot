"""HTTP routes, one router per concern. app.main includes them all; paths are unchanged and unprefixed."""
from . import health, investigations, language, traplab

routers = (health.router, investigations.router, language.router, traplab.router)
