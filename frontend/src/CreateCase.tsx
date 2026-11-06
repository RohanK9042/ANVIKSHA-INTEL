
import { useState } from "react";
import { createCase } from "./api";

interface Props {
  onCreated: () => void;
}

function CreateCase({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const result = await createCase({
        title,
        description,
        priority,
      });

      setMessage(`Case created: ${result.case.case_id}`);
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      onCreated();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel create-case-panel">
      <div className="panel-heading">
        <div>
          <h3>Register Investigation</h3>
          <p>Create a new investigation record</p>
        </div>
        <span className="panel-label">NEW CASE</span>
      </div>

      <form onSubmit={handleSubmit} className="case-form">
        <label>Investigation Title</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Enter investigation title"
          minLength={3}
          maxLength={200}
          required
        />

        <label>Description</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the investigation..."
          maxLength={5000}
          rows={3}
        />

        <label>Priority</label>
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>

        <button type="submit" disabled={saving}>
          {saving ? "Creating..." : "Create Investigation"}
        </button>

        {message && <p className="form-message">{message}</p>}
      </form>
    </div>
  );
}

export default CreateCase;
