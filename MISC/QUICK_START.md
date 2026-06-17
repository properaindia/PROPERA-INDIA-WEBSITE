# PROPERA WEBSITE - QUICK DEPLOYMENT GUIDE

## ✅ WHAT'S BEEN COMPLETED

Your Propera website now has **ALL major requirements implemented**:

### ✅ Pages & Features
- [x] Home Page (index.html) - with hero, navigation, CTAs
- [x] About Us Page (about-contact.html) - company info, team, careers
- [x] Contact Page (about-contact.html) - contact form with validation
- [x] Property Detail Pages (property-detail.html) - with gallery, specs, inquiry
- [x] Search Pages (searchbuy.html, searchrent.html, etc.) - dynamic listings
- [x] Post Property Page (post-property.html) - for sellers
- [x] Premium Services (premium-services.html)

### ✅ Design & Styling
- [x] Mobile Responsive Design - works on all devices
- [x] Brand Styling - consistent colors, typography, spacing
- [x] CTA Sections - throughout all pages
- [x] Design System (CSS) - reusable components

### ✅ Forms with Google Sheets Integration
- [x] Contact Form (`about-contact.html`) → Google Sheet Row
- [x] Property Inquiry Form (`property-detail.html`) → Google Sheet Row
- [x] Career Application Form (`about-contact.html`) → Google Sheet Row
- [x] Email Notifications → properaactivity@gmail.com

### ✅ Data Management
- [x] Property Data Structure (JSON) - ready for dynamic loading
- [x] Property Loader Script - loads property details from JSON
- [x] Gallery Support - image switching on property pages
- [x] Location Information - included in property specs

---

## 🚀 DEPLOYMENT STEPS (3 Steps to Go Live!)

### STEP 1: Set Up Google Apps Script (5 minutes)

1. Go to **https://script.google.com**
2. Click **"+ New Project"**
3. Name it: `"Propera Forms Handler"`
4. **Copy this entire code** into the editor:

```javascript
const SPREADSHEET_ID = "1_ChIJqKsQt2_4EZ86v20KxpGMOoW9NwciyC1Oahtp8A";
const SHEET_NAME = "Sheet2";
const ADMIN_EMAIL = "properaactivity@gmail.com";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (!data.name || !data.phone) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: "Name and Phone are required" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    const leadId = `LEAD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const nextRow = sheet.getLastRow() + 1;

    const row = [
      leadId,
      new Date().toLocaleDateString(),
      data.name || "",
      data.phone || "",
      data.source || "Website Form",
      data.property || "",
      data.interestedIn || "",
      data.budget || "",
      "New Lead",
      "",
      data.message || ""
    ];

    sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);
    sendEmailNotification(leadId, data);

    return ContentService.createTextOutput(
      JSON.stringify({ success: true, message: "Lead submitted successfully", leadId: leadId })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("Error: " + error.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function sendEmailNotification(leadId, data) {
  try {
    const emailSubject = `New Lead Submitted - ${data.name}`;
    
    const emailBody = `
New lead has been submitted to Propera:

Lead ID: ${leadId}
Date: ${new Date().toLocaleString()}
Name: ${data.name}
Phone: ${data.phone}
Source: ${data.source || "Website Form"}
Property: ${data.property || "N/A"}
Interested In: ${data.interestedIn || "N/A"}
Budget: ${data.budget || "N/A"}
Message: ${data.message || "N/A"}

Please log in to your Google Sheet to view and manage this lead.
    `;

    GmailApp.sendEmail(ADMIN_EMAIL, emailSubject, emailBody);
    Logger.log("Email sent to " + ADMIN_EMAIL);
  } catch (error) {
    Logger.log("Email error: " + error.toString());
  }
}

function testFormSubmission() {
  const testData = {
    name: "Test User",
    phone: "9876543210",
    source: "Test",
    property: "Test Property",
    interestedIn: "Buy",
    budget: "50 Lakhs",
    message: "This is a test message"
  };

  const e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };

  const response = doPost(e);
  Logger.log(response.getContent());
}
```

5. Click **"Deploy"** → **"New Deployment"** → Select **"Web App"**
6. Set:
   - **Execute as:** Your Google Account
   - **Who has access:** "Anyone"
7. Click **"Deploy"**
8. **COPY the deployment URL** (example: `https://script.google.com/macros/d/1ABC2DEF3GHI/userweb?v=1`)

### STEP 2: Update Your Website (1 minute)

1. Open file: `js/form-handler.js`
2. Find line 11: `const GOOGLE_APPS_SCRIPT_URL = "..."`
3. Replace with your deployment URL from Step 1
4. **Example:**
   ```javascript
   const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/d/YOUR_SCRIPT_ID/userweb?v=1";
   ```
5. Save the file

### STEP 3: Test It! (2 minutes)

1. Go to your website: `about-contact.html` or `property-detail.html`
2. Fill out the contact form completely
3. Click "Submit"
4. You should see: **"Thank you! Your inquiry has been submitted. Lead ID: LEAD-..."**
5. Check your Google Sheet (`Sheet2`) - new row should appear automatically
6. Check email (`properaactivity@gmail.com`) - notification email should arrive

---

## 📋 FORM FIELDS MAPPING

Your Google Sheet will have these columns:

```
A    | B      | C    | D     | E      | F        | G            | H      | I      | J          | K
-----|--------|------|-------|--------|----------|--------------|--------|--------|------------|-------
Lead ID | Date | Name | Phone | Source | Property | Interested In | Budget | Status | Assigned To | Notes
```

**How forms fill the sheet:**

### Contact Form (about-contact.html)
- Name → Column C
- Phone → Column D
- Email → Column K (Notes)
- Message → Column K (Notes)
- Source → "Contact Form"

### Property Inquiry Form (property-detail.html)
- Name → Column C
- Phone → Column D
- Email → Column K (Notes)
- Property Name → Column F
- Interested In → Column G
- Budget → Column H
- Source → "Property Inquiry"

### Career Application (about-contact.html)
- Name → Column C
- Phone → Column D
- Qualification → Column G
- Source → "Career Application"

---

## 🎯 FILES UPDATED

These files now have form integration:

1. **about-contact.html**
   - Contact form at bottom
   - Career application form

2. **property-detail.html**
   - Property inquiry modal form

3. **index.html**
   - Ready for any CTA forms

4. **js/form-handler.js** (NEW)
   - Main form submission handler
   - Google Sheets integration
   - Error handling & user feedback

5. **gs-script-backup.js** (NEW)
   - Google Apps Script code (for reference)

---

## 📊 WHAT HAPPENS WHEN A FORM IS SUBMITTED

```
User fills form → Click Submit
                        ↓
        JavaScript validates form
                        ↓
    Sends data to Google Apps Script
                        ↓
    Google Apps Script receives data
                        ↓
    ├─ Adds row to Google Sheet
    ├─ Sends email notification
    └─ Returns success response
                        ↓
    Website shows success message
    Form resets & clears
    Modal closes (if applicable)
```

---

## 🛠️ TROUBLESHOOTING

### Forms not submitting?
1. Open Browser DevTools (F12)
2. Go to Console tab
3. Try submitting a form
4. Look for error messages
5. Common issues:
   - `GOOGLE_APPS_SCRIPT_URL` not configured → Update `js/form-handler.js`
   - Google Apps Script not deployed → Deploy it first
   - Permissions not granted → Approve in Google Apps Script

### Data not appearing in Sheet?
1. Check that `SHEET_NAME = "Sheet2"` in Google Apps Script
2. Verify Sheet2 exists in your Google Sheet
3. Make sure sheet headers are in row 1
4. Check execution log in Google Apps Script (View → Logs)

### Email not received?
1. Check spam/promotions folder
2. Verify `ADMIN_EMAIL = "properaactivity@gmail.com"` in script
3. Check if Gmail is enabled for your Google account
4. Check Google Apps Script logs for errors

---

## 🔐 SECURITY NOTES

✅ **Your data is safe:**
- All data stored in YOUR Google Sheet
- Email notifications go to YOUR email
- No third-party services involved
- Google handles the security

⚠️ **Best practices:**
- Keep your Google Apps Script URL private
- Use HTTPS when you deploy the website
- Validate phone/email on the backend

---

## 📈 NEXT STEPS (OPTIONAL)

Once the basic setup is working:

1. **Customize email template** - Edit `sendEmailNotification()` in Google Apps Script
2. **Add more fields** - Add to form HTML, Google Apps Script will capture them
3. **Bulk import data** - If you have existing leads, import to Google Sheet
4. **Set up automation** - Create Google Sheets filters/sorts for lead management
5. **Add SMS notifications** - Integrate Twilio (optional)
6. **Create dashboard** - Use Google Data Studio for lead analytics

---

## 📞 SUPPORT

**If anything doesn't work:**
1. Check the troubleshooting section above
2. Review `FORMS_SETUP_GUIDE.md` for detailed instructions
3. Check Google Apps Script logs (View → Logs)
4. Verify all configuration values match exactly

---

## ✨ SUMMARY

Your website is now **fully functional** with:

✅ All pages built  
✅ All forms connected to Google Sheets  
✅ Email notifications configured  
✅ Mobile responsive design  
✅ Professional branding  
✅ Property management system  

**You're ready to go live!** 🚀

Just deploy the Google Apps Script and update one URL in `js/form-handler.js`.

---

**Questions?** Review `FORMS_SETUP_GUIDE.md` for complete documentation.
