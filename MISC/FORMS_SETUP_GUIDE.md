# PROPERA FORMS TO GOOGLE SHEETS - SETUP GUIDE

## Overview
This system automatically captures form submissions from your website and writes them to Google Sheets with email notifications.

**Features:**
- ✅ Automatic Lead ID generation
- ✅ Email notifications to admin
- ✅ Data validation
- ✅ Error handling
- ✅ Success feedback to users

---

## STEP 1: Set Up Google Apps Script

### 1.1 Create Google Apps Script Project

1. Go to **https://script.google.com**
2. Click **"+ New Project"**
3. Name it: `"Propera Forms Handler"`

### 1.2 Copy the Script Code

1. Open the file: `gs-script-backup.js` (in your project root)
2. Copy ALL the code
3. In Google Apps Script editor, delete the default code
4. Paste the copied code
5. **IMPORTANT:** At the top of the script, verify:
   - Line 19: `SPREADSHEET_ID = "1_ChIJqKsQt2_4EZ86v20KxpGMOoW9NwciyC1Oahtp8A"` ✓
   - Line 20: `SHEET_NAME = "Sheet2"` ✓
   - Line 21: `ADMIN_EMAIL = "properaactivity@gmail.com"` ✓

### 1.3 Deploy as Web App

1. Click **"Deploy"** button (top right)
2. Click **"New Deployment"**
3. Click the gear icon ⚙️
4. Select **"Web App"**
5. Set:
   - **Execute as:** Your Google Account (the one that owns the sheet)
   - **Who has access:** "Anyone"
6. Click **"Deploy"**
7. **COPY THE DEPLOYMENT URL** - You'll need this!
   - Example: `https://script.google.com/macros/d/1ABC2DEF3GHI4JKL5M/userweb?v=1`

### 1.4 Grant Permissions

- Google will ask for permission to access your Google Sheet
- Click **"Allow"** to grant permissions
- The script now has access to write to your spreadsheet

---

## STEP 2: Update Your Website

### 2.1 Add Google Apps Script URL to Your Forms

1. Open `js/form-handler.js`
2. Find line 11: `const GOOGLE_APPS_SCRIPT_URL = "..."`
3. Replace with your deployment URL from Step 1.7
4. **Example:**
   ```javascript
   const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/d/1ABC2DEF3GHI4JKL5M/userweb?v=1";
   ```

### 2.2 Include Form Handler in HTML Files

For **each HTML file with a form**, add this in the `<head>` section:

```html
<script src="js/form-handler.js"></script>
```

### 2.3 Make Forms Auto-Submit to Google Sheets

#### Option A: Auto-Submit (Easiest)

Add `class="form-auto-submit"` to your form tag:

```html
<form class="form-auto-submit" data-source="Contact Form">
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="email" name="email" placeholder="Email">
  <input type="tel" name="phone" placeholder="Phone Number" required>
  <textarea name="message" placeholder="Your Message"></textarea>
  <button type="submit">Submit</button>
</form>
```

**Attributes explained:**
- `class="form-auto-submit"` - Enables automatic submission
- `data-source="Contact Form"` - What gets written to "Source" column in Sheet2
- `name="..."` - Must match form field names

#### Option B: Manual Submission (For Complex Forms)

```html
<form id="custom-form">
  <input type="text" name="name" required>
  <input type="tel" name="phone" required>
  <input type="text" name="property" placeholder="Property Name">
  <input type="text" name="interestedIn" placeholder="Interested In">
  <input type="text" name="budget" placeholder="Budget">
  <textarea name="message" placeholder="Message"></textarea>
  <button type="submit">Submit Inquiry</button>
</form>

<script>
document.getElementById('custom-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = {
    name: document.querySelector('input[name="name"]').value,
    phone: document.querySelector('input[name="phone"]').value,
    property: document.querySelector('input[name="property"]').value || "",
    interestedIn: document.querySelector('input[name="interestedIn"]').value || "",
    budget: document.querySelector('input[name="budget"]').value || "",
    message: document.querySelector('textarea[name="message"]').value || ""
  };
  
  await submitCustomForm(formData, "Property Inquiry");
});
</script>
```

