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

    // Handle Site Visit Booking to Sheet3
    if (data.source === "Site Visit") {
      const visitSheet = ss.getSheetByName("Sheet3");
      if (visitSheet) {
        const visitId = `VISIT-${Date.now()}`;
        const leadContact = `${data.name || ''} - ${data.phone || ''} ${data.email ? '('+data.email+')' : ''}`;
        
        const visitRow = [
          visitId,                           // A: Visit ID
          leadContact,                       // B: Lead
          data.property || "",               // C: Property
          data.visitDate || "",              // D: Date
          data.visitTime || "",              // E: Time
          "Pending Confirmation",            // F: Status
          ""                                 // G: Feedback
        ];
        visitSheet.getRange(visitSheet.getLastRow() + 1, 1, 1, visitRow.length).setValues([visitRow]);
        
        // Also send email notification for Site Visit
        sendEmailNotification(visitId, data);
        
        return ContentService.createTextOutput(
          JSON.stringify({
            success: true,
            message: "Site visit requested successfully",
            leadId: visitId
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Handle Post Property to Sheet4
    if (data.source === "Post Property") {
      const propertySheet = ss.getSheetByName("Sheet4");
      if (propertySheet) {
        const ownerId = `OWNER-${Date.now()}`;
        
        // Extract amenities which might come as an array
        let amenitiesStr = "";
        const amenitiesKey = data['amenities[]'] ? 'amenities[]' : 'amenities';
        if (data[amenitiesKey]) {
          amenitiesStr = Array.isArray(data[amenitiesKey]) ? data[amenitiesKey].join(", ") : data[amenitiesKey];
        }
        if (data.otherAmenities) {
          amenitiesStr += (amenitiesStr ? ", " : "") + data.otherAmenities;
        }

        const propRow = [
          ownerId,                           // A: Owner ID
          data.type || "",                   // B: Property Type
          data.propertyName || "",           // C: Property Name
          data.intent || "",                 // D: Sale/Rent
          data.description || "",            // E: Property Desc
          data.location || "",               // F: Location
          data.price || "",                  // G: Expected Price
          amenitiesStr,                      // H: Amenities
          data.name || "",                   // I: Owner Name
          data.phone || "",                  // J: Owner Phone
          "Pending",                         // K: Verification
          "New Lead"                         // L: Status
        ];
        
        propertySheet.getRange(propertySheet.getLastRow() + 1, 1, 1, propRow.length).setValues([propRow]);
        
        // Send email notification for Property Posting
        sendEmailNotification(ownerId, data);
        
        return ContentService.createTextOutput(
          JSON.stringify({
            success: true,
            message: "Property submitted successfully",
            leadId: ownerId
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Default: Handle General Leads to Sheet2
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
      const rentSheet = ss.getSheetByName("Sheet1.5");
      let rentValues = [];
      if (rentSheet) {
        rentValues = rentSheet.getDataRange().getValues();
      }
      
      const properties = [];
      
      function processRows(rows, isRentSheet) {
        if (!rows || rows.length <= 1) return;
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const getVal = (idx) => (row[idx] !== undefined && row[idx] !== null && row[idx].toString() !== '<>') ? row[idx].toString().trim() : '';
          
          const propName = getVal(1);
          if (!propName) continue;
          
          let propId = getVal(0);
          if (!propId) {
              propId = propName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          }
          
          const badges = [];
          let isPremium = false;
          let isFeatured = false;
          let mainImageStr = '';
          let galleryStr = '';
          let descriptionStr = '';
          let videoStr = '';
          let rera = '';
          let possession = '';
          let status = '';
          let intent = '';
          let type = '';
          let builder = '';
          let location = '';
          let priceRange = '';
          let size = '';
          let config = '';
          let agent = '';

          if (isRentSheet) {
              // 0: ID, 1: Name, 2: Builder, 3: Type, 4: Buy/Rent
              // 5: BHK, 6: Area, 7: Locality, 8: Price, 9: Premium/Budget, 10: Description
              // 11: Main Image, 12: Gallery, 13: Video, 14: RERA
              builder = getVal(2);
              type = getVal(3);
              intent = getVal(4);
              config = getVal(5);
              size = getVal(6);
              location = getVal(7);
              priceRange = getVal(8);
              isPremium = getVal(9).toLowerCase().includes('premium');
              descriptionStr = getVal(10);
              mainImageStr = getVal(11);
              galleryStr = getVal(12);
              videoStr = getVal(13);
              rera = getVal(14);
              status = 'Ready to Move';
          } else {
              // Sheet1
              // 0: ID, 1: Name, 2: Builder, 3: Type, 4: Buy/Rent
              // 5: BHK, 6: Area, 7: Locality, 8: Price, 9: Possession, 10: Status
              // 11: Featured, 12: Premium, 13: Description, 14: Main Image, 15: Gallery
              // 16: RERA, 17: Assigned Agent, 18: Video
              builder = getVal(2);
              type = getVal(3);
              intent = getVal(4);
              config = getVal(5);
              size = getVal(6);
              location = getVal(7);
              priceRange = getVal(8);
              possession = getVal(9);
              status = getVal(10);
              isFeatured = getVal(11).toLowerCase() === 'yes';
              isPremium = getVal(12).toLowerCase() === 'yes';
              descriptionStr = getVal(13);
              mainImageStr = getVal(14);
              galleryStr = getVal(15);
              rera = getVal(16);
              agent = getVal(17);
              videoStr = getVal(18);
          }
          
          if (isPremium) badges.push('Premium');
          if (isFeatured) badges.push('Featured');
          
          const mainImage = mainImageStr ? convertDriveLink(mainImageStr) : '';
          const gallery = galleryStr ? galleryStr.split(',').map(s => convertDriveLink(s.trim())).filter(s => s) : [];
          const images = mainImage ? [mainImage].concat(gallery) : gallery;
          
          const description = descriptionStr ? descriptionStr.split('\n').filter(s => s.trim()) : [];
          
          const prop = {
            id: propId,
            title: propName,
            builder: builder,
            location: location,
            priceRange: priceRange,
            badges: badges,
            urgency: [],
            images: images,
            video: videoStr,
            specs: {
              type: type,
              size: size,
              possession: possession,
              configuration: config,
              status: status,
              intent: intent
            },
            description: description,
            amenities: [],
            highlights: [],
            landmarks: [],
            rera: rera,
            agent: agent
          };
          
          properties.push(prop);
        }
      }
      
      processRows(dataRange.getValues(), false);
      processRows(rentValues, true);
      
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
