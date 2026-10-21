```javascript
/* ==========================================
   BHARAT VYAAPAAR - MAIN SITE SCRIPT
   File: script.js
   ========================================== */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    initializeCurrentYear();
    initializeMobileNavigation();
    initializeFormFeedback();
  });

  /* Update copyright year */
  function initializeCurrentYear() {
    const yearElements = document.querySelectorAll("#currentYear");

    yearElements.forEach(function (element) {
      element.textContent = new Date().getFullYear();
    });
  }

  /* Mobile navigation */
  function initializeMobileNavigation() {
    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");

    if (!menuToggle || !mainNav) {
      return;
    }

    menuToggle.addEventListener("click", function () {
      const isOpen = mainNav.classList.toggle("active");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    mainNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mainNav.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        mainNav.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* Basic feedback for forms not connected to a backend */
  function initializeFormFeedback() {
    const formIds = [
      "contactForm",
      "joinForm",
      "partnerForm"
    ];

    formIds.forEach(function (formId) {
      const form = document.getElementById(formId);

      if (!form) {
        return;
      }

      /*
       * These forms may already have their own submit handlers
       * inside the HTML page. Do not attach a second submit action.
       */
      form.setAttribute("novalidate", "false");
    });
  }
})();
```
