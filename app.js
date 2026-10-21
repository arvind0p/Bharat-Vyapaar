
(function () {
  "use strict";

  const TABLE = "business_directory";
  const PAGE_SIZE = 60;

  let allBusinesses = [];

  const $ = (id) => document.getElementById(id);

  function clean(value) {
    return String(value ?? "").trim();
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function showNotice(message, type = "info") {
    const notice = $("notice");
    if (!notice) return;

    notice.textContent = message;
    notice.className = "directory-notice is-" + type;
    notice.hidden = !message;
  }

  function setCount(count) {
    if ($("count")) $("count").textContent = count;
  }

  function uniqueSorted(values) {
    return [...new Set(values.map(clean).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }

  function fillSelect(id, values, label) {
    const select = $(id);
    if (!select) return;

    const previous = select.value;
    select.innerHTML = "";

    const first = document.createElement("option");
    first.value = "";
    first.textContent = label;
    select.appendChild(first);

    uniqueSorted(values).forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });

    if ([...select.options].some((o) => o.value === previous)) {
      select.value = previous;
    }
  }

  function updateFilterOptions() {
    const selectedState = $("state")?.value || "";
    const selectedCity = $("city")?.value || "";

    fillSelect(
      "state",
      allBusinesses.map((b) => b.state),
      "All states"
    );

    const cityOptions = allBusinesses
      .filter((b) => !selectedState || clean(b.state) === selectedState)
      .map((b) => b.city);

    fillSelect("city", cityOptions, "All cities");

    if (
      selectedCity &&
      [...$("city").options].some((o) => o.value === selectedCity)
    ) {
      $("city").value = selectedCity;
    }

    fillSelect(
      "segment",
      allBusinesses.map((b) => b.business_segment),
      "All segments"
    );
  }

  function getWebsite(url) {
    const value = clean(url);
    if (!value) return "";

    try {
      const parsed = new URL(
        /^https?:\/\//i.test(value) ? value : "https://" + value
      );

      return ["http:", "https:"].includes(parsed.protocol)
        ? parsed.href
        : "";
    } catch {
      return "";
    }
  }

  function createBusinessCard(business) {
    const name = escapeHTML(business.business_name || "Business");
    const segment = escapeHTML(
      business.business_segment || "Business"
    );

    const location = [
      clean(business.city),
      clean(business.state)
    ].filter(Boolean).map(escapeHTML).join(", ");

    const description = escapeHTML(
      business.description ||
      "Contact this business to learn more about its offerings."
    );

    const products = escapeHTML(business.products || "");
    const services = escapeHTML(business.services || "");
    const website = getWebsite(business.website);

    const initials = escapeHTML(
      clean(business.business_name || "BV")
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toUpperCase()
    );

    return `
      <article class="business-card">
        <div class="business-card-top">
          <div class="business-monogram">${initials}</div>
          <span class="business-segment">${segment}</span>
        </div>

        <h3>${name}</h3>

        ${
          location
            ? `<p class="business-location">⌖ ${location}</p>`
            : ""
        }

        <p class="business-description">${description}</p>

        ${
          products || services
            ? `<div class="business-tags">
                ${
                  products
                    ? `<div>
                        <strong>Products</strong>
                        <span>${products}</span>
                      </div>`
                    : ""
                }
                ${
                  services
                    ? `<div>
                        <strong>Services</strong>
                        <span>${services}</span>
                      </div>`
                    : ""
                }
              </div>`
            : ""
        }

        <div class="business-card-bottom">
          ${
            website
              ? `<a href="${escapeHTML(website)}"
                    target="_blank"
                    rel="noopener noreferrer">
                    Visit website ↗
                  </a>`
              : `<span class="no-website">
                    Bharat Vyapaar listing
                  </span>`
          }
        </div>
      </article>
    `;
  }

  function renderResults(items) {
    const results = $("results");
    if (!results) return;

    setCount(items.length);

    if ($("results-subtitle")) {
      $("results-subtitle").textContent = items.length
        ? `Showing ${items.length} matching businesses.`
        : "Try a different keyword or remove some filters.";
    }

    if (!items.length) {
      results.innerHTML = `
        <div class="directory-empty">
          <span class="empty-icon">⌕</span>
          <h3>No businesses found</h3>
          <p>
            No matching public listings are available.
            Try changing your search or filters.
          </p>
          <button class="btn light" id="empty-reset" type="button">
            Reset filters
          </button>
        </div>
      `;

      $("empty-reset")?.addEventListener("click", resetFilters);
      return;
    }

    results.innerHTML = items
      .slice(0, PAGE_SIZE)
      .map(createBusinessCard)
      .join("");

    if (items.length > PAGE_SIZE) {
      const note = document.createElement("p");
      note.className = "results-limit-note";
      note.textContent =
        `Showing first ${PAGE_SIZE} results. Use filters to narrow your search.`;
      results.appendChild(note);
    }
  }

  function applyFilters() {
    const query = clean($("q")?.value).toLowerCase();
    const state = clean($("state")?.value);
    const city = clean($("city")?.value);
    const segment = clean($("segment")?.value);
    const productQuery = clean($("products")?.value).toLowerCase();

    const filtered = allBusinesses.filter((business) => {
      const searchable = [
        business.business_name,
        business.description,
        business.city,
        business.state,
        business.business_segment,
        business.products,
        business.services
      ].map(clean).join(" ").toLowerCase();

      const productText = [
        business.products,
        business.services
      ].map(clean).join(" ").toLowerCase();

      return (
        (!query || searchable.includes(query)) &&
        (!state || clean(business.state) === state) &&
        (!city || clean(business.city) === city) &&
        (!segment || clean(business.business_segment) === segment) &&
        (
          !productQuery ||
          productText.includes(productQuery) ||
          searchable.includes(productQuery)
        )
      );
    });

    renderResults(filtered);
  }

  function resetFilters() {
    ["q", "state", "city", "segment", "products"]
      .forEach((id) => {
        if ($(id)) $(id).value = "";
      });

    updateFilterOptions();
    applyFilters();
  }

  async function loadBusinesses() {
    const url = clean(window.BV_SUPABASE_URL);
    const key = clean(window.BV_SUPABASE_ANON_KEY);

    if (
      !url ||
      !key ||
      url.includes("YOUR_PROJECT_REF") ||
      key.includes("YOUR_SB_PUBLISHABLE_KEY")
    ) {
      showNotice(
        "Supabase configuration incomplete. Check config.js.",
        "warning"
      );
      renderResults([]);
      return;
    }

    if (!window.supabase?.createClient) {
      showNotice(
        "Supabase library did not load. Refresh the page and try again.",
        "error"
      );
      renderResults([]);
      return;
    }

    showNotice("Loading business listings...", "info");

    try {
      const client = window.supabase.createClient(url, key);

      const { data, error } = await client
        .from(TABLE)
        .select(
          "id,business_name,description,city,state,country,business_segment,products,services,website,is_public,created_at"
        )
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;

      allBusinesses = Array.isArray(data) ? data : [];

      updateFilterOptions();
      applyFilters();

      if (allBusinesses.length) {
        showNotice(
          "Published business listings loaded successfully.",
          "success"
        );
      } else {
        showNotice(
          "No public listings found. Import your CSV and set is_public to TRUE for approved listings.",
          "info"
        );
      }
    } catch (error) {
      console.error("Business Directory error:", error);

      showNotice(
        "Unable to load listings. Check Supabase URL, publishable key, table permissions and browser console.",
        "error"
      );

      renderResults([]);
    }
  }

  function init() {
    $("search")?.addEventListener("click", applyFilters);
    $("reset")?.addEventListener("click", resetFilters);

    ["q", "products"].forEach((id) => {
      $(id)?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") applyFilters();
      });
    });

    $("state")?.addEventListener("change", () => {
      updateFilterOptions();
      applyFilters();
    });

    ["city", "segment"].forEach((id) => {
      $(id)?.addEventListener("change", applyFilters);
    });

    loadBusinesses();
  }

  window.BVDirectory = { init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