---

## STEP 3: Form Field Mapping

Map your form fields to Google Sheets columns:

| Form Field | Sheet Column | Description |
|-----------|--------------|-------------|
| `name` | C (Name) | User's full name - **REQUIRED** |
| `phone` | D (Phone) | User's phone number - **REQUIRED** |
| `email` | K (Notes) | Email address (optional) |
| `property` | F (Property) | Property name they're interested in |
| `interestedIn` | G (Interested In) | Buy/Rent/Lease/etc |
| `budget` | H (Budget) | Budget range |
| `message` | K (Notes) | Additional message/notes |
| `source` | E (Source) | Auto-filled from `data-source` attribute |

### Example Contact Form:
```html
<form class="form-auto-submit" data-source="Contact Form">
  <input type="text" name="name" placeholder="Full Name" required>
  <input type="email" name="email" placeholder="Email Address">
  <input type="tel" name="phone" placeholder="Phone Number" required>
  <textarea name="message" placeholder="How can we help?"></textarea>
  <button type="submit">Contact Us</button>
</form>
```

### Example Property Inquiry Form:
```html
<form class="form-auto-submit" data-source="Property Inquiry">
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="tel" name="phone" placeholder="Phone Number" required>
  <input type="text" name="property" placeholder="Property Name" value="[auto-filled from page]">
  <input type="text" name="interestedIn" placeholder="Buy/Rent/Lease">
  <input type="text" name="budget" placeholder="Your Budget">
  <textarea name="message" placeholder="Tell us more about your requirements"></textarea>
  <button type="submit">Submit Inquiry</button>
</form>
```

---

## STEP 4: Forms to Update

Update these files to include form submissions. Add the form handler script to each:

### 📝 Contact Form
- **File:** `about-contact.html`
- **Source Value:** `"Contact Form"`
- **Fields:** name, email, phone, message

### 📝 Property Inquiry Form
- **File:** `property-detail.html`
- **Source Value:** `"Property Inquiry"`
- **Fields:** name, phone, property (pre-filled), interestedIn, budget, message

### 📝 Property Listing Inquiry
- **File:** `search.html` (and `searchbuy.html`, `searchrent.html`, etc.)
- **Source Value:** `"Search Inquiry"`
- **Fields:** name, phone, property (optional), interestedIn, budget

### 📝 Post Property Form
- **File:** `post-property.html`
- **Source Value:** `"Post Property"`
- **Fields:** name, phone, property, interestedIn, budget

### 📝 Login Form
- **File:** `login.html`
- **Source Value:** `"Login Attempt"` (if needed for tracking)
- **Fields:** email, phone (optional)

---

## STEP 5: Google Sheet Columns Reference

Your Sheet2 should have these columns (A-K):

```
A  | B     | C    | D     | E      | F        | G            | H      | I      | J          | K
---|-------|------|-------|--------|----------|--------------|--------|--------|------------|-------
Lead ID | Date | Name | Phone | Source | Property | Interested In | Budget | Status | Assigned To | Notes
```

**Auto-populated by system:**
- **A (Lead ID):** `LEAD-1234567890-ABC123DEF` (auto-generated)
- **B (Date):** Current date/time (auto-filled)
- **I (Status):** "New Lead" (auto-filled)
- **E (Source):** From `data-source` attribute

**User-filled from form:**
- **C (Name):** From `name` field
- **D (Phone):** From `phone` field
- **F (Property):** From `property` field
- **G (Interested In):** From `interestedIn` field
- **H (Budget):** From `budget` field
- **K (Notes):** From `message` field

**Manual fields (can be edited in Sheet):**
- **J (Assigned To):** Assign to agent
- **I (Status):** Update as needed (New Lead → Contacted → Qualified → etc.)

---

## STEP 6: Testing

