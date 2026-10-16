"use client";

/** Dropdown that filters submissions by who submitted them; submits its form on change. */
export function AgentFilter({ agents, value }: { agents: { id: string; name: string }[]; value: string }) {
  return (
    <select
      name="agent"
      className="input"
      defaultValue={value}
      aria-label="Filter by agent"
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      <option value="">Everyone</option>
      {agents.length > 0 && (
        <optgroup label="Agents">
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
