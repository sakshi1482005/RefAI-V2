import chromadb
from chromadb.config import Settings as ChromaSettings
from functools import lru_cache
from time import perf_counter

from app.core.config import settings


@lru_cache(maxsize=1)
def _client():
    return chromadb.PersistentClient(
        path=settings.chroma_persist_dir,
        settings=ChromaSettings(anonymized_telemetry=False),
    )


def get_collection(name: str = "resume_signals", metadata: dict | None = None):
    return _client().get_or_create_collection(name=name, metadata=metadata)


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


def normalize_cosine_distance(distance: float) -> float:
    """Cosine distance 0 is identical, 1 orthogonal, and 2 opposite."""
    return max(0.0, min(100.0, (1.0 - float(distance)) * 100.0))


class ChromaProjectRelevanceProvider:
    """Scoped semantic comparison using the existing Chroma client and embeddings."""

    def __init__(self, context_id: str, timing_callback=None):
        self.context_id = context_id
        self.timing_callback = timing_callback

    def compare(self, resume_sections: list[str], comparison_contexts: list[str]) -> dict:
        started_at = perf_counter()
        try:
            return self._compare(resume_sections, comparison_contexts)
        finally:
            if self.timing_callback:
                self.timing_callback("vector_relevance", perf_counter() - started_at)

    def _compare(self, resume_sections: list[str], comparison_contexts: list[str]) -> dict:
        if not resume_sections:
            raise ValueError("No meaningful project or experience text is available")
        if not comparison_contexts:
            raise ValueError("No usable relevance comparison context is available")
        collection = get_collection(
            "project_experience_relevance_v1",
            metadata={"hnsw:space": "cosine"},
        )
        collection.delete(where={"context_id": self.context_id})
        ids = [f"{self.context_id}-{index}" for index in range(len(resume_sections))]
        collection.upsert(
            ids=ids,
            documents=resume_sections,
            metadatas=[{"context_id": self.context_id, "section_index": index} for index in range(len(resume_sections))],
        )
        matches = []
        similarities = []
        for context in comparison_contexts:
            result = collection.query(
                query_texts=[context],
                n_results=min(3, len(resume_sections)),
                where={"context_id": self.context_id},
                include=["documents", "distances", "metadatas"],
            )
            documents = (result.get("documents") or [[]])[0]
            distances = (result.get("distances") or [[]])[0]
            if not documents or not distances:
                continue
            similarity = normalize_cosine_distance(distances[0])
            similarities.append(similarity)
            matches.append({
                "resumeEvidence": documents[0],
                "comparisonContext": context,
                "normalizedSemanticSimilarity": round(similarity, 2),
            })
        if not similarities:
            raise ValueError("ChromaDB returned no usable semantic matches")
        return {
            "score": sum(similarities) / len(similarities),
            "matches": matches,
            "normalization": "cosine_similarity_percent = clamp((1 - cosine_distance) * 100, 0, 100)",
        }
