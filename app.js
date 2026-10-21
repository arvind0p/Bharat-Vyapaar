```javascript
/* ==========================================
   BHARAT VYAAPAAR - BUSINESS DIRECTORY
   File: app.js
   ========================================== */

(function () {
  "use strict";

  const CONFIG = {
    tableName: "business_directory",
    pageSize: 100
  };

  let supabaseClient = null;
  let allBusinesses = [];
  let filteredBusinesses = [];

  const elements = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    elements.search = document.getElementById("q");
    elements.state = document.getElementById("state");
    elements.city = document.getElementById("city");
    elements.segment = document.getElementById("segment");
    elements.products = document.getElementById("products");
    elements.searchButton = document.getElementById("search");
    elements.resetButton = document.getElementById("reset");
    elements.count = document.getElementById("count");
    elements.results = document.getElementById("results");
    elements.notice = document.getElementById("notice");
    elements.subtitle = document.getElementById("results-subtitle");

    if (!elements.results) {
      console.error(
        "Bharat Vyapaar: #results element was not found in directory.html."
      );
      return;
    }

    bindEvents();
    connectToSupabase();
  }

  function bindEvents() {
    if (elements.searchButton) {
      elements.searchButton.addEventListener("click", applyFilters);
    }

    if (elements.search) {
      elements.search.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          applyFilters();
        }
      });

      elements.search.addEventListener("input", debounce(applyFilters, 250));
    }

    [
      elements.state,
      elements.city,
      elements.segment,
      elements.products
    ].forEach(function (element) {
      if (element) {
        element.addEventListener("change", applyFilters);
      }
    });

    if (elements.resetButton) {
      elements.resetButton.addEventListener("click", resetFilters);
    }
  }

  function connectToSupabase() {
    const supabaseUrl = window.BV_SUPABASE_URL;
    const supabaseKey = window.BV_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      showNotice(
        "The business directory is not connected yet. Please configure the Supabase URL and public key in config.js.",
        "error"
      );
      renderEmptyState("Directory connection is not configured.");
      return;
    }

    if (!window.supabase || !window.supabase.createClient) {
      showNotice(
        "Supabase library could not be loaded. Check your internet connection and the directory.html script imports.",
        "error"
      );
      renderEmptyState("Unable to load the directory.");
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(
        supabaseUrl,
        supabaseKey
      );

      loadBusinesses();
    } catch (error) {
      console.error("Supabase initialization error:", error);
      showNotice("Could not initialize the business directory.", "error");
      renderEmptyState("Unable to connect to the directory.");
    }
  }

  async function loadBusinesses() {
    showNotice("Loading businesses...", "info");

    if (elements.results) {
      elements.results.innerHTML =
        '<div class="loading-state">Loading businesses...</div>';
    }

    try {
      const { data, error } = await supabaseClient
        .from(CONFIG.tableName)
        .select(
          "id,business_name,description,city,state,country,business_segment,products,services,website,is_public,created_at"
        )
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(CONFIG.pageSize);

      if (error) {
        throw error;
      }

      allBusinesses = Array.isArray(data) ? data : [];
      populateFilters();
      applyFilters();

      if (allBusinesses.length === 0) {
        showNotice("No public business listings are available yet.", "info");
      } else {
        showNotice("", "info");
      }
    } catch (error) {
      console.error("Business directory loading error:", error);

      showNotice(
        "Unable to load businesses. Please check the database table, public read policy and Supabase configuration.",
        "error"
      );

      renderEmptyState("Businesses could not be loaded.");
    }
  }

  function populateFilters() {
    populateSelect(
      elements.state,
      uniqueValues("state"),
      "All States"
    );

    populateSelect(
      elements.city,
      uniqueValues("city"),
      "All Cities"
    );

    populateSelect(
      elements.segment,
      uniqueValues("business_segment"),
      "All Business Segments"
    );
  }

  function uniqueValues(fieldName) {
    const values = allBusinesses
      .map(function (business) {
        return business[fieldName];
      })
      .filter(function (value) {
        return typeof value === "string" && value.trim() !== "";
      });

    return Array.from(new Set(values)).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function populateSelect(selectElement, values, defaultLabel) {
    if (!selectElement) return;

    const previousValue = selectElement.value;

    selectElement.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = defaultLabel;
    selectElement.appendChild(defaultOption);

    values.forEach(function (value) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      selectElement.appendChild(option);
    });

    if (values.includes(previousValue)) {
      selectElement.value = previousValue;
    }
  }

  function applyFilters() {
    const query = getValue(elements.search).toLowerCase();
    const state = getValue(elements.state);
    const city = getValue(elements.city);
    const segment = getValue(elements.segment);
    const productQuery = getValue(elements.products).toLowerCase();

    filteredBusinesses = allBusinesses.filter(function (business) {
      const searchableText = [
        business.business_name,
        business.description,
        business.city,
        business.state,
        business.country,
        business.business_segment,
        business.products,
        business.services
      ]
        .map(toText)
        .join(" ")
        .toLowerCase();

      const productText = [
        business.products,
        business.services
      ]
        .map(toText)
        .join(" ")
        .toLowerCase();

      return (
        (!query || searchableText.includes(query)) &&
        (!state || business.state === state) &&
        (!city || business.city === city) &&
        (!segment || business.business_segment === segment) &&
        (!productQuery || productText.includes(productQuery))
      );
    });

    renderBusinesses();
  }

  function resetFilters() {
    if (elements.search) elements.search.value = "";
    if (elements.state) elements.state.value = "";
    if (elements.city) elements.city.value = "";
    if (elements.segment) elements.segment.value = "";
    if (elements.products) elements.products.value = "";

    applyFilters();
  }

  function renderBusinesses() {
    if (!elements.results) return;

    elements.results.innerHTML = "";

    if (elements.count) {
      elements.count.textContent = String(filteredBusinesses.length);
    }

    if (elements.subtitle) {
      elements.subtitle.textContent =
        filteredBusinesses.length === 1
          ? "1 business found"
          : filteredBusinesses.length + " businesses found";
    }

    if (filteredBusinesses.length === 0) {
      renderEmptyState("No businesses match your search.");
      return;
    }

    const fragment = document.createDocumentFragment();

    filteredBusinesses.forEach(function (business) {
      fragment.appendChild(createBusinessCard(business));
    });

    elements.results.appendChild(fragment);
  }

  function createBusinessCard(business) {
    const card = document.createElement("article");
    card.className = "business-card";

    const heading = document.createElement("h3");
    heading.className = "business-card-title";
    heading.textContent = toText(business.business_name) || "Business";

    const description = document.createElement("p");
    description.className = "business-card-description";
    description.textContent =
      toText(business.description) || "No description provided.";

    card.appendChild(heading);
    card.appendChild(description);

    const segment = toText(business.business_segment);

    if (segment) {
      const segmentLabel = document.createElement("p");
      segmentLabel.className = "business-card-segment";
      segmentLabel.textContent = "Segment: " + segment;
      card.appendChild(segmentLabel);
    }

    const location = [
      toText(business.city),
      toText(business.state),
      toText(business.country)
    ].filter(Boolean).join(", ");

    if (location) {
      const locationElement = document.createElement("p");
      locationElement.className = "business-card-location";
      locationElement.textContent = "Location: " + location;
      card.appendChild(locationElement);
    }

    const products = toText(business.products);

    if (products) {
      const productsElement = document.createElement("p");
      productsElement.className = "business-card-products";
      productsElement.textContent = "Products: " + products;
      card.appendChild(productsElement);
    }

    const services = toText(business.services);

    if (services) {
      const servicesElement = document.createElement("p");
      servicesElement.className = "business-card-services";
      servicesElement.textContent = "Services: " + services;
      card.appendChild(servicesElement);
    }

    const website = normalizeWebsite(business.website);

    if (website) {
      const websiteLink = document.createElement("a");
      websiteLink.className = "business-card-website";
      websiteLink.href = website;
      websiteLink.target = "_blank";
      websiteLink.rel = "noopener noreferrer";
      websiteLink.textContent = "Visit Website";
      card.appendChild(websiteLink);
    }

    return card;
  }

  function normalizeWebsite(value) {
    const rawValue = toText(value);

    if (!rawValue) return "";

    let candidate = rawValue;

    if (!/^https?:\/\//i.test(candidate)) {
      candidate = "https://" + candidate;
    }

    try {
      const url = new URL(candidate);

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return "";
      }

      return url.href;
    } catch (error) {
      return "";
    }
  }

  function renderEmptyState(message) {
    if (!elements.results) return;

    elements.results.innerHTML = "";

    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = message;

    elements.results.appendChild(empty);

    if (elements.count) {
      elements.count.textContent = "0";
    }

    if (elements.subtitle) {
      elements.subtitle.textContent = message;
    }
  }

  function showNotice(message, type) {
    if (!elements.notice) return;

    elements.notice.textContent = message;
    elements.notice.className = "notice";

    if (type) {
      elements.notice.classList.add("notice-" + type);
    }

    elements.notice.hidden = !message;
  }

  function getValue(element) {
    return element && typeof element.value === "string"
      ? element.value.trim()
      : "";
  }

  function toText(value) {
    if (value === null || value === undefined) return "";

    if (Array.isArray(value)) {
      return value.map(toText).filter(Boolean).join(", ");
    }

    if (typeof value === "object") {
      return "";
    }

    return String(value).trim();
  }

  function debounce(callback, delay) {
    let timeoutId;

    return function () {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(callback, delay);
    };
  }
})();
```
