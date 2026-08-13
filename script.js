/**
 * LinkLite - Production Web Application Core Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================
  // STATE MANAGEMENT
  // =========================================================

  let users =
    JSON.parse(localStorage.getItem('linklite_users')) || [];

  let currentUser =
    JSON.parse(
      localStorage.getItem('linklite_current_user')
    ) || null;

  let links =
    JSON.parse(localStorage.getItem('linklite_links')) || [];

  let pendingRedirectLink = null;

  let clicksChartInstance = null;
  let referrerChartInstance = null;

  // Redirect delay in milliseconds
  const REDIRECT_DELAY = 2000;

  // =========================================================
  // PASSWORD MODAL ELEMENTS
  // =========================================================

  const passwordModal =
    document.getElementById('passwordModal');

  const passwordForm =
    document.getElementById('passwordForm');

  const linkPasswordInput =
    document.getElementById('linkPasswordInput');

  const passwordError =
    document.getElementById('passwordError');

  // =========================================================
  // UTILITY FUNCTIONS
  // =========================================================

  function showToast(message) {
    const container =
      document.getElementById('toastContainer');

    if (!container) return;

    const toast =
      document.createElement('div');

    toast.className = 'toast';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  function saveLinks() {
    localStorage.setItem(
      'linklite_links',
      JSON.stringify(links)
    );
  }

  function isExpired(expirationDate) {
    if (!expirationDate) {
      return false;
    }

    const expiration =
      new Date(expirationDate);

    if (Number.isNaN(expiration.getTime())) {
      return false;
    }

    return expiration < new Date();
  }

  function isValidUrl(value) {
    try {
      const url = new URL(value);

      return (
        url.protocol === 'http:' ||
        url.protocol === 'https:'
      );
    } catch (_) {
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeCsv(value) {
    return String(value ?? '')
      .replace(/"/g, '""');
  }

  // =========================================================
  // URL / ALIAS GENERATION
  // =========================================================

  function generateAlias() {
    const characters =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    let alias;

    do {
      alias = '';

      for (let i = 0; i < 6; i++) {
        alias += characters.charAt(
          Math.floor(
            Math.random() * characters.length
          )
        );
      }
    } while (
      links.some(
        link => link.alias === alias
      )
    );

    return alias;
  }

  function normalizeAlias(alias) {
    try {
      return decodeURIComponent(alias).trim();
    } catch (_) {
      return alias.trim();
    }
  }

  function getBaseUrl() {
    let pathname =
      window.location.pathname;

    if (!pathname.endsWith('/')) {
      pathname += '/';
    }

    return (
      window.location.origin +
      pathname
    );
  }

  function createShortUrl(alias) {
    return (
      getBaseUrl() +
      '#' +
      encodeURIComponent(alias)
    );
  }

  // =========================================================
  // HASH ROUTING
  // =========================================================

  function handleHashRouting() {
    const hash =
      window.location.hash;

    if (!hash || hash.length <= 1) {
      return;
    }

    const hashVal =
      normalizeAlias(
        hash.substring(1)
      );

    // Ignore normal page navigation anchors
    if (
      [
        'hero',
        'dashboard',
        'analytics'
      ].includes(hashVal)
    ) {
      return;
    }

    if (!hashVal) {
      return;
    }

    const matchedLink =
      links.find(
        link =>
          String(link.alias).toLowerCase() ===
          hashVal.toLowerCase()
      );

    if (!matchedLink) {
      showToast(
        'Short link not found.'
      );

      return;
    }

    if (
      isExpired(
        matchedLink.expiration
      )
    ) {
      showToast(
        'This link has expired.'
      );

      return;
    }

    if (
      !matchedLink.originalUrl ||
      !isValidUrl(
        matchedLink.originalUrl
      )
    ) {
      showToast(
        'This short link has an invalid destination.'
      );

      return;
    }

    // Password-protected link
    if (matchedLink.password) {
      pendingRedirectLink =
        matchedLink;

      if (passwordModal) {
        passwordModal.classList.remove(
          'hidden'
        );
      }

      if (passwordError) {
        passwordError.classList.add(
          'hidden'
        );
      }

      if (linkPasswordInput) {
        linkPasswordInput.value = '';
        linkPasswordInput.focus();
      }

      return;
    }

    executeRedirect(
      matchedLink
    );
  }

  // =========================================================
  // REDIRECT
  // =========================================================

  function executeRedirect(link) {
    if (
      !link ||
      !link.originalUrl
    ) {
      showToast(
        'Invalid destination URL.'
      );

      return;
    }

    if (
      !isValidUrl(
        link.originalUrl
      )
    ) {
      showToast(
        'Invalid destination URL.'
      );

      return;
    }

    // Register click BEFORE redirect
    registerClick(
      link.id
    );

    // Give the page a small delay before redirecting
    setTimeout(() => {
      window.location.replace(
        link.originalUrl
      );
    }, REDIRECT_DELAY);
  }

  // =========================================================
  // PASSWORD SUBMISSION
  // =========================================================

  if (passwordForm) {
    passwordForm.addEventListener(
      'submit',
      e => {
        e.preventDefault();

        if (!pendingRedirectLink) {
          return;
        }

        const enteredPassword =
          linkPasswordInput
            ? linkPasswordInput.value
            : '';

        if (
          enteredPassword ===
          pendingRedirectLink.password
        ) {
          if (passwordError) {
            passwordError.classList.add(
              'hidden'
            );
          }

          if (passwordModal) {
            passwordModal.classList.add(
              'hidden'
            );
          }

          executeRedirect(
            pendingRedirectLink
          );
        } else {
          if (passwordError) {
            passwordError.classList.remove(
              'hidden'
            );
          }
        }
      }
    );
  }

  // Listen for hash changes
  window.addEventListener(
    'hashchange',
    handleHashRouting
  );

  // =========================================================
  // DOM ELEMENTS
  // =========================================================

  const shortenForm =
    document.getElementById(
      'shortenForm'
    );

  const longUrlInput =
    document.getElementById(
      'longUrlInput'
    );

  const customAliasInput =
    document.getElementById(
      'customAlias'
    );

  const expirationDateInput =
    document.getElementById(
      'expirationDate'
    );

  const passwordProtectInput =
    document.getElementById(
      'passwordProtect'
    );

  const resultCard =
    document.getElementById(
      'resultCard'
    );

  const resultShortUrl =
    document.getElementById(
      'resultShortUrl'
    );

  const resultOriginalUrl =
    document.getElementById(
      'resultOriginalUrl'
    );

  const copyResultBtn =
    document.getElementById(
      'copyResultBtn'
    );

  const openResultLink =
    document.getElementById(
      'openResultLink'
    );

  const qrcodeContainer =
    document.getElementById(
      'qrcode'
    );

  const downloadQrBtn =
    document.getElementById(
      'downloadQrBtn'
    );

  const linksTableBody =
    document.getElementById(
      'linksTableBody'
    );

  const emptyState =
    document.getElementById(
      'emptyState'
    );

  const searchInput =
    document.getElementById(
      'searchInput'
    );

  const statusFilter =
    document.getElementById(
      'statusFilter'
    );

  const sortSelect =
    document.getElementById(
      'sortSelect'
    );

  const exportCsvBtn =
    document.getElementById(
      'exportCsvBtn'
    );

  const themeToggleBtn =
    document.getElementById(
      'themeToggleBtn'
    );

  const dropZone =
    document.getElementById(
      'dropZone'
    );

  // =========================================================
  // AUTH ELEMENTS
  // =========================================================

  const openAuthBtn =
    document.getElementById(
      'openAuthBtn'
    );

  const authModal =
    document.getElementById(
      'authModal'
    );

  const closeAuthModal =
    document.getElementById(
      'closeAuthModal'
    );

  const tabLoginBtn =
    document.getElementById(
      'tabLoginBtn'
    );

  const tabRegisterBtn =
    document.getElementById(
      'tabRegisterBtn'
    );

  const loginForm =
    document.getElementById(
      'loginForm'
    );

  const registerForm =
    document.getElementById(
      'registerForm'
    );

  const loggedOutNav =
    document.getElementById(
      'loggedOutNav'
    );

  const loggedInNav =
    document.getElementById(
      'loggedInNav'
    );

  const userGreeting =
    document.getElementById(
      'userGreeting'
    );

  const logoutBtn =
    document.getElementById(
      'logoutBtn'
    );

  // =========================================================
  // THEME CONTROLLER
  // =========================================================

  function initTheme() {
    const savedTheme =
      localStorage.getItem(
        'linklite_theme'
      ) || 'light';

    document.documentElement.setAttribute(
      'data-theme',
      savedTheme
    );
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener(
      'click',
      () => {
        const currentTheme =
          document.documentElement.getAttribute(
            'data-theme'
          );

        const newTheme =
          currentTheme === 'dark'
            ? 'light'
            : 'dark';

        document.documentElement.setAttribute(
          'data-theme',
          newTheme
        );

        localStorage.setItem(
          'linklite_theme',
          newTheme
        );

        renderCharts();
      }
    );
  }

  // =========================================================
  // AUTH SYSTEM
  // =========================================================

  function updateAuthUI() {
    if (currentUser) {
      if (loggedOutNav) {
        loggedOutNav.classList.add(
          'hidden'
        );
      }

      if (loggedInNav) {
        loggedInNav.classList.remove(
          'hidden'
        );
      }

      if (userGreeting) {
        userGreeting.textContent =
          `@${currentUser.username}`;
      }
    } else {
      if (loggedOutNav) {
        loggedOutNav.classList.remove(
          'hidden'
        );
      }

      if (loggedInNav) {
        loggedInNav.classList.add(
          'hidden'
        );
      }

      if (userGreeting) {
        userGreeting.textContent = '';
      }
    }
  }

  // Open auth modal
  if (
    openAuthBtn &&
    authModal
  ) {
    openAuthBtn.addEventListener(
      'click',
      () => {
        authModal.classList.remove(
          'hidden'
        );
      }
    );
  }

  // Close auth modal
  if (
    closeAuthModal &&
    authModal
  ) {
    closeAuthModal.addEventListener(
      'click',
      () => {
        authModal.classList.add(
          'hidden'
        );
      }
    );
  }

  // =========================================================
  // AUTH TABS
  // =========================================================

  if (tabLoginBtn) {
    tabLoginBtn.addEventListener(
      'click',
      () => {
        tabLoginBtn.classList.add(
          'active'
        );

        if (tabRegisterBtn) {
          tabRegisterBtn.classList.remove(
            'active'
          );
        }

        if (loginForm) {
          loginForm.classList.remove(
            'hidden'
          );
        }

        if (registerForm) {
          registerForm.classList.add(
            'hidden'
          );
        }
      }
    );
  }

  if (tabRegisterBtn) {
    tabRegisterBtn.addEventListener(
      'click',
      () => {
        tabRegisterBtn.classList.add(
          'active'
        );

        if (tabLoginBtn) {
          tabLoginBtn.classList.remove(
            'active'
          );
        }

        if (registerForm) {
          registerForm.classList.remove(
            'hidden'
          );
        }

        if (loginForm) {
          loginForm.classList.add(
            'hidden'
          );
        }
      }
    );
  }

  // =========================================================
  // REGISTRATION
  // =========================================================

  if (registerForm) {
    registerForm.addEventListener(
      'submit',
      e => {
        e.preventDefault();

        const usernameElement =
          document.getElementById(
            'regUsername'
          );

        const emailElement =
          document.getElementById(
            'regEmail'
          );

        const passwordElement =
          document.getElementById(
            'regPassword'
          );

        const username =
          usernameElement
            ? usernameElement.value
                .trim()
                .toLowerCase()
            : '';

        const email =
          emailElement
            ? emailElement.value
                .trim()
                .toLowerCase()
            : '';

        const password =
          passwordElement
            ? passwordElement.value
            : '';

        if (
          !username ||
          !email ||
          !password
        ) {
          showToast(
            'Please fill in all fields.'
          );

          return;
        }

        if (
          users.some(
            user => user.email === email
          )
        ) {
          showToast(
            'Error: This email is already registered.'
          );

          return;
        }

        if (
          users.some(
            user =>
              user.username === username
          )
        ) {
          showToast(
            'Error: This username is already taken.'
          );

          return;
        }

        const newUser = {
          id: Date.now().toString(),
          username,
          email,
          password
        };

        users.push(newUser);

        localStorage.setItem(
          'linklite_users',
          JSON.stringify(users)
        );

        currentUser = {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email
        };

        localStorage.setItem(
          'linklite_current_user',
          JSON.stringify(
            currentUser
          )
        );

        updateAuthUI();
        renderDashboard();
        renderCharts();

        if (authModal) {
          authModal.classList.add(
            'hidden'
          );
        }

        registerForm.reset();

        showToast(
          `Account created! Welcome @${newUser.username}`
        );
      }
    );
  }

  // =========================================================
  // LOGIN
  // =========================================================

  if (loginForm) {
    loginForm.addEventListener(
      'submit',
      e => {
        e.preventDefault();

        const identifierElement =
          document.getElementById(
            'loginIdentifier'
          );

        const passwordElement =
          document.getElementById(
            'loginPassword'
          );

        const identifier =
          identifierElement
            ? identifierElement.value
                .trim()
                .toLowerCase()
            : '';

        const password =
          passwordElement
            ? passwordElement.value
            : '';

        const matchedUser =
          users.find(
            user =>
              (
                user.email ===
                  identifier ||
                user.username ===
                  identifier
              ) &&
              user.password ===
                password
          );

        if (!matchedUser) {
          showToast(
            'Invalid credentials. Please try again.'
          );

          return;
        }

        currentUser = {
          id: matchedUser.id,
          username: matchedUser.username,
          email: matchedUser.email
        };

        localStorage.setItem(
          'linklite_current_user',
          JSON.stringify(
            currentUser
          )
        );

        updateAuthUI();
        renderDashboard();
        renderCharts();

        if (authModal) {
          authModal.classList.add(
            'hidden'
          );
        }

        loginForm.reset();

        showToast(
          `Signed in as @${matchedUser.username}`
        );
      }
    );
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  if (logoutBtn) {
    logoutBtn.addEventListener(
      'click',
      () => {
        currentUser = null;

        localStorage.removeItem(
          'linklite_current_user'
        );

        updateAuthUI();
        renderDashboard();
        renderCharts();

        showToast(
          'Logged out successfully'
        );
      }
    );
  }

  // =========================================================
  // USER LINKS
  // =========================================================

  function getUserLinks() {
    if (!currentUser) {
      return links;
    }

    return links.filter(
      link =>
        link.userId ===
        currentUser.id
    );
  }

  // =========================================================
  // URL SHORTENING
  // =========================================================

  if (shortenForm) {
    shortenForm.addEventListener(
      'submit',
      e => {
        e.preventDefault();

        const originalUrl =
          longUrlInput
            ? longUrlInput.value.trim()
            : '';

        if (!originalUrl) {
          showToast(
            'Please enter a URL.'
          );

          return;
        }

        if (
          !isValidUrl(
            originalUrl
          )
        ) {
          showToast(
            'Please enter a valid URL starting with http:// or https://'
          );

          return;
        }

        const customAlias =
          customAliasInput
            ? customAliasInput.value.trim()
            : '';

        const expiration =
          expirationDateInput
            ? expirationDateInput.value
            : '';

        const password =
          passwordProtectInput
            ? passwordProtectInput.value
            : '';

        // Custom alias validation
        if (customAlias) {
          if (
            !/^[a-zA-Z0-9_-]+$/.test(
              customAlias
            )
          ) {
            showToast(
              'Alias can only contain letters, numbers, - and _.'
            );

            return;
          }

          if (
            links.some(
              link =>
                String(
                  link.alias
                ).toLowerCase() ===
                customAlias.toLowerCase()
            )
          ) {
            showToast(
              'Custom alias is already in use.'
            );

            return;
          }
        }

        const alias =
          customAlias ||
          generateAlias();

        const shortUrl =
          createShortUrl(
            alias
          );

        const newLink = {
          id: Date.now().toString(),

          userId:
            currentUser
              ? currentUser.id
              : null,

          originalUrl,
          alias,
          shortUrl,

          createdAt:
            new Date().toISOString(),

          expiration:
            expiration || null,

          password:
            password || null,

          clicks: 0,

          isFavorite: false,

          referrers: {
            Direct: 0,
            Google: 0,
            Twitter: 0,
            LinkedIn: 0
          }
        };

        links.unshift(
          newLink
        );

        saveLinks();

        renderResult(
          newLink
        );

        renderDashboard();
        renderCharts();

        shortenForm.reset();

        showToast(
          'URL shortened successfully!'
        );
      }
    );
  }

  // =========================================================
  // RENDER RESULT
  // =========================================================

  function renderResult(link) {
    if (resultShortUrl) {
      resultShortUrl.value =
        link.shortUrl;
    }

    if (resultOriginalUrl) {
      resultOriginalUrl.textContent =
        link.originalUrl;
    }

    if (openResultLink) {
      openResultLink.href =
        link.shortUrl;
    }

    if (qrcodeContainer) {
      qrcodeContainer.innerHTML =
        '';

      if (
        typeof QRCode !==
        'undefined'
      ) {
        new QRCode(
          qrcodeContainer,
          {
            text: link.shortUrl,
            width: 100,
            height: 100,
            colorDark: '#111827',
            colorLight: '#ffffff',
            correctLevel:
              QRCode.CorrectLevel.H
          }
        );
      }
    }

    if (resultCard) {
      resultCard.classList.remove(
        'hidden'
      );

      resultCard.scrollIntoView({
        behavior: 'smooth'
      });
    }
  }

  // =========================================================
  // CLIPBOARD
  // =========================================================

  async function copyToClipboard(
    text
  ) {
    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(
          text
        );

        return true;
      }

      const textarea =
        document.createElement(
          'textarea'
        );

      textarea.value = text;
      textarea.style.position =
        'fixed';

      textarea.style.left = '-9999px';

      document.body.appendChild(
        textarea
      );

      textarea.select();

      const result =
        document.execCommand(
          'copy'
        );

      textarea.remove();

      return result;
    } catch (_) {
      return false;
    }
  }

  if (copyResultBtn) {
    copyResultBtn.addEventListener(
      'click',
      async () => {
        if (!resultShortUrl) {
          return;
        }

        const success =
          await copyToClipboard(
            resultShortUrl.value
          );

        if (success) {
          copyResultBtn.textContent =
            'Copied!';

          setTimeout(() => {
            copyResultBtn.textContent =
              'Copy';
          }, 2000);

          showToast(
            'Copied to clipboard'
          );
        } else {
          showToast(
            'Could not copy the link.'
          );
        }
      }
    );
  }

  // =========================================================
  // GLOBAL COPY FUNCTION
  // =========================================================

  window.copyLink =
    async url => {
      const success =
        await copyToClipboard(
          url
        );

      if (success) {
        showToast(
          'Link copied to clipboard'
        );
      } else {
        showToast(
          'Could not copy the link.'
        );
      }
    };

  // =========================================================
  // DOWNLOAD QR CODE
  // =========================================================

  if (downloadQrBtn) {
    downloadQrBtn.addEventListener(
      'click',
      () => {
        if (!qrcodeContainer) {
          return;
        }

        const img =
          qrcodeContainer.querySelector(
            'img'
          );

        if (
          img &&
          img.src
        ) {
          const a =
            document.createElement(
              'a'
            );

          a.href = img.src;
          a.download =
            'linklite-qr.png';

          document.body.appendChild(
            a
          );

          a.click();

          document.body.removeChild(
            a
          );
        } else {
          showToast(
            'QR code is not available.'
          );
        }
      }
    );
  }

  // =========================================================
  // DASHBOARD RENDERER
  // =========================================================

  function renderDashboard() {
    const activeUserLinks =
      getUserLinks();

    const totalLinks =
      activeUserLinks.length;

    const totalClicks =
      activeUserLinks.reduce(
        (sum, link) =>
          sum +
          Number(
            link.clicks || 0
          ),
        0
      );

    const todayStr =
      new Date()
        .toISOString()
        .split('T')[0];

    const todayClicks =
      activeUserLinks
        .filter(
          link =>
            link.createdAt &&
            link.createdAt.startsWith(
              todayStr
            )
        )
        .reduce(
          (sum, link) =>
            sum +
            Number(
              link.clicks || 0
            ),
          0
        );

    const activeLinks =
      activeUserLinks.filter(
        link =>
          !isExpired(
            link.expiration
          )
      ).length;

    const metricTotalLinks =
      document.getElementById(
        'metricTotalLinks'
      );

    const metricTotalClicks =
      document.getElementById(
        'metricTotalClicks'
      );

    const metricTodayClicks =
      document.getElementById(
        'metricTodayClicks'
      );

    const metricActiveLinks =
      document.getElementById(
        'metricActiveLinks'
      );

    if (metricTotalLinks) {
      metricTotalLinks.textContent =
        totalLinks;
    }

    if (metricTotalClicks) {
      metricTotalClicks.textContent =
        totalClicks;
    }

    if (metricTodayClicks) {
      metricTodayClicks.textContent =
        todayClicks;
    }

    if (metricActiveLinks) {
      metricActiveLinks.textContent =
        activeLinks;
    }

    let filtered =
      [...activeUserLinks];

    // Search
    const query =
      searchInput
        ? searchInput.value
            .trim()
            .toLowerCase()
        : '';

    if (query) {
      filtered =
        filtered.filter(
          link =>
            link.originalUrl
              .toLowerCase()
              .includes(query) ||
            link.alias
              .toLowerCase()
              .includes(query)
        );
    }

    // Status
    const status =
      statusFilter
        ? statusFilter.value
        : 'all';

    if (status === 'active') {
      filtered =
        filtered.filter(
          link =>
            !isExpired(
              link.expiration
            )
        );
    }

    if (status === 'expired') {
      filtered =
        filtered.filter(
          link =>
            isExpired(
              link.expiration
            )
        );
    }

    if (status === 'favorite') {
      filtered =
        filtered.filter(
          link =>
            link.isFavorite
        );
    }

    // Sort
    const sort =
      sortSelect
        ? sortSelect.value
        : 'newest';

    if (sort === 'newest') {
      filtered.sort(
        (a, b) =>
          new Date(
            b.createdAt
          ) -
          new Date(
            a.createdAt
          )
      );
    }

    if (sort === 'oldest') {
      filtered.sort(
        (a, b) =>
          new Date(
            a.createdAt
          ) -
          new Date(
            b.createdAt
          )
      );
    }

    if (sort === 'clicks') {
      filtered.sort(
        (a, b) =>
          Number(
            b.clicks || 0
          ) -
          Number(
            a.clicks || 0
          )
      );
    }

    if (!linksTableBody) {
      return;
    }

    linksTableBody.innerHTML =
      '';

    if (filtered.length === 0) {
      if (emptyState) {
        emptyState.classList.remove(
          'hidden'
        );
      }

      return;
    }

    if (emptyState) {
      emptyState.classList.add(
        'hidden'
      );
    }

    filtered.forEach(
      link => {
        const tr =
          document.createElement(
            'tr'
          );

        const expired =
          isExpired(
            link.expiration
          );

        tr.innerHTML = `
          <td>
            <a
              href="${link.shortUrl}"
              target="_blank"
              rel="noopener noreferrer"
              style="font-weight: 600;"
            >
              /${escapeHtml(link.alias)}
            </a>

            ${
              link.password
                ? ' 🔒'
                : ''
            }
          </td>

          <td
            style="
              max-width: 250px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            "
          >
            ${escapeHtml(
              link.originalUrl
            )}
          </td>

          <td>
            ${Number(
              link.clicks || 0
            )}
          </td>

          <td>
            <span
              class="badge ${
                expired
                  ? 'badge-danger'
                  : 'badge-success'
              }"
            >
              ${
                expired
                  ? 'Expired'
                  : 'Active'
              }
            </span>
          </td>

          <td>
            ${
              new Date(
                link.createdAt
              ).toLocaleDateString()
            }
          </td>

          <td class="text-right">

            <button
              class="btn btn-secondary btn-sm"
              onclick="toggleFavorite('${link.id}')"
            >
              ${
                link.isFavorite
                  ? '★'
                  : '☆'
              }
            </button>

            <button
              class="btn btn-secondary btn-sm"
              onclick="copyLink('${link.shortUrl}')"
            >
              Copy
            </button>

            <button
              class="btn btn-secondary btn-sm"
              onclick="deleteLink('${link.id}')"
            >
              Delete
            </button>

          </td>
        `;

        linksTableBody.appendChild(
          tr
        );
      }
    );
  }

  // =========================================================
  // REGISTER CLICK
  // =========================================================

  window.registerClick =
    id => {
      const link =
        links.find(
          item =>
            item.id === id
        );

      if (!link) {
        return;
      }

      link.clicks =
        Number(
          link.clicks || 0
        ) + 1;

      if (!link.referrers) {
        link.referrers = {
          Direct: 0,
          Google: 0,
          Twitter: 0,
          LinkedIn: 0
        };
      }

      link.referrers.Direct =
        Number(
          link.referrers.Direct || 0
        ) + 1;

      saveLinks();

      renderDashboard();
      renderCharts();
    };

  // =========================================================
  // DELETE LINK
  // =========================================================

  window.deleteLink =
    id => {
      const exists =
        links.some(
          link =>
            link.id === id
        );

      if (!exists) {
        return;
      }

      links =
        links.filter(
          link =>
            link.id !== id
        );

      saveLinks();

      renderDashboard();
      renderCharts();

      showToast(
        'Link deleted'
      );
    };

  // =========================================================
  // FAVORITE
  // =========================================================

  window.toggleFavorite =
    id => {
      const link =
        links.find(
          item =>
            item.id === id
        );

      if (!link) {
        return;
      }

      link.isFavorite =
        !link.isFavorite;

      saveLinks();

      renderDashboard();
    };

  // =========================================================
  // FILTERING
  // =========================================================

  if (searchInput) {
    searchInput.addEventListener(
      'input',
      renderDashboard
    );
  }

  if (statusFilter) {
    statusFilter.addEventListener(
      'change',
      renderDashboard
    );
  }

  if (sortSelect) {
    sortSelect.addEventListener(
      'change',
      renderDashboard
    );
  }

  // =========================================================
  // DRAG AND DROP
  // =========================================================

  if (dropZone) {
    dropZone.addEventListener(
      'dragover',
      e => {
        e.preventDefault();

        dropZone.classList.add(
          'dragover'
        );
      }
    );

    dropZone.addEventListener(
      'dragleave',
      () => {
        dropZone.classList.remove(
          'dragover'
        );
      }
    );

    dropZone.addEventListener(
      'drop',
      e => {
        e.preventDefault();

        dropZone.classList.remove(
          'dragover'
        );

        const droppedText =
          e.dataTransfer.getData(
            'text'
          );

        if (
          droppedText &&
          isValidUrl(
            droppedText
          ) &&
          longUrlInput
        ) {
          longUrlInput.value =
            droppedText.trim();
        }
      }
    );
  }

  // =========================================================
  // EXPORT CSV
  // =========================================================

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener(
      'click',
      () => {
        const activeUserLinks =
          getUserLinks();

        if (
          activeUserLinks.length ===
          0
        ) {
          showToast(
            'No data available to export.'
          );

          return;
        }

        const headers =
          'Alias,Short URL,Original URL,Clicks,Created At\n';

        const rows =
          activeUserLinks.map(
            link =>
              `"${escapeCsv(
                link.alias
              )}","${escapeCsv(
                link.shortUrl
              )}","${escapeCsv(
                link.originalUrl
              )}",${Number(
                link.clicks || 0
              )},"${escapeCsv(
                link.createdAt
              )}"`
          );

        const blob =
          new Blob(
            [
              headers +
              rows.join('\n')
            ],
            {
              type:
                'text/csv;charset=utf-8;'
            }
          );

        const url =
          window.URL.createObjectURL(
            blob
          );

        const a =
          document.createElement(
            'a'
          );

        a.href = url;
        a.download =
          'linklite-export.csv';

        document.body.appendChild(
          a
        );

        a.click();

        document.body.removeChild(
          a
        );

        window.URL.revokeObjectURL(
          url
        );

        showToast(
          'Exported links as CSV'
        );
      }
    );
  }

  // =========================================================
  // ANALYTICS CHARTS
  // =========================================================

  function renderCharts() {
    if (
      typeof Chart ===
      'undefined'
    ) {
      return;
    }

    const isDark =
      document.documentElement.getAttribute(
        'data-theme'
      ) === 'dark';

    const textColor =
      isDark
        ? '#9CA3AF'
        : '#6B7280';

    const gridColor =
      isDark
        ? '#1F2937'
        : '#E5E7EB';

    const activeUserLinks =
      getUserLinks();

    const referrerTotals = {
      Direct: 0,
      Google: 0,
      Twitter: 0,
      LinkedIn: 0
    };

    activeUserLinks.forEach(
      link => {
        if (!link.referrers) {
          return;
        }

        Object.keys(
          referrerTotals
        ).forEach(key => {
          referrerTotals[key] +=
            Number(
              link.referrers[key] ||
              0
            );
        });
      }
    );

    // ---------------------------------------------------------
    // CLICKS CHART
    // ---------------------------------------------------------

    const clicksElem =
      document.getElementById(
        'clicksChart'
      );

    if (clicksElem) {
      const clicksCtx =
        clicksElem.getContext(
          '2d'
        );

      if (clicksChartInstance) {
        clicksChartInstance.destroy();
      }

      const totalClicks =
        activeUserLinks.reduce(
          (sum, link) =>
            sum +
            Number(
              link.clicks || 0
            ),
          0
        );

      clicksChartInstance =
        new Chart(
          clicksCtx,
          {
            type: 'line',

            data: {
              labels: [
                'Total Stored Links',
                'Total Clicks'
              ],

              datasets: [
                {
                  label: 'Count',

                  data: [
                    activeUserLinks.length,
                    totalClicks
                  ],

                  borderColor:
                    '#2563EB',

                  backgroundColor:
                    'rgba(37, 99, 235, 0.1)',

                  fill: true,
                  tension: 0.3
                }
              ]
            },

            options: {
              responsive: true,

              plugins: {
                legend: {
                  display: false
                }
              },

              scales: {
                x: {
                  ticks: {
                    color:
                      textColor
                  },

                  grid: {
                    color:
                      gridColor
                  }
                },

                y: {
                  ticks: {
                    color:
                      textColor
                  },

                  grid: {
                    color:
                      gridColor
                  },

                  beginAtZero:
                    true
                }
              }
            }
          }
        );
    }

    // ---------------------------------------------------------
    // REFERRER CHART
    // ---------------------------------------------------------

    const refElem =
      document.getElementById(
        'referrerChart'
      );

    if (refElem) {
      const refCtx =
        refElem.getContext(
          '2d'
        );

      if (referrerChartInstance) {
        referrerChartInstance.destroy();
      }

      referrerChartInstance =
        new Chart(
          refCtx,
          {
            type: 'doughnut',

            data: {
              labels:
                Object.keys(
                  referrerTotals
                ),

              datasets: [
                {
                  data:
                    Object.values(
                      referrerTotals
                    ),

                  backgroundColor: [
                    '#2563EB',
                    '#16A34A',
                    '#F59E0B',
                    '#8B5CF6'
                  ]
                }
              ]
            },

            options: {
              responsive: true,

              plugins: {
                legend: {
                  position:
                    'bottom',

                  labels: {
                    color:
                      textColor
                  }
                }
              }
            }
          }
        );
    }
  }

  // =========================================================
  // INITIAL EXECUTION
  // =========================================================

  initTheme();
  updateAuthUI();
  renderDashboard();
  renderCharts();

  // IMPORTANT:
  // This MUST stay at the bottom.
  // All functions including registerClick()
  // must exist before routing starts.
  handleHashRouting();
});
