
(function () {
  "use strict";

  const CONFIG = window.BV_SUPABASE_CONFIG || {
    url: window.BV_SUPABASE_URL,
    key: window.BV_SUPABASE_ANON_KEY
  };

  const TABLE = "business_directory";

  const state = {
    all: [],
    filtered: [],
    page: 1,
    pageSize: 12
  };

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function showNotice(message, isError) {
    const notice = el("notice");
    if (!notice) return;

    notice.textContent = message;
    notice.className = isError ? "notice error" : "notice";
    notice.setAttribute("role", "status");
  }

  function getValue(ids) {
    for (const id of ids) {
      const field = el(id);
      if (field && String(field.value || "").trim()) {
        return String(field.value).trim();
      }
    }
    return "";
  }

  function getBusinessName(item) {
    return item.business_name || item.name || item.company_name || "Business";
  }

  function getDescription(item) {
    return item.description || item.business_description || "";
  }

  function getLocation(item) {
    return [
      item.city,
      item.state,
      item.country
    ].filter(Boolean).join(", ");
  }

  function render() {
    const results = el("results");
    if (!results) return;

    if (!state.filtered.length) {
      results.innerHTML =
        '<div class="notice">No businesses found. Try changing your search or filters.</div>';
      renderCount();
      return;
    }

    const start = (state.page - 1) * state.pageSize;
    const items = state.filtered.slice(start, start + state.pageSize);

    results.innerHTML = items.map(function (item) {
      const name = escapeHTML(getBusinessName(item));
      const description = escapeHTML(getDescription(item));
      const location = escapeHTML(getLocation(item));
      const segment = escapeHTML(item.business_segment || item.segment || "");
      const products = escapeHTML(item.products || "");
      const services = escapeHTML(item.services || "");
      const website = String(item.website || "").trim();
      const safeWebsite = /^https?:\/\/[^\s]+$/i.test(website)
        ? website
        : "";

      return `
        <article class="business-card">
          <h3>${name}</h3>
          ${segment ? `<p><strong>Segment:</strong> ${segment}</p>` : ""}
          ${location ? `<p><strong>Location:</strong> ${location}</p>` : ""}
          ${description ? `<p>${description}</p>` : ""}
          ${products ? `<p><strong>Products:</strong> ${products}</p>` : ""}
          ${services ? `<p><strong>Services:</strong> ${services}</p>` : ""}
          ${safeWebsite
            ? `<p><a href="${escapeHTML(safeWebsite)}" target="_blank" rel="noopener noreferrer">Visit website</a></p>`
            : ""}
        </article>
      `;
    }).join("");

    renderCount();
    renderPagination();
  }

  function renderCount() {
    const count = el("result-count") || el("results-count") || el("count");
    if (count) {
      count.textContent = state.filtered.length + " businesses found";
    }
  }

  function renderPagination() {
    const pagination = el("pagination");
    if (!pagination) return;

    const pages = Math.ceil(state.filtered.length / state.pageSize);

    if (pages <= 1) {
      pagination.innerHTML = "";
      return;
    }

    pagination.innerHTML = `
      <button type="button" id="prev-page" ${state.page <= 1 ? "disabled" : ""}>Previous</button>
      <span>Page ${state.page} of ${pages}</span>
      <button type="button" id="next-page" ${state.page >= pages ? "disabled" : ""}>Next</button>
    `;

    const prev = el("prev-page");
    const next = el("next-page");

    if (prev) {
      prev.addEventListener("click", function () {
        if (state.page > 1) {
          state.page--;
          render();
        }
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        if (state.page < pages) {
          state.page++;
          render();
        }
      });
    }
  }

  function applyFilters() {
    const query = getValue(["search", "search-input", "business-search"]).toLowerCase();
    const city = getValue(["city", "filter-city"]).toLowerCase();
    const stateName = getValue(["state", "filter-state"]).toLowerCase();
    const segment = getValue(["business-segment", "segment", "filter-segment"]).toLowerCase();
    const products = getValue(["products", "filter-products"]).toLowerCase();
    const services = getValue(["services", "filter-services"]).toLowerCase();

    state.filtered = state.all.filter(function (item) {
      const searchable = [
        getBusinessName(item),
        getDescription(item),
        item.city,
        item.state,
        item.business_segment,
        item.segment,
        item.products,
        item.services
      ].join(" ").toLowerCase();

      return (!query || searchable.includes(query)) &&
        (!city || String(item.city || "").toLowerCase().includes(city)) &&
        (!stateName || String(item.state || "").toLowerCase().includes(stateName)) &&
        (!segment || String(item.business_segment || item.segment || "").toLowerCase().includes(segment)) &&
        (!products || String(item.products || "").toLowerCase().includes(products)) &&
        (!services || String(item.services || "").toLowerCase().includes(services));
    });

    state.page = 1;
    render();
  }

  async function loadListings() {
    if (!CONFIG.url || !CONFIG.key) {
      showNotice("Supabase URL ya publishable key config.js mein missing hai.", true);
      return;
    }

    const baseURL = CONFIG.url.replace(/\/+$/, "");
    const endpoint = baseURL + "/rest/v1/" + TABLE +
      "?select=*&order=created_at.desc";

    showNotice("Loading business listings...", false);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "apikey": CONFIG.key,
          "Authorization": "Bearer " + CONFIG.key,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "Database table business_directory nahi mili."
            : "Supabase request failed (HTTP " + response.status + ")."
        );
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Supabase se unexpected response mila.");
      }

      state.all = data;
      applyFilters();

      showNotice(
        data.length
          ? "Business listings loaded successfully."
          : "Abhi koi business listing available nahi hai.",
        false
      );
    } catch (error) {
      console.error("Bharat Vyapaar directory error:", error);
      showNotice(
        error.message ||
        "Listings load nahi hui. Database table aur permissions check karein.",
        true
      );
    }
  }

  function init() {
    const searchIds = [
      "search",
      "search-input",
      "business-search",
      "city",
      "filter-city",
      "state",
      "filter-state",
      "business-segment",
      "segment",
      "filter-segment",
      "products",
      "filter-products",
      "services",
      "filter-services"
    ];

    searchIds.forEach(function (id) {
      const field = el(id);
      if (field) {
        field.addEventListener("input", applyFilters);
        field.addEventListener("change", applyFilters);
      }
    });

    const reset = el("reset-filters") || el("reset");
    if (reset) {
      reset.addEventListener("click", function () {
        searchIds.forEach(function (id) {
          const field = el(id);
          if (field) field.value = "";
        });
        applyFilters();
      });
    }

    loadListings();
  }

  window.BVDirectory = { init: init };
})();