### Test the Script

1. In Google Apps Script, find the `testFormSubmission()` function
2. Click **"Run"**
3. Check your Google Sheet - a new row should appear with test data
4. Check your email (`properaactivity@gmail.com`) - you should receive a notification

### Test Your Website Form

1. Go to your website
2. Fill out a form completely
3. Click Submit
4. You should see a success message: "Thank you! Your inquiry has been submitted. Lead ID: LEAD-..."
5. Check Google Sheet - new row should appear
6. Check email - notification should arrive

---

## STEP 7: Troubleshooting

### Forms Not Submitting?

**Error: "GOOGLE_APPS_SCRIPT_URL not configured"**
- ✅ Replace `GOOGLE_APPS_SCRIPT_URL` in `js/form-handler.js` with your deployment URL

**Error: "Script returned error: Authorization required"**
- ✅ Go to Google Apps Script
- ✅ Click Deploy again
- ✅ Make sure "Execute as" is YOUR Google account
- ✅ Make sure "Who has access" is set to "Anyone"

**Submissions appear but no email sent:**
- ✅ Check that `ADMIN_EMAIL` in Google Apps Script is correct
- ✅ Check spam/promotions folder for notification email
- ✅ Make sure Gmail is enabled for your Google account

**Data appears in wrong columns:**
- ✅ Check form field `name` attributes match the mapping table above
- ✅ Verify Sheet2 has headers in row 1

### Debugging

**Enable console logging:**
- Open DevTools (F12) in your browser
- Go to Console tab
- Submit a form
- Look for success/error messages

**Check Google Apps Script logs:**
- In Google Apps Script editor
- Click **"Execution log"** (or View > Logs)
- Look for any error messages

---

## STEP 8: Email Template Customization (Optional)

To customize the email notification, edit the `sendEmailNotification()` function in your Google Apps Script:

```javascript
function sendEmailNotification(leadId, data) {
  const emailSubject = `🏠 New Lead: ${data.name} - Propera`; // Custom subject
  
  const emailBody = `
  <h2>New Lead Received!</h2>
  <p><strong>Lead ID:</strong> ${leadId}</p>
  <p><strong>Name:</strong> ${data.name}</p>
  <p><strong>Phone:</strong> ${data.phone}</p>
  <p><strong>Property:</strong> ${data.property || "Not specified"}</p>
  <p><strong>Budget:</strong> ${data.budget || "Not specified"}</p>
  <p><strong>Source:</strong> ${data.source}</p>
  <hr>
  <p><a href="https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}">View in Google Sheets</a></p>
  `;

  GmailApp.sendEmail(ADMIN_EMAIL, emailSubject, emailBody, { noReply: true });
}
```

---

## STEP 9: Security Notes

✅ **Your data is secure:**
- Google Apps Script runs on Google's secure servers
- Only authorized (you) can edit the script
- Data is stored in your own Google Sheet
- No third-party services involved

⚠️ **Important:**
- Keep your Google Apps Script URL private
- Use HTTPS for your website (if you have one)
- Validate email addresses on the frontend

---

## STEP 10: Next Steps

Once everything is working:

1. ✅ Test with real form submissions
2. ✅ Set up automated lead assignment rules
3. ✅ Create follow-up email sequences
4. ✅ Build a CRM dashboard for managing leads
5. ✅ Add SMS notifications (optional: Twilio integration)

---

## Quick Reference - Deployment URL

Once you deploy the Google Apps Script, you'll get a URL like:

```
https://script.google.com/macros/d/SCRIPT_ID/userweb?v=1
```

**Extract the SCRIPT_ID** (the long alphanumeric string):
- It's between `/d/` and `/userweb`

**Update your form-handler.js:**
```javascript
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/d/YOUR_SCRIPT_ID/userweb?v=1";
```

---

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Google Apps Script logs
3. Check browser console (F12)
4. Verify all configuration values

---

**Setup Complete!** Your forms are now connected to Google Sheets! 🎉
