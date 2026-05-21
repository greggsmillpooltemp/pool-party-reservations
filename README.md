# Pool Party Reservation Calendar

This is a static reservation widget for GitHub Pages and Blogger. It shows a monthly calendar, marks booked days, and lets a family reserve one 2-hour party slot with 2 tables.

## Rules Built In

- Pool hours are Sunday-Thursday 7:00 AM-9:00 PM.
- Pool hours are Friday-Saturday 7:00 AM-10:00 PM.
- Reservations are exactly 2 hours.
- Reservations include exactly 2 tables.
- Only 1 party can reserve the pool per day.
- Past dates cannot be selected.
- Admin login can cancel a reservation and reopen that day.

## Files

- `index.html` is the page.
- `styles.css` controls the look.
- `script.js` controls the calendar and booking form.
- `apps-script.js` is the Google Apps Script backend that saves bookings to a Google Sheet and emails `greggsmillgraniteville@gmail.com`.

## Set Up The Google Sheet Backend

1. Create a Google Sheet named `Pool Reservations`.
2. In the sheet, go to `Extensions` -> `Apps Script`.
3. Delete the starter code and paste everything from `apps-script.js`.
4. Click `Save`.
5. Click `Deploy` -> `New deployment`.
6. Choose `Web app`.
7. Set `Execute as` to `Me`.
8. Set `Who has access` to `Anyone`.
9. Deploy and copy the Web app URL.
10. Open `script.js` and paste that URL into `apiUrl`.
11. Google may ask you to authorize email permissions the first time the script is deployed or tested.
12. In `apps-script.js`, change `ADMIN_PASSWORD` from `change-this-password` to the password you want to use.

Example:

```js
const CONFIG = {
  apiUrl: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",
  timeZone: "America/New_York",
};
```

Until `apiUrl` is filled in, the page runs in demo mode and saves bookings only in the browser.

## Email Notifications

Reservation emails are sent by Google Apps Script with `MailApp` to `greggsmillgraniteville@gmail.com`.

If the email does not arrive:

1. Confirm you pasted the newest `apps-script.js` into Apps Script.
2. Click `Deploy` -> `Manage deployments` -> edit the web app deployment and create a new version.
3. Run or deploy once and approve Google's email permission prompt.
4. Check the Apps Script `Executions` tab for mail permission or quota errors.

The booking page now reports if the reservation was saved but Google blocked the email notification.

## Admin Cancellations

The admin panel is at the bottom of the page. Enter the password from `ADMIN_PASSWORD`, then use `Cancel` beside a reservation to remove it from the Google Sheet and make that date available again.

## Host On GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `styles.css`, `script.js`, `apps-script.js`, and `README.md`.
3. In the repository, go to `Settings` -> `Pages`.
4. Under `Build and deployment`, choose `Deploy from a branch`.
5. Choose the `main` branch and `/root`.
6. Save.

GitHub will give you a URL like:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

## Add It To Blogger

Use an iframe in a Blogger page or post:

```html
<iframe
  src="https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/"
  style="width:100%;height:950px;border:0;"
  loading="lazy"
></iframe>
```

If the Blogger page feels cramped on phones, increase the height to `1100px`.
