import chromadb
from chromadb.config import Settings as ChromaSettings
from functools import lru_cache

from app.core.config import settings


@lru_cache(maxsize=1)
def _client():
    return chromadb.PersistentClient(
        path=settings.chroma_persist_dir,
        settings=ChromaSettings(anonymized_telemetry=False),
    )


def get_collection(name: str = "resume_signals"):
    return _client().get_or_create_collection(name=name)


def upsert_resume_chunks(resume_id: str, chunks: list[str]) -> None:
    collection = get_collection()
    collection.upsert(
        ids=[f"{resume_id}-{i}" for i in range(len(chunks))],
        documents=chunks,
        metadatas=[{"resume_id": resume_id} for _ in chunks],
    )


def query_similar(job_description_chunk: str, n_results: int = 5):
    collection = get_collection()
    return collection.query(query_texts=[job_description_chunk], n_results=n_results)
