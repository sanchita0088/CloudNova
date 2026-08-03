import React from 'react';
import { Search, Loader2 } from 'lucide-react';

export function RAGPage({
  handleIngest,
  ingesting,
  ingestStatus,
  handleSearch,
  searchQuery,
  setSearchQuery,
  searchLoading,
  searchResults
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-abstra-dark font-display">RAG Knowledge Base</h2>
          <p className="text-abstra-muted text-xs mt-1">Query runbooks and SOP documents indexed inside ChromaDB vector store.</p>
        </div>
        <button 
          onClick={handleIngest}
          disabled={ingesting}
          className="px-4 py-2 border border-stone-300 hover:bg-white text-abstra-dark rounded-full text-xs font-medium transition disabled:opacity-50 flex items-center space-x-2 bg-stone-100"
        >
          {ingesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          <span>Reload Runbook Index</span>
        </button>
      </div>

      {ingestStatus && (
        <div className={`p-4 rounded-2xl border text-xs font-mono ${ingestStatus.status === 'success' ? 'bg-signal-teal/10 text-signal-teal border-signal-teal/20' : 'bg-ember-orange/10 text-ember-orange border-ember-orange/20'}`}>
          {ingestStatus.message}
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-6 shadow-sm">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-abstra-muted" />
            <input 
              type="text" 
              placeholder="Search runbooks (e.g. 'database exhausted', 'bcrypt rounds', 'CrashLoopBackOff')..." 
              className="w-full pl-11 pr-4 py-3 bg-canvas-card border border-stone-200 rounded-full text-abstra-dark focus:outline-none focus:border-abstra-mauve text-xs transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            type="submit"
            disabled={searchLoading}
            className="px-6 py-3 bg-abstra-dark text-white rounded-full text-xs font-medium hover:bg-black transition flex items-center space-x-2 disabled:opacity-50"
          >
            {searchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            <span>Search</span>
          </button>
        </form>

        <div className="space-y-4">
          {searchResults.length === 0 ? (
            <div className="border border-dashed border-stone-200 rounded-2xl p-12 text-center text-abstra-muted text-xs font-mono">
              Query runbooks using search terms above to fetch semantic vector matches from local index.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map((result, idx) => (
                <div key={idx} className="bg-stone-50 border border-stone-200/80 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-abstra-dark font-mono">{result.metadata.source}</span>
                    <span className="text-[10px] font-medium px-2.5 py-0.5 bg-abstra-mauve/15 text-abstra-mauve rounded-full font-mono">
                      Vector Match
                    </span>
                  </div>
                  <pre className="text-xs text-abstra-dark leading-relaxed font-mono whitespace-pre-wrap max-h-48 overflow-y-auto bg-white p-3 rounded-xl border border-stone-200/60">
                    {result.content}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
