import { useDbStats } from "../../../api/hooks/cricket/useDbStats";
import { messageFor } from "../../../api/mutationErrors";
import { Button } from "../../components/Button";
import { ListCard } from "../../components/ListCard";
import { Loader } from "../../components/Loader";
import { CricketKpis } from "../CricketKpis";
import { HomeSection } from "../HomeSection";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";

const UNITS = ["B", "KB", "MB", "GB", "TB"];

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 || value >= 100 ? 0 : 1)} ${UNITS[unit]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// Super admins: how big the MongoDB database the whole Girish Creations API
// shares has grown, and which collections take up the room.
export function DatabaseStatsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useDbStats();
  const totals = data?.totals;
  const onDisk = (c: { storageSize: number | null; indexSize: number | null }) => (c.storageSize ?? 0) + (c.indexSize ?? 0);
  const largest = Math.max(1, ...(data?.collections ?? []).map(onDisk));

  return (
    <ListCard
      title="Database"
      icon="fa-solid fa-database"
      subtitle={
        data
          ? [data.database, data.version && `MongoDB ${data.version}`].filter(Boolean).join(" · ") || "MongoDB"
          : "MongoDB storage at a glance"
      }
      plain
      action={
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <i className={`fa-solid fa-rotate ${isFetching ? "fa-spin" : ""}`.trim()} aria-hidden="true"></i> Refresh
        </Button>
      }
    >
      {isLoading ? (
        <Loader label="Reading the database" />
      ) : isError || !data ? (
        <div className="admin-empty-state">{messageFor(error)}</div>
      ) : (
        <div className="cricket-home">
          {totals && (
            <CricketKpis
              variant="hero"
              items={[
                { label: "Total size", value: formatBytes(totals.totalSize), icon: "fa-hard-drive", tone: "total", hint: "Storage plus indexes" },
                { label: "Documents", value: totals.objects.toLocaleString(), icon: "fa-file-lines", tone: "active" },
                { label: "Collections", value: totals.collections, icon: "fa-layer-group", tone: "login" },
                { label: "Indexes", value: totals.indexes, icon: "fa-list-ol", tone: "guest" },
              ]}
            />
          )}
          <HomeSection title="Storage and server" icon="fa-solid fa-server" tone="next">
            <dl className="cricket-db-facts">
              {totals && (
                <>
                  <div>
                    <dt>Data</dt>
                    <dd>{formatBytes(totals.dataSize)}</dd>
                  </div>
                  <div>
                    <dt>Storage</dt>
                    <dd>{formatBytes(totals.storageSize)}</dd>
                  </div>
                  <div>
                    <dt>Index size</dt>
                    <dd>{formatBytes(totals.indexSize)}</dd>
                  </div>
                  <div>
                    <dt>Avg document</dt>
                    <dd>{formatBytes(Math.round(totals.avgObjSize))}</dd>
                  </div>
                  {totals.fsTotalSize !== null && totals.fsUsedSize !== null && (
                    <div>
                      <dt>Disk used</dt>
                      <dd>
                        {formatBytes(totals.fsUsedSize)} / {formatBytes(totals.fsTotalSize)}
                      </dd>
                    </div>
                  )}
                </>
              )}
              <div>
                <dt>Ping</dt>
                <dd>{data.pingMs} ms</dd>
              </div>
              {data.server?.connections && (
                <div>
                  <dt>Connections</dt>
                  <dd>
                    {data.server.connections.current} <small>/ {data.server.connections.current + data.server.connections.available}</small>
                  </dd>
                </div>
              )}
              {data.server && (
                <div>
                  <dt>Server uptime</dt>
                  <dd>{formatUptime(data.server.uptimeSeconds)}</dd>
                </div>
              )}
            </dl>
            <p className="admin-hint mb-0">Checked {new Date(data.checkedAt).toLocaleString()}</p>
          </HomeSection>

          {data.collections.length > 0 && (
            <HomeSection title={`Collections (${data.collections.length})`} icon="fa-solid fa-layer-group" tone="following">
              <div className="cricket-db-table-wrap">
                <table className="cricket-table cricket-db-table">
                  <thead>
                    <tr>
                      <th>Collection</th>
                      <th>Docs</th>
                      <th>Data</th>
                      <th>Storage</th>
                      <th>Indexes</th>
                      <th>Index size</th>
                      <th>Avg doc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.collections.map((c) => (
                      <tr key={c.name}>
                        <td>
                          <span className="cricket-db-name">{c.name}</span>
                          <span className="cricket-db-bar" aria-hidden="true">
                            <span style={{ width: `${(onDisk(c) / largest) * 100}%` }} />
                          </span>
                        </td>
                        <td>{c.count.toLocaleString()}</td>
                        <td>{formatBytes(c.size)}</td>
                        <td>{formatBytes(c.storageSize)}</td>
                        <td>{c.indexes ?? "—"}</td>
                        <td>{formatBytes(c.indexSize)}</td>
                        <td>{formatBytes(c.avgObjSize === null ? null : Math.round(c.avgObjSize))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </HomeSection>
          )}

          <div className="cricket-db-note">
            <strong>
              <i className="fa-solid fa-circle-info" aria-hidden="true"></i> About these numbers
            </strong>
            <ul>
              <li>
                <b>Total size</b> is what the database takes on disk: storage plus indexes.
              </li>
              <li>
                <b>Data</b> is the raw size of the documents; <b>Storage</b> is the space allocated for them (compressed,
                plus free room MongoDB keeps for growth), so it can be larger than the data.
              </li>
              <li>
                <b>Documents</b> counts records in every collection; <b>Indexes</b> are the lookup tables that keep
                queries fast, and <b>Index size</b> is the room they take.
              </li>
              <li>
                <b>Ping</b> is the round trip from the API to the database; <b>Connections</b> are open now out of
                the server's limit.
              </li>
              <li>The database is shared by all of Girish Creations (portfolio, expenses, savings and cricket).</li>
            </ul>
          </div>
        </div>
      )}
    </ListCard>
  );
}
