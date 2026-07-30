import { useEffect, useState } from "react";
import api from "../api/axios";

const FREE_TIER_LIMIT = 2;

export default function Dashboard() {
  const [urls, setUrls] = useState([]);
  const [form, setForm] = useState({ url: "", label: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await api.get("/urls");
    setUrls(res.data.urls);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/urls", form);
      setForm({ url: "", label: "" });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit URL");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    await api.delete(`/urls/${id}`);
    await load();
  };

  const atLimit = urls.length >= FREE_TIER_LIMIT;

  return (
    <div className="page">
      <h2>Your Submitted URLs</h2>
      <p className="muted">
        Free tier: {urls.length}/{FREE_TIER_LIMIT} URLs used. Approved URLs get pinged every 13
        minutes to keep your backend awake.
      </p>

      {!atLimit ? (
        <form className="card inline-form" onSubmit={handleSubmit}>
          {error && <div className="alert-error">{error}</div>}
          <input
            type="text"
            placeholder="Label (optional)"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
          <input
            type="url"
            placeholder="https://your-backend.onrender.com/health"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            required
          />
          <button type="submit" disabled={busy}>
            {busy ? "Submitting..." : "Submit URL"}
          </button>
        </form>
      ) : (
        <div className="alert-info">
          You've reached the free tier limit. Want more? Check out the Pro plan.
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Label</th>
            <th>URL</th>
            <th>Status</th>
            <th>Last Ping</th>
            <th>Last Result</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {urls.map((u) => (
            <tr key={u._id}>
              <td>{u.label || "-"}</td>
              <td className="url-cell">{u.url}</td>
              <td>
                <span className={`badge badge-${u.status}`}>{u.status}</span>
              </td>
              <td>{u.lastPingedAt ? new Date(u.lastPingedAt).toLocaleString() : "Never yet"}</td>
              <td>{u.lastStatus || "-"}</td>
              <td>
                {u.status !== "approved" && (
                  <button className="link-btn danger" onClick={() => handleDelete(u._id)}>
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
          {urls.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                No URLs submitted yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
