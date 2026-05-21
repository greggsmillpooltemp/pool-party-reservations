const SHEET_NAME = "Reservations";
const NOTIFICATION_EMAIL = "greggsmillgraniteville@gmail.com";
const ADMIN_PASSWORD = "hoapool2026admin@";
const SPREADSHEET_ID = "";

function doGet(e) {
  try {
    const action = e.parameter.action || "list";
    if (action !== "list") {
      return json({ ok: false, error: "Unknown action." });
    }

    const month = e.parameter.month || "";
    const reservations = getReservations(month).map((reservation) => ({
      date: reservation.date,
      timeSlot: reservation.timeSlot,
    }));
    return json({ ok: true, reservations });
  } catch (error) {
    return json({ ok: false, error: error.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const action = payload.action || "reserve";

    if (action === "reserve") {
      return reserve(payload);
    }

    requireAdmin(payload.password);

    if (action === "adminList") {
      return json({ ok: true, reservations: getReservations("") });
    }

    if (action === "cancel") {
      return cancelReservation(payload.date);
    }

    return json({ ok: false, error: "Unknown action." });
  } catch (error) {
    return json({ ok: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

function reserve(payload) {
  validatePayload(payload);

  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  const existing = rows.slice(1).find((row) => row[0] === payload.date);
  if (existing) {
    return json({ ok: false, error: "This day has already been reserved." });
  }

  sheet.appendRow([
    payload.date,
    payload.timeSlot,
    payload.name,
    payload.contact,
    payload.address,
    2,
    2,
    new Date(),
  ]);

  const emailResult = sendReservationEmail(payload);
  return json({
    ok: true,
    emailSent: emailResult.sent,
    emailError: emailResult.error,
  });
}

function cancelReservation(date) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(date || "")) {
    return json({ ok: false, error: "A valid date is required." });
  }

  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === date);

  if (rowIndex === -1) {
    return json({ ok: false, error: "Reservation was not found." });
  }

  sheet.deleteRow(rowIndex + 1);
  return json({ ok: true });
}

function getReservations(month) {
  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  return rows
    .slice(1)
    .filter((row) => !month || String(row[0]).indexOf(month) === 0)
    .map((row) => ({
      date: String(row[0]),
      timeSlot: String(row[1]),
      name: String(row[2]),
      contact: String(row[3]),
      address: String(row[4] || ""),
      tables: Number(row[5] || 2),
      hours: Number(row[6] || 2),
      createdAt: row[7] ? new Date(row[7]).toISOString() : "",
    }));
}

function validatePayload(payload) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const timePattern = /^\d{2}:00-\d{2}:00$/;

  if (!datePattern.test(payload.date || "")) {
    throw new Error("A valid date is required.");
  }

  if (!timePattern.test(payload.timeSlot || "")) {
    throw new Error("A valid 2-hour time slot is required.");
  }

  if (!String(payload.name || "").trim()) {
    throw new Error("Name is required.");
  }

  if (!String(payload.contact || "").trim()) {
    throw new Error("Phone or email is required.");
  }

  if (!String(payload.address || "").trim()) {
    throw new Error("Address is required.");
  }

  const startHour = Number(payload.timeSlot.slice(0, 2));
  const endHour = Number(payload.timeSlot.slice(6, 8));
  if (endHour - startHour !== 2) {
    throw new Error("Reservations must be exactly 2 hours.");
  }

  const day = new Date(payload.date + "T12:00:00").getDay();
  const closeHour = day === 5 || day === 6 ? 22 : 21;
  if (startHour < 7 || endHour > closeHour) {
    throw new Error("That time is outside pool hours.");
  }
}

function sendReservationEmail(payload) {
  const subject = "New pool party reservation";
  const body = [
    "A new pool party reservation has been made.",
    "",
    "Date: " + payload.date,
    "Time slot: " + payload.timeSlot,
    "Name: " + payload.name,
    "Phone or email: " + payload.contact,
    "Address: " + payload.address,
    "Tables: 2",
    "Hours: 2",
  ].join("\n");

  try {
    MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
    return { sent: true, error: "" };
  } catch (error) {
    return { sent: false, error: error.message };
  }
}

function requireAdmin(password) {
  if (String(password || "") !== ADMIN_PASSWORD) {
    throw new Error("Invalid admin password.");
  }
}

function getSheet() {
  const spreadsheet = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow(["Date", "Time Slot", "Name", "Contact", "Address", "Tables", "Hours", "Created At"]);
    sheet.setFrozenRows(1);
  } else {
    ensureAddressColumn(sheet);
  }

  return sheet;
}

function ensureAddressColumn(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1));
  const headers = headerRange.getValues()[0];
  if (headers[4] === "Address") return;

  sheet.insertColumnAfter(4);
  sheet.getRange(1, 1, 1, 8).setValues([
    ["Date", "Time Slot", "Name", "Contact", "Address", "Tables", "Hours", "Created At"],
  ]);
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
