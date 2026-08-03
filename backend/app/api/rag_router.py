from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.rag_service import RAGService
from app.services.ingest import ingest_runbooks
from app.api.deps import get_rag_service, get_current_user
from app.models.user import User

router = APIRouter(prefix="/rag", tags=["RAG Knowledge Store"])


class SearchResult(BaseModel):
    content: str
    metadata: Dict[str, Any]


class IngestResponse(BaseModel):
    status: str
    chunks_ingested: int
    message: str


@router.post("/ingest", response_model=IngestResponse)
def trigger_ingestion(current_user: User = Depends(get_current_user)):
    """
    Scans the data directory, loads Markdown runbooks, splits them,
    and indexes them in the ChromaDB vector database.
    """
    try:
        count = ingest_runbooks()
        if count == 0:
            return IngestResponse(
                status="warning",
                chunks_ingested=0,
                message="No new runbooks were indexed. Please verify your runbooks directory has *.md files."
            )
        return IngestResponse(
            status="success",
            chunks_ingested=count,
            message=f"Successfully indexed and loaded runbooks into ChromaDB."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"In-memory/local document ingestion failed: {str(e)}"
        )


@router.get("/search", response_model=List[SearchResult])
def search_knowledge(
    query: str = Query(..., min_length=2, description="Search term or phrase to query the RAG base"),
    k: int = Query(3, ge=1, le=10, description="Number of document chunks to retrieve"),
    rag_service: RAGService = Depends(get_rag_service),
):
    """
    Queries ChromaDB for the closest document chunks matching the query string.
    """
    try:
        documents = rag_service.search(query, k=k)
        results = [
            SearchResult(
                content=doc.page_content,
                metadata=doc.metadata
            )
            for doc in documents
        ]
        return results
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Vector similarity search failed: {str(e)}"
        )
