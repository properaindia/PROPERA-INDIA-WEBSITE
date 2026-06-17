/**
 * PROPERA FORM HANDLER
 * Handles form submissions and sends data to Google Sheets via Google Apps Script
 * 
 * Setup Instructions:
 * 1. Deploy the gs-script-backup.js file to Google Apps Script (see instructions in that file)
 * 2. Replace GOOGLE_APPS_SCRIPT_URL below with your deployment URL
 * 3. Include this file in your HTML: <script src="js/form-handler.js"></script>
 */

// ⚠️ IMPORTANT: Replace this with your actual Google Apps Script deployment URL
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZw_D87_-iHK-rPJrxoIORzlePkkTjqUUFNT38tlpI8lAVdcEZd-2AvjGgErz2slS_vg/exec";

/**
 * Submit form data to Google Sheets
 * @param {FormData|Object} formData - Form data to submit
 * @param {string} source - Source of the form (e.g., "Contact Form", "Property Inquiry")
 * @param {Function} onSuccess - Callback function on success
 * @param {Function} onError - Callback function on error
 */
async function submitFormToGoogleSheets(formData, source = "Website Form", onSuccess, onError) {
  try {
    // Convert FormData to object if needed
    let data = formData instanceof FormData ? Object.fromEntries(formData) : formData;

    // Add source
    data.source = source;

    // Validate required fields
    if (!data.name || !data.phone) {
      const errorMsg = "Please fill in your name and phone number.";
      if (onError) onError(errorMsg);
      return;
    }

    // Show loading state
    showFormLoading(true);

    // Send to Google Apps Script
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(data)
    });

    const result = await response.json();

    // Hide loading state
    showFormLoading(false);

    if (result.success) {
      // Success callback
      if (onSuccess) onSuccess(result.leadId);

      // Show success message
      showSuccessMessage(`Thank you! Your inquiry has been submitted. Lead ID: ${result.leadId}`);

      // Reset form
      const form = document.querySelector('form');
      if (form) form.reset();

      return result;
    } else {
      throw new Error(result.error || "Form submission failed");
    }
  } catch (error) {
    console.error("Form submission error:", error);
    showFormLoading(false);
    const errorMsg = error.message || "An error occurred. Please try again.";
    if (onError) onError(errorMsg);
    showErrorMessage(errorMsg);
  }
}

/**
 * Show/hide loading state in form
 */
function showFormLoading(isLoading) {
  const buttons = document.querySelectorAll('button[type="submit"]');
  buttons.forEach(btn => {
    if (isLoading) {
      btn.disabled = true;
      btn.textContent = "Submitting...";
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || "Submit";
    }
  });
}

/**
 * Show success message to user
 */
function showSuccessMessage(message) {
  // Create toast notification
  const toast = document.createElement('div');
  toast.className = 'form-toast form-toast-success';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Add styles if not already present
  if (!document.querySelector('style[data-form-toast]')) {
    const style = document.createElement('style');
    style.setAttribute('data-form-toast', '');
    style.textContent = `
      .form-toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease;
      }
      .form-toast-success {
        background: #10b981;
      }
      .form-toast-error {
        background: #ef4444;
      }
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @media (max-width: 640px) {
        .form-toast {
          left: 20px;
          right: 20px;
          bottom: auto;
          top: 20px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Remove after 5 seconds
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

/**
 * Show error message to user
 */
function showErrorMessage(message) {
  const toast = document.createElement('div');
  toast.className = 'form-toast form-toast-error';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 5000);
}

/**
 * Auto-initialize form handlers on page load
 */
document.addEventListener('DOMContentLoaded', () => {
  // Handle all forms with class 'form-auto-submit'
  document.querySelectorAll('form.form-auto-submit').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const source = form.dataset.source || "Website Form";

      await submitFormToGoogleSheets(
        formData,
        source,
        (leadId) => {
          console.log(`Form submitted successfully. Lead ID: ${leadId}`);
        },
        (error) => {
          console.error(`Form submission failed: ${error}`);
        }
      );
    });
  });
});

/**
 * Helper function to create a form data object from HTML form
 */
function getFormDataAsObject(formElement) {
  const formData = new FormData(formElement);
  const obj = {};

  for (let [key, value] of formData.entries()) {
    if (obj[key]) {
      // Handle multiple values for the same key
      if (Array.isArray(obj[key])) {
        obj[key].push(value);
      } else {
        obj[key] = [obj[key], value];
      }
    } else {
      obj[key] = value;
    }
  }

  return obj;
}

/**
 * Manually trigger form submission (for custom implementations)
 * Usage: submitCustomForm({ name: "John", phone: "1234567890", ... })
 */
window.submitCustomForm = async function (dataObj, source = "Website Form") {
  return await submitFormToGoogleSheets(
    dataObj,
    source,
    (leadId) => {
      console.log(`Lead submitted: ${leadId}`);
    },
    (error) => {
      console.error(`Submission failed: ${error}`);
    }
  );
};
