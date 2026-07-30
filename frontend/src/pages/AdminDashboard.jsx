import { useEffect, useState } from "react";
import api from "../api/axios";

export default function AdminDashboard() {
  const [urls, setUrls] = useState([]);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ url: "", label: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [urlsRes, statusRes] = await Promise.all([
      api.get("/admin/urls"),
      api.get("/admin/status"),
    ]);
    setUrls(urlsRes.data.urls);
    setStatus(statusRes.data);
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id) => {
    await api.patch(`/admin/urls/${id}/approve`);
    await load();
  };

  const reject = async (id) => {
    await api.patch(`/admin/urls/${id}/reject`);
    await load();
  };

  const remove = async (id) => {
    await api.delete(`/admin/urls/${id}`);
    await load();
  };

  const addUrl = async (e) => {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      await api.post("/admin/urls", form);
      setForm({ url: "", label: "" });
      setMsg("URL added and approved.");
      await load();
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to add URL");
    } finally {
      setBusy(false);
    }
  };

  const triggerNow = async () => {
    setMsg("Triggering ping cycle...");
    await api.post("/admin/trigger-now");
    setMsg("Ping cycle complete.");
    await load();
  };

  const pending = urls.filter((u) => u.status === "pending");
  const others = urls.filter((u) => u.status !== "pending");

  return (
    <div className="page">
      <h2>Admin Dashboard</h2>

      {status && (
        <div className="card stats-card">
          <div>
            <strong>Interval:</strong> every {status.intervalMinutes} min
          </div>
          <div>
            <strong>Last pulse:</strong>{" "}
            {status.lastPulseAt ? new Date(status.lastPulseAt).toLocaleString() : "Never yet"}
          </div>
          <div>
            <strong>Last pulse pinged:</strong> {status.lastPulseCount} url(s)
          </div>
          <div>
            <strong>Approved / Pending / Rejected:</strong> {status.approvedCount} /{" "}
            {status.pendingCount} / {status.rejectedCount}
          </div>
          <button onClick={triggerNow}>Trigger cycle now</button>
        </div>
      )}

      <h3>Add a URL directly (auto-approved, no limit)</h3>
      <form className="card inline-form" onSubmit={addUrl}>
        {msg && <div className="alert-info">{msg}</div>}
        <input
          type="text"
          placeholder="Label (optional)"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
        <input
          type="url"
          placeholder="https://some-service.onrender.com/health"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          required
        />
        <button type="submit" disabled={busy}>
          {busy ? "Adding..." : "Add URL"}
        </button>
      </form>

      <h3>Pending approval ({pending.length})</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Owner</th>
            <th>Label</th>
            <th>URL</th>
            <th>Submitted</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pending.map((u) => (
            <tr key={u._id}>
              <td>{u.owner?.email || "-"}</td>
              <td>{u.label || "-"}</td>
              <td className="url-cell">{u.url}</td>
              <td>{new Date(u.createdAt).toLocaleString()}</td>
              <td>
                <button className="link-btn" onClick={() => approve(u._id)}>
                  Approve
                </button>
                <button className="link-btn danger" onClick={() => reject(u._id)}>
                  Reject
                </button>
              </td>
            </tr>
          ))}
          {pending.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                Nothing pending.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3>All other submissions</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Owner</th>
            <th>Label</th>
            <th>URL</th>
            <th>Status</th>
            <th>Last Ping</th>
            <th>Last Result</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {others.map((u) => (
            <tr key={u._id}>
              <td>{u.addedByAdmin ? "admin" : u.owner?.email || "-"}</td>
              <td>{u.label || "-"}</td>
              <td className="url-cell">{u.url}</td>
              <td>
                <span className={`badge badge-${u.status}`}>{u.status}</span>
              </td>
              <td>{u.lastPingedAt ? new Date(u.lastPingedAt).toLocaleString() : "Never yet"}</td>
              <td>{u.lastStatus || "-"}</td>
              <td>
                <button className="link-btn danger" onClick={() => remove(u._id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
