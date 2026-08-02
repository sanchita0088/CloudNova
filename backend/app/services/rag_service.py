import os
import logging
import numpy as np
from typing import List, Optional
from langchain_core.embeddings import Embeddings
from langchain_core.documents import Document
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.core.config import settings

logger = logging.getLogger(__name__)


class MockEmbeddings(Embeddings):
    """
    A simple, fast, and deterministic mock embedding function for local-offline
    testing when a valid GEMINI_API_KEY is not available.
    It produces a unit-length vector of dimension 768.
    """
    def __init__(self, dimension: int = 768):
        self.dimension = dimension

    def _get_embedding(self, text: str) -> List[float]:
        # Deterministically seed based on character values in the text
        seed_val = sum(ord(c) * (i + 1) for i, c in enumerate(text))
        # Seed numpy generator
        rng = np.random.default_rng(seed_val % (2**32))
        vector = rng.standard_normal(self.dimension)
        # Normalize vector
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
        return vector.tolist()

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._get_embedding(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._get_embedding(text)


class RAGService:
    def __init__(self):
        self.persist_directory = settings.CHROMA_DB_DIR
        self._vectorstore: Optional[Chroma] = None
        self._init_embeddings()

    def _init_embeddings(self):
        """
        Initializes OllamaEmbeddings using the local Ollama instance configuration.
        Otherwise falls back to MockEmbeddings if Ollama is unreachable.
        """
        try:
            from langchain_community.embeddings import OllamaEmbeddings
            logger.info(f"Initializing OllamaEmbeddings on {settings.OLLAMA_BASE_URL} with model {settings.OLLAMA_EMBEDDING_MODEL}...")
            self.embeddings = OllamaEmbeddings(
                base_url=settings.OLLAMA_BASE_URL,
                model=settings.OLLAMA_EMBEDDING_MODEL,
            )
            # Lightweight check to verify reachability and embedding support
            import requests
            response = requests.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=1.0)
            if response.status_code == 200:
                try:
                    # Test if the model actually supports embeddings
                    self.embeddings.embed_query("test")
                    logger.info("RAGService: Ollama embeddings initialized and verified successfully.")
                except Exception as embed_err:
                    logger.warning(f"RAGService: Ollama model or server does not support embeddings ({embed_err}). Falling back to MockEmbeddings.")
                    self.embeddings = MockEmbeddings()
            else:
                logger.warning("RAGService: Ollama service returned error status. Falling back to MockEmbeddings.")
                self.embeddings = MockEmbeddings()
        except Exception as e:
            logger.error(f"Failed to initialize OllamaEmbeddings: {e}. Falling back to MockEmbeddings.")
            self.embeddings = MockEmbeddings()

    def get_vectorstore(self) -> Chroma:
        """
        Returns a lazily-built, cached Chroma VectorStore.

        The store is constructed once and reused across search/ingest calls to
        avoid re-opening the persistent client (and holding multiple concurrent
        clients over the same directory) on every request.
        """
        if self._vectorstore is None:
            os.makedirs(self.persist_directory, exist_ok=True)
            self._vectorstore = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embeddings,
                collection_name="cloudops_runbooks"
            )
            try:
                if self._vectorstore._collection.count() == 0:
                    logger.info("ChromaDB vector store is empty. Triggering automatic runbook ingestion...")
                    from app.services.ingest import ingest_runbooks
                    ingest_runbooks()
            except Exception as e:
                logger.warning(f"Auto-ingestion check failed/skipped: {e}")
        return self._vectorstore

    def ingest_documents(self, documents: List[Document]) -> List[str]:
        """
        Splits and inserts documents into the Chroma database.
        """
        # Set up text splitter
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=700,
            chunk_overlap=100
        )
        
        chunks = splitter.split_documents(documents)
        logger.info(f"Split {len(documents)} document(s) into {len(chunks)} chunk(s).")

        vectorstore = self.get_vectorstore()

        # Idempotent ingestion: drop any existing chunks for each incoming
        # source before re-adding, so re-ingesting the same runbook replaces
        # rather than duplicates it (avoids the collection growing on every
        # "Reload Runbook Index" click).
        sources = {d.metadata.get("source") for d in documents if d.metadata.get("source")}
        for src in sources:
            try:
                vectorstore._collection.delete(where={"source": src})
                logger.info(f"Purged existing chunks for source '{src}' before re-ingest.")
            except Exception as e:
                logger.warning(f"Could not purge old chunks for source='{src}': {e}")

        ids = vectorstore.add_documents(chunks)
        logger.info(f"Successfully added {len(ids)} chunks to ChromaDB.")
        return ids

    def search(self, query: str, k: int = 3) -> List[Document]:
        """
        Performs vector similarity search in ChromaDB.
        """
        vectorstore = self.get_vectorstore()
        logger.info(f"Searching ChromaDB for query: '{query}' with k={k}")
        results = vectorstore.similarity_search(query, k=k)
        return results


# Global singleton instance
rag_service = RAGService()
