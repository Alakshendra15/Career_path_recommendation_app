"""FastAPI entry point.  Run:  uvicorn main:app --reload --port 8000   (docs at /docs)"""
import os

# Some Windows machines fail to allocate memory for OpenBLAS's many threads; one thread is plenty here.
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.services.knowledge_base import get_kb


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_kb()  # fail fast if a CSV is missing or malformed
    yield


app = FastAPI(
    title="Career Path ML Service",
    description="Resume analysis, career recommendation, skill gap, roadmap and job role suggestions.",
    version="0.1.0",
    lifespan=lifespan,
)
# The service is called server-to-server by Express; CORS is only for the /docs page and local testing.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router)
