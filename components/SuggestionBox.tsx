"use client";

import { FormEvent, useState } from "react";

export default function SuggestionBox() {
  const [idea, setIdea] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = idea.trim();
    if (!trimmed) return;

    const subject = encodeURIComponent("Project suggestion");
    const body = encodeURIComponent(trimmed);
    window.location.href = `mailto:malvika.jain@icloud.com?subject=${subject}&body=${body}`;
    setIdea("");
  }

  return (
    <form className="kit-suggest-form" onSubmit={handleSubmit}>
      <input
        id="project-suggestion"
        className="kit-suggest-input"
        name="suggestion"
        type="text"
        placeholder="suggest a project..."
        value={idea}
        onChange={(event) => setIdea(event.target.value)}
        required
        aria-label="Suggest a project"
      />
      <button className="kit-suggest-button" type="submit">
        send
      </button>
    </form>
  );
}
