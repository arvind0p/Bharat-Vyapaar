/* ==========================================
   BHARAT VYAAPAAR - BUSINESS DIRECTORY
   File: app.js
   ========================================== */

(function () {
  "use strict";

  const CONFIG = {
    tableName: "business_directory",
    pageSize: 10000,
    businessesPerPage: 20
  };

  let supabaseClient = null;
  let allBusinesses = [];
  let filteredBusinesses = [];
  let currentPage = 1;

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
    elements.pagination = document.getElementById("directoryPagination");
    if (elements.results && !elements.pagination) {
      elements.pagination = document.createElement("nav");
      elements.pagination.id = "directoryPagination";
      elements.pagination.className = "directory-pagination";
      elements.pagination.setAttribute("aria-label", "Business directory pages");
      elements.results.insertAdjacentElement("afterend", elements.pagination);
    }
    elements.notice = document.getElementById("notice");
    elements.subtitle = document.getElementById("results-subtitle");
    elements.reportForm = document.getElementById("businessReportForm");
    elements.reportPanel = document.getElementById("businessReportPanel");
    elements.reportBusinessId = document.getElementById("reportBusinessId");
    elements.reportBusinessName = document.getElementById("reportBusinessName");
    elements.reportNotice = document.getElementById("reportNotice");
    elements.reportCancel = document.getElementById("reportCancel");

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

    if (elements.reportForm) {
      elements.reportForm.addEventListener("submit", submitBusinessReport);
    }

    if (elements.reportCancel) {
      elements.reportCancel.addEventListener("click", function () {
        if (elements.reportPanel) elements.reportPanel.hidden = true;
        if (elements.reportNotice) elements.reportNotice.textContent = "";
      });
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
          "id,business_name,description,city,state,country,business_segment,products,services,website,is_public,verification_status,created_at"
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

    currentPage = 1;
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
      renderPagination();
      return;
    }

    const totalPages = Math.ceil(filteredBusinesses.length / CONFIG.businessesPerPage);
    currentPage = Math.min(Math.max(currentPage, 1), totalPages);
    const startIndex = (currentPage - 1) * CONFIG.businessesPerPage;
    const pageBusinesses = filteredBusinesses.slice(
      startIndex,
      startIndex + CONFIG.businessesPerPage
    );

    const fragment = document.createDocumentFragment();
    pageBusinesses.forEach(function (business) {
      fragment.appendChild(createBusinessCard(business));
    });
    elements.results.appendChild(fragment);
    renderPagination();
  }

  function renderPagination() {
    if (!elements.pagination) return;

    elements.pagination.innerHTML = "";
    const totalPages = Math.ceil(filteredBusinesses.length / CONFIG.businessesPerPage);

    if (totalPages <= 1) {
      elements.pagination.hidden = true;
      return;
    }

    elements.pagination.hidden = false;
    const start = (currentPage - 1) * CONFIG.businessesPerPage + 1;
    const end = Math.min(currentPage * CONFIG.businessesPerPage, filteredBusinesses.length);

    const summary = document.createElement("span");
    summary.className = "pagination-summary";
    summary.textContent = "Showing " + start + "–" + end + " of " + filteredBusinesses.length;
    elements.pagination.appendChild(summary);

    const controls = document.createElement("div");
    controls.className = "pagination-controls";

    function addButton(label, page, options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pagination-button" + (options && options.active ? " is-active" : "");
      button.textContent = label;
      button.disabled = Boolean(options && options.disabled);
      if (options && options.active) button.setAttribute("aria-current", "page");
      button.addEventListener("click", function () {
        if (page < 1 || page > totalPages || page === currentPage) return;
        currentPage = page;
        renderBusinesses();
        const heading = document.querySelector(".directory-results-heading");
        if (heading) heading.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      controls.appendChild(button);
    }

    addButton("Previous", currentPage - 1, { disabled: currentPage === 1 });

    const pages = Array.from(new Set([
      1, 2, currentPage - 1, currentPage, currentPage + 1, totalPages - 1, totalPages
    ]))
      .filter(function (page) { return page >= 1 && page <= totalPages; })
      .sort(function (a, b) { return a - b; });

    let previousPage = 0;
    pages.forEach(function (page) {
      if (previousPage && page - previousPage > 1) {
        const dots = document.createElement("span");
        dots.className = "pagination-ellipsis";
        dots.textContent = "…";
        controls.appendChild(dots);
      }
      addButton(String(page), page, { active: page === currentPage });
      previousPage = page;
    });

    addButton("Next", currentPage + 1, { disabled: currentPage === totalPages });
    elements.pagination.appendChild(controls);
  }

  function createBusinessCard(business) {
    const card = document.createElement("article");
    card.className = "business-card";

    const heading = document.createElement("h3");
    heading.className = "business-card-title";
    heading.textContent = toText(business.business_name) || "Business";

    if (business.verification_status === "verified") {
      const badge = document.createElement("span");
      badge.className = "verified-badge";
      badge.textContent = "✓ Verified business";
      badge.setAttribute("title", "Bharat Vyapaar has completed its defined verification checks for this listing.");
      card.appendChild(badge);
    }

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

    const reportButton = document.createElement("button");
    reportButton.type = "button";
    reportButton.className = "report-business-button";
    reportButton.textContent = "Report this business";
    reportButton.addEventListener("click", function () {
      if (!elements.reportForm || !elements.reportBusinessId || !elements.reportBusinessName) return;
      elements.reportBusinessId.value = toText(business.id);
      elements.reportBusinessName.value = toText(business.business_name);
      if (elements.reportPanel) elements.reportPanel.hidden = false;
      if (elements.reportNotice) elements.reportNotice.textContent = "";
      elements.reportForm.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    card.appendChild(reportButton);

    return card;
  }

  async function submitBusinessReport(event) {
    event.preventDefault();
    if (!supabaseClient || !elements.reportForm) return;

    const submitButton = elements.reportForm.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    if (elements.reportNotice) elements.reportNotice.textContent = "Submitting report...";

    const formData = new FormData(elements.reportForm);
    const payload = {
      business_id: getValue(elements.reportBusinessId),
      business_name: getValue(elements.reportBusinessName),
      reason: String(formData.get("reason") || "").trim(),
      details: String(formData.get("details") || "").trim() || null,
      reporter_email: String(formData.get("reporter_email") || "").trim() || null
    };

    try {
      const { error } = await supabaseClient.from("business_reports").insert(payload);
      if (error) throw error;
      if (elements.reportNotice) {
        elements.reportNotice.textContent = "Thank you. Your report has been submitted for review.";
      }
      elements.reportForm.reset();
      if (elements.reportBusinessId) elements.reportBusinessId.value = "";
      if (elements.reportBusinessName) elements.reportBusinessName.value = "";
    } catch (error) {
      console.error("Business report submission error:", error);
      if (elements.reportNotice) {
        elements.reportNotice.textContent = "Could not submit the report. Please try again later.";
      }
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
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