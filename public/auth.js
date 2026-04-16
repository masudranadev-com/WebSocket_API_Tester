const form = document.getElementById("auth-form");
const feedback = document.getElementById("auth-feedback");

function setFeedback(message, type) {
  feedback.textContent = message;
  feedback.className =
    "mt-6 rounded-2xl border px-4 py-3 text-sm " +
    (type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700");
  feedback.classList.remove("hidden");
}

if (form && feedback) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Opening workspace...";

    const formData = new FormData(form);
    const payload = {
      username: String(formData.get("username") || ""),
      password: String(formData.get("password") || "")
    };

    try {
      const response = await fetch("/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to continue.");
      }

      setFeedback("Workspace ready. Redirecting now.", "success");
      window.location.assign(data.redirectTo || "/dashboard");
    } catch (error) {
      setFeedback(error.message, "error");
      submitButton.disabled = false;
      submitButton.textContent = "Continue to dashboard";
    }
  });
}
