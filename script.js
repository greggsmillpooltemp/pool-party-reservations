(function () {
  const CONFIG = {
    // Paste your deployed Google Apps Script web app URL here.
    apiUrl: "https://script.google.com/macros/s/AKfycbwI83wWZKNRLswiSct9XI7xG3PwibPS7mTNnfIyIzV0ThFBcYfg6IiuTt15yAOlOBJfOQ/exec",
    timeZone: "America/New_York",
  };

  const els = {
    monthLabel: document.querySelector("#monthLabel"),
    calendarGrid: document.querySelector("#calendarGrid"),
    prevMonth: document.querySelector("#prevMonth"),
    nextMonth: document.querySelector("#nextMonth"),
    refreshButton: document.querySelector("#refreshButton"),
    selectedDateText: document.querySelector("#selectedDateText"),
    form: document.querySelector("#reservationForm"),
    guestName: document.querySelector("#guestName"),
    contact: document.querySelector("#contact"),
    address: document.querySelector("#address"),
    timeSlot: document.querySelector("#timeSlot"),
    submitButton: document.querySelector("#submitButton"),
    formMessage: document.querySelector("#formMessage"),
    adminLoginForm: document.querySelector("#adminLoginForm"),
    adminPassword: document.querySelector("#adminPassword"),
    adminRefreshButton: document.querySelector("#adminRefreshButton"),
    adminList: document.querySelector("#adminList"),
    adminMessage: document.querySelector("#adminMessage"),
  };

  const state = {
    monthCursor: startOfMonth(new Date()),
    selectedDate: null,
    reservations: new Map(),
    loading: false,
    adminPassword: "",
    adminReservations: [],
  };

  els.prevMonth.addEventListener("click", () => changeMonth(-1));
  els.nextMonth.addEventListener("click", () => changeMonth(1));
  els.refreshButton.addEventListener("click", () => loadReservations());
  els.form.addEventListener("submit", reserveParty);
  els.adminLoginForm.addEventListener("submit", adminLogin);
  els.adminRefreshButton.addEventListener("click", () => loadAdminReservations());

  loadReservations();

  async function loadReservations() {
    setMessage("Checking availability...", "");
    state.loading = true;
    renderCalendar();

    try {
      const reservations = CONFIG.apiUrl ? await fetchReservations() : loadLocalReservations();
      state.reservations = new Map(reservations.map((item) => [item.date, item]));
      setMessage(CONFIG.apiUrl ? "" : "Demo mode: add your Google Apps Script URL to save real bookings.", "");
    } catch (error) {
      setMessage("Could not load reservations. Please try refresh.", "error");
    } finally {
      state.loading = false;
      renderCalendar();
      updateSelectedDate();
    }
  }

  async function fetchReservations() {
    const month = toMonthKey(state.monthCursor);
    const response = await fetch(`${CONFIG.apiUrl}?action=list&month=${encodeURIComponent(month)}`);
    if (!response.ok) throw new Error("Availability request failed");
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "Availability request failed");
    return payload.reservations || [];
  }

  function loadLocalReservations() {
    const all = JSON.parse(localStorage.getItem("poolReservations") || "[]");
    const month = toMonthKey(state.monthCursor);
    return all.filter((item) => item.date.startsWith(month));
  }

  function saveLocalReservation(reservation) {
    const all = JSON.parse(localStorage.getItem("poolReservations") || "[]");
    if (all.some((item) => item.date === reservation.date)) {
      throw new Error("This day has already been reserved.");
    }
    all.push(reservation);
    localStorage.setItem("poolReservations", JSON.stringify(all));
  }

  function renderCalendar() {
    els.calendarGrid.innerHTML = "";
    els.monthLabel.textContent = state.monthCursor.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    const year = state.monthCursor.getFullYear();
    const month = state.monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    for (let i = 0; i < firstDay.getDay(); i += 1) {
      const blank = document.createElement("button");
      blank.type = "button";
      blank.className = "day-button blank";
      blank.disabled = true;
      blank.setAttribute("aria-hidden", "true");
      els.calendarGrid.appendChild(blank);
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(year, month, day);
      const key = toDateKey(date);
      const reservation = state.reservations.get(key);
      const isPast = isBeforeToday(date);
      const isSelected = state.selectedDate === key;
      const button = document.createElement("button");
      button.type = "button";
      button.className = [
        "day-button",
        reservation ? "booked" : "available",
        isPast ? "past" : "",
        isSelected ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      button.disabled = Boolean(reservation) || isPast || state.loading;
      button.innerHTML = `<span class="number">${day}</span><span class="state">${
        reservation ? "Booked" : isPast ? "Past" : "Available"
      }</span>`;
      button.addEventListener("click", () => {
        state.selectedDate = key;
        renderCalendar();
        updateSelectedDate();
      });
      els.calendarGrid.appendChild(button);
    }
  }

  function updateSelectedDate() {
    if (!state.selectedDate) {
      els.selectedDateText.textContent = "Select an available day.";
      fillSlots([]);
      els.submitButton.disabled = true;
      return;
    }

    const date = fromDateKey(state.selectedDate);
    const reservation = state.reservations.get(state.selectedDate);
    if (reservation) {
      els.selectedDateText.textContent = "That day is already booked.";
      fillSlots([]);
      els.submitButton.disabled = true;
      return;
    }

    els.selectedDateText.textContent = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    fillSlots(getTimeSlots(date));
    els.submitButton.disabled = false;
  }

  function fillSlots(slots) {
    els.timeSlot.innerHTML = "";
    if (!slots.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = state.selectedDate ? "No slots available" : "Choose a date first";
      els.timeSlot.appendChild(option);
      els.timeSlot.disabled = true;
      return;
    }

    for (const slot of slots) {
      const option = document.createElement("option");
      option.value = slot.value;
      option.textContent = slot.label;
      els.timeSlot.appendChild(option);
    }
    els.timeSlot.disabled = false;
  }

  function getTimeSlots(date) {
    const day = date.getDay();
    const closeHour = day === 5 || day === 6 ? 22 : 21;
    const slots = [];
    for (let hour = 7; hour <= closeHour - 2; hour += 1) {
      slots.push({
        value: `${pad(hour)}:00-${pad(hour + 2)}:00`,
        label: `${formatHour(hour)}-${formatHour(hour + 2)}`,
      });
    }
    return slots;
  }

  async function reserveParty(event) {
    event.preventDefault();
    if (!state.selectedDate) return;

    const reservation = {
      date: state.selectedDate,
      timeSlot: els.timeSlot.value,
      name: els.guestName.value.trim(),
      contact: els.contact.value.trim(),
      address: els.address.value.trim(),
      tables: 2,
      hours: 2,
    };

    if (!reservation.name || !reservation.contact || !reservation.address || !reservation.timeSlot) {
      setMessage("Please complete all fields.", "error");
      return;
    }

    els.submitButton.disabled = true;
    setMessage("Saving reservation...", "");

    try {
      let emailWarning = "";
      if (CONFIG.apiUrl) {
        const response = await fetch(CONFIG.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "reserve", ...reservation }),
        });
        const payload = await response.json();
        if (!payload.ok) throw new Error(payload.error || "Reservation failed");
        if (payload.emailSent === false) {
          emailWarning = payload.emailError || "Google did not send the notification email.";
        }
      } else {
        saveLocalReservation(reservation);
      }

      els.form.reset();
      state.selectedDate = null;
      await loadReservations();
      if (state.adminPassword) await loadAdminReservations();
      if (emailWarning) {
        setMessage(`Reserved, but email notification failed: ${emailWarning}`, "error");
        window.alert("Your reservation was saved, but the email notification could not be sent. Please check the Apps Script email permissions.");
      } else {
        setMessage("Reserved. This day is now marked booked.", "success");
        window.alert("Your reservation request has been sent. This day is now marked as booked.");
      }
    } catch (error) {
      setMessage(error.message || "Could not save reservation.", "error");
      els.submitButton.disabled = false;
    }
  }

  async function adminLogin(event) {
    event.preventDefault();
    state.adminPassword = els.adminPassword.value.trim();
    if (!state.adminPassword) {
      setAdminMessage("Enter the admin password.", "error");
      return;
    }

    els.adminRefreshButton.disabled = false;
    await loadAdminReservations();
  }

  async function loadAdminReservations() {
    if (!state.adminPassword) return;
    setAdminMessage("Loading admin reservations...", "");

    try {
      if (!CONFIG.apiUrl) {
        state.adminReservations = loadLocalReservations();
      } else {
        const payload = await apiPost({ action: "adminList", password: state.adminPassword });
        state.adminReservations = payload.reservations || [];
      }
      renderAdminReservations();
      setAdminMessage("", "");
    } catch (error) {
      state.adminPassword = "";
      els.adminRefreshButton.disabled = true;
      renderAdminReservations();
      setAdminMessage(error.message || "Admin login failed.", "error");
    }
  }

  function renderAdminReservations() {
    if (!state.adminPassword) {
      els.adminList.textContent = "Admin reservations will appear here after login.";
      return;
    }

    if (!state.adminReservations.length) {
      els.adminList.textContent = "No reservations found.";
      return;
    }

    els.adminList.innerHTML = "";
    for (const reservation of state.adminReservations) {
      const item = document.createElement("article");
      item.className = "admin-reservation";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(formatDateLabel(reservation.date))}</strong>
          <span>${escapeHtml(reservation.timeSlot || "")}</span>
          <span>${escapeHtml(reservation.name || "")}</span>
          <span>${escapeHtml(reservation.contact || "")}</span>
          <span>${escapeHtml(reservation.address || "")}</span>
        </div>
        <button type="button" class="danger-button" data-date="${escapeHtml(reservation.date)}">
          Cancel
        </button>
      `;
      item.querySelector("button").addEventListener("click", () => cancelReservation(reservation.date));
      els.adminList.appendChild(item);
    }
  }

  async function cancelReservation(date) {
    const reservation = state.adminReservations.find((item) => item.date === date);
    const label = reservation ? formatDateLabel(reservation.date) : date;
    if (!window.confirm(`Cancel the reservation for ${label} and reopen that day?`)) return;

    setAdminMessage("Cancelling reservation...", "");
    try {
      if (CONFIG.apiUrl) {
        await apiPost({ action: "cancel", password: state.adminPassword, date });
      } else {
        const all = JSON.parse(localStorage.getItem("poolReservations") || "[]");
        localStorage.setItem("poolReservations", JSON.stringify(all.filter((item) => item.date !== date)));
      }
      setAdminMessage("Reservation cancelled. The day is available again.", "success");
      await loadReservations();
      await loadAdminReservations();
    } catch (error) {
      setAdminMessage(error.message || "Could not cancel reservation.", "error");
    }
  }

  async function apiPost(payload) {
    const response = await fetch(CONFIG.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Request failed");
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Request failed");
    return result;
  }

  function setMessage(text, type) {
    els.formMessage.textContent = text;
    els.formMessage.className = `form-message ${type || ""}`.trim();
  }

  function setAdminMessage(text, type) {
    els.adminMessage.textContent = text;
    els.adminMessage.className = `form-message ${type || ""}`.trim();
  }

  function changeMonth(amount) {
    state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() + amount, 1);
    state.selectedDate = null;
    loadReservations();
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function toDateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function toMonthKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  function fromDateKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDateLabel(key) {
    return fromDateKey(key).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function isBeforeToday(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compare = new Date(date);
    compare.setHours(0, 0, 0, 0);
    return compare < today;
  }

  function formatHour(hour) {
    const period = hour >= 12 ? "PM" : "AM";
    const normalized = hour % 12 || 12;
    return `${normalized}:00 ${period}`;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
