import React from 'react';

export function IncidentsPage({
  incidents,
  setSelectedIncident,
  handleResolve
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-abstra-dark font-display">Alert Manager</h2>
          <p className="text-abstra-muted text-xs mt-1">Full history of infrastructure incidents and automated alert triggers.</p>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-abstra-muted font-semibold text-xs uppercase tracking-wider">
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Service</th>
              <th className="px-6 py-4">Severity</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Message</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 font-mono text-xs">
            {incidents.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-16 text-abstra-muted">
                  No log history found. Use simulation to generate alerts.
                </td>
              </tr>
            ) : (
              incidents.map((incident) => (
                <tr 
                  key={incident.id} 
                  onClick={() => setSelectedIncident(incident)}
                  className="hover:bg-stone-50 transition cursor-pointer"
                >
                  <td className="px-6 py-4 font-bold text-abstra-dark">{incident.id}</td>
                  <td className="px-6 py-4 text-abstra-dark font-sans font-medium">{incident.service}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${incident.severity === 'critical' ? 'bg-alarm-red/15 text-alarm-red' : 'bg-ember-orange/15 text-ember-orange'}`}>
                      {incident.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${incident.status === 'active' ? 'bg-signal-teal/15 text-signal-teal' : 'bg-stone-200 text-abstra-muted'}`}>
                      {incident.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 max-w-xs truncate text-abstra-muted">{incident.message}</td>
                  <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end space-x-2">
                      {incident.status === 'active' && (
                        <button 
                          onClick={() => handleResolve(incident.id)}
                          className="px-3 py-1 border border-stone-300 hover:bg-stone-100 text-abstra-dark rounded-full text-xs transition font-sans font-medium"
                        >
                          Resolve
                        </button>
                      )}
                      <button 
                        onClick={() => setSelectedIncident(incident)}
                        className="px-3.5 py-1 bg-abstra-dark text-white rounded-full text-xs font-sans font-medium hover:bg-black transition"
                      >
                        Analyze
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
