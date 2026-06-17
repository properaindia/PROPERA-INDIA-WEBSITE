/**
 * GOOGLE APPS SCRIPT - Deploy this to Google Apps Script
 * 
 * Instructions:
 * 1. Go to https://script.google.com
 * 2. Create a new project
 * 3. Copy this entire file into the editor
 * 4. Save the project as "Propera Forms Handler"
 * 5. Deploy as Web App (Deploy > New Deployment > Type: Web App)
 * 6. Set "Execute as" to your Google account
 * 7. Set "Who has access" to "Anyone"
 * 8. Copy the deployment URL and replace GOOGLE_APPS_SCRIPT_URL in form-handler.js
 * 
 * Sheet Structure (Sheet2):
 * A: Lead ID (auto-generated)
 * B: Date
 * C: Name
 * D: Phone
 * E: Source (Contact Form, Property Inquiry, etc.)
 * F: Property (property name if applicable)
 * G: Interested In (what they're interested in)
 * H: Budget
 * I: Status (New Lead, Contacted, etc.)
 * J: Assigned To
 * K: Notes
 */

const SPREADSHEET_ID = "1_ChIJqKsQt2_4EZ86v20KxpGMOoW9NwciyC1Oahtp8A"; // Your spreadsheet ID
const SHEET_NAME = "Sheet2";
const PROPERTY_SHEET_NAME = "Sheet1";
const ADMIN_EMAIL = "properaactivity@gmail.com";

function doPost(e) {
  try {
    // Parse the incoming JSON data
    const data = JSON.parse(e.postData.contents);
    
    // Validate required fields
    if (!data.name || !data.phone) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: "Name and Phone are required" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Get the spreadsheet and sheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    // Generate Lead ID (timestamp + random)
    const leadId = `LEAD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Get next row
    const nextRow = sheet.getLastRow() + 1;

    // Prepare data row
    const row = [
      leadId,                           // A: Lead ID
      new Date().toLocaleDateString(),  // B: Date
      data.name || "",                  // C: Name
      data.phone || "",                 // D: Phone
      data.source || "Website Form",    // E: Source
      data.property || "",              // F: Property
      data.interestedIn || "",          // G: Interested In
      data.budget || "",                // H: Budget
      "New Lead",                       // I: Status
      "",                               // J: Assigned To
      data.message || ""                // K: Notes
    ];

    // Insert the row
    sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);

    // Send email notification
    sendEmailNotification(leadId, data);

    // Return success response
    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        message: "Lead submitted successfully",
        leadId: leadId
      })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("Error: " + error.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    
    // Helper to convert Google Drive viewer links to direct image links
    function convertDriveLink(url) {
      if (!url) return '';
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}`;
      }
      return url;
    }
    
    // Check if the request is to get properties
    if (action === 'getProperties') {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = ss.getSheetByName(PROPERTY_SHEET_NAME);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      if (values.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
      }
      
      const properties = [];
      // Skip header row (index 0)
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        
        // Helper to safely get value and handle '<>' placeholder
        const getVal = (idx) => (row[idx] !== undefined && row[idx] !== null && row[idx].toString() !== '<>') ? row[idx].toString().trim() : '';
        
        const propName = getVal(1);
        // Ensure row has data (check Property Name instead of ID since ID can be <>)
        if (!propName) continue;
        
        // Auto-generate ID from Property Name if ID is missing or '<>'
        let propId = getVal(0);
        if (!propId) {
            propId = propName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }

        // Column Indices (0-based):
        // 0: Property ID, 1: Property Name, 2: Builder, 3: Property Type, 4: Buy/Rent
        // 5: BHK, 6: Area, 7: Locality, 8: Price, 9: Possession, 10: Status
        // 11: Featured, 12: Premium, 13: Description, 14: Main Image, 15: Gallery
        // 16: RERA, 17: Assigned Agent

        const badges = [];
        const isPremium = getVal(12).toLowerCase() === 'yes';
        const isFeatured = getVal(11).toLowerCase() === 'yes';
        
        if (isPremium) badges.push('Premium');
        if (isFeatured) badges.push('Featured');
        
        const mainImageStr = getVal(14);
        const galleryStr = getVal(15);
        
        const mainImage = mainImageStr ? convertDriveLink(mainImageStr) : '';
        const gallery = galleryStr ? galleryStr.split(',').map(s => convertDriveLink(s.trim())).filter(s => s) : [];
        const images = mainImage ? [mainImage].concat(gallery) : gallery;
        
        const descriptionStr = getVal(13);
        const description = descriptionStr ? descriptionStr.split('\n').filter(s => s.trim()) : [];
        
        const prop = {
          id: propId,
          title: propName,
          builder: getVal(2),
          location: getVal(7),
          priceRange: getVal(8),
          badges: badges,
          urgency: [], // Can be populated dynamically if needed later
          images: images,
          specs: {
            type: getVal(3),
            size: getVal(6),
            possession: getVal(9),
            configuration: getVal(5),
            status: getVal(10)
          },
          description: description,
          amenities: [], // Default empty, can add logic later
          highlights: [],
          landmarks: [],
          rera: getVal(16),
          agent: getVal(17)
        };
        
        properties.push(prop);
      }
      
      return ContentService.createTextOutput(JSON.stringify(properties)).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ error: "Invalid action parameter" })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log("Error in doGet: " + error.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ error: error.toString() })
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

// Test function (run this to verify setup)
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

  // Simulate POST request
  const e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };

  const response = doPost(e);
  Logger.log(response.getContent());
}
