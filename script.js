/**
 * LinkLite
 * Supabase Auth + Supabase Database
 */

document.addEventListener('DOMContentLoaded', async () => {
  // =========================================================
  // SUPABASE CONFIG
  // =========================================================

  const SUPABASE_URL =
    'YOUR_SUPABASE_PROJECT_URL';

  const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_-zBbU-ZisQCJaNIzI2NgSw_8MUwv67_';

  if (!window.supabase) {
    console.error('Supabase JS failed to load.');
    return;
  }

  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  // =========================================================
  // STATE
  // =========================================================

  let currentUser = null;
  let profile = null;
  let links = [];
  let pendingRedirectLink = null;
  let redirectInProgress = false;

  let clicksChartInstance = null;
  let referrerChartInstance = null;

  const REDIRECT_DELAY = 2000;

  // =========================================================
  // DOM
  // =========================================================

  const passwordModal = document.getElementById('passwordModal');
  const passwordForm = document.getElementById('passwordForm');
  const linkPasswordInput = document.getElementById('linkPasswordInput');
  const passwordError = document.getElementById('passwordError');

  const shortenForm = document.getElementById('shortenForm');
  const longUrlInput = document.getElementById('longUrlInput');
  const customAliasInput = document.getElementById('customAlias');
  const expirationDateInput = document.getElementById('expirationDate');
  const passwordProtectInput = document.getElementById('passwordProtect');

  const resultCard = document.getElementById('resultCard');
  const resultShortUrl = document.getElementById('resultShortUrl');
  const resultOriginalUrl = document.getElementById('resultOriginalUrl');
  const resultTime = document.getElementById('resultTime');
  const copyResultBtn = document.getElementById('copyResultBtn');
  const openResultLink = document.getElementById('openResultLink');
  const qrcodeContainer = document.getElementById('qrcode');
  const downloadQrBtn = document.getElementById('downloadQrBtn');

  const linksTableBody = document.getElementById('linksTableBody');
  const emptyState = document.getElementById('emptyState');

  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const sortSelect = document.getElementById('sortSelect');
  const exportCsvBtn = document.getElementById('exportCsvBtn');

  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const dropZone = document.getElementById('dropZone');

  const openAuthBtn = document.getElementById('openAuthBtn');
  const authModal = document.getElementById('authModal');
  const closeAuthModal = document.getElementById('closeAuthModal');

  const tabLoginBtn = document.getElementById('tabLoginBtn');
  const tabRegisterBtn = document.getElementById('tabRegisterBtn');

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  const loggedOutNav = document.getElementById('loggedOutNav');
  const loggedInNav = document.getElementById('loggedInNav');
  const userGreeting = document.getElementById('userGreeting');
  const logoutBtn = document.getElementById('logoutBtn');

  // =========================================================
  // HELPERS
  // =========================================================

  function showToast(message) {
    const container = document.getElementById('toastContainer');

    if (!container) return;

    const toast = document.createElement('div');

    toast.className = 'toast';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
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
    return String(value ?? '').replace(/"/g, '""');
  }

  function isValidUrl(value) {
    try {
      const url = new URL(value);

      return (
        url.protocol === 'http:' ||
        url.protocol === 'https:'
      );
    } catch {
      return false;
    }
  }

  function isExpired(expirationDate) {
    if (!expirationDate) return false;

    const date = new Date(expirationDate);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    return date < new Date();
  }

  function normalizeAlias(alias) {
    try {
      return decodeURIComponent(alias).trim();
    } catch {
      return alias.trim();
    }
  }

  function getBaseUrl() {
    let path = window.location.pathname;

    if (!path.endsWith('/')) {
      path += '/';
    }

    return `${window.location.origin}${path}`;
  }

  function createShortUrl(alias) {
    return `${getBaseUrl()}#${encodeURIComponent(alias)}`;
  }

  function generateAlias() {
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    let alias;

    do {
      alias = '';

      for (let i = 0; i < 6; i++) {
        alias += chars.charAt(
          Math.floor(Math.random() * chars.length)
        );
      }
    } while (
      links.some(
        link =>
          String(link.alias).toLowerCase() ===
          alias.toLowerCase()
      )
    );

    return alias;
  }

  async function copyToClipboard(text) {
    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      const textarea = document.createElement('textarea');

      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';

      document.body.appendChild(textarea);

      textarea.select();

      const copied =
        document.execCommand('copy');

      textarea.remove();

      return copied;
    } catch {
      return false;
    }
  }

  // =========================================================
  // THEME
  // =========================================================

  function initTheme() {
    const savedTheme =
      localStorage.getItem('linklite_theme') || 'light';

    document.documentElement.setAttribute(
      'data-theme',
      savedTheme
    );
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme =
        document.documentElement.getAttribute('data-theme');

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
    });
  }

  // =========================================================
  // AUTH UI
  // =========================================================

  function updateAuthUI() {
    if (currentUser) {
      loggedOutNav?.classList.add('hidden');
      loggedInNav?.classList.remove('hidden');

      if (userGreeting) {
        userGreeting.textContent =
          `@${profile?.username || currentUser.email}`;
      }
    } else {
      loggedOutNav?.classList.remove('hidden');
      loggedInNav?.classList.add('hidden');

      if (userGreeting) {
        userGreeting.textContent = '';
      }
    }
  }

  // =========================================================
  // LOAD PROFILE
  // =========================================================

  async function loadProfile() {
    if (!currentUser) {
      profile = null;
      updateAuthUI();
      return;
    }

    const { data, error } =
      await supabaseClient
        .from('profiles')
        .select('id, username')
        .eq('id', currentUser.id)
        .maybeSingle();

    if (error) {
      console.error('Profile load error:', error);
      profile = null;
    } else {
      profile = data;
    }

    updateAuthUI();
  }

  // =========================================================
  // LOAD USER LINKS
  // =========================================================

  async function loadUserLinks() {
    if (!currentUser) {
      links = [];
      renderDashboard();
      renderCharts();
      return;
    }

    const { data, error } =
      await supabaseClient
        .from('links')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', {
          ascending: false
        });

    if (error) {
      console.error('Links load error:', error);
      showToast('Could not load your links.');
      return;
    }

    links = (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      alias: row.alias,
      originalUrl: row.original_url,
      shortUrl: createShortUrl(row.alias),
      createdAt: row.created_at,
      expiration: row.expiration || null,
      password: row.password || null,
      clicks: Number(row.clicks || 0),
      isFavorite: Boolean(row.is_favorite),
      referrers: row.referrers || {
        Direct: 0,
        Google: 0,
        Twitter: 0,
        LinkedIn: 0
      }
    }));

    renderDashboard();
    renderCharts();
  }

  // =========================================================
  // AUTH STATE
  // =========================================================

  const {
    data: authListener
  } = supabaseClient.auth.onAuthStateChange(
    async (_event, session) => {
      currentUser = session?.user || null;

      await loadProfile();
      await loadUserLinks();
      updateAuthUI();
    }
  );

  // =========================================================
  // REGISTER
  // =========================================================

  if (registerForm) {
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();

      const username =
        document.getElementById('regUsername')?.value
          .trim()
          .toLowerCase();

      const email =
        document.getElementById('regEmail')?.value
          .trim()
          .toLowerCase();

      const password =
        document.getElementById('regPassword')?.value;

      if (!username || !email || !password) {
        showToast('Please fill in all fields.');
        return;
      }

      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        showToast(
          'Username must be 3-20 characters and use only letters, numbers, and _.'
        );
        return;
      }

      // Check username
      const {
        data: existingUsername,
        error: usernameError
      } =
        await supabaseClient
          .from('profiles')
          .select('id')
          .eq('username', username)
          .maybeSingle();

      if (usernameError) {
        console.error(usernameError);
        showToast('Could not check username.');
        return;
      }

      if (existingUsername) {
        showToast('Username is already taken.');
        return;
      }

      const redirectUrl =
        window.location.origin +
        window.location.pathname;

      const {
        data,
        error
      } =
        await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              username
            },
            emailRedirectTo: redirectUrl
          }
        });

      if (error) {
        console.error(error);
        showToast(error.message);
        return;
      }

      if (data.session) {
        showToast(
          `Account created! Welcome @${username}`
        );

        authModal?.classList.add('hidden');
        registerForm.reset();

        currentUser = data.user;

        await loadProfile();
        await loadUserLinks();
      } else {
        showToast(
          'Account created. Check your email to confirm your account.'
        );

        registerForm.reset();
      }
    });
  }

  // =========================================================
  // LOGIN
  // =========================================================

  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();

      const email =
        document.getElementById('loginIdentifier')?.value
          .trim()
          .toLowerCase();

      const password =
        document.getElementById('loginPassword')?.value;

      if (!email || !password) {
        showToast('Enter your email and password.');
        return;
      }

      const {
        data,
        error
      } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) {
        console.error(error);
        showToast('Invalid email or password.');
        return;
      }

      currentUser = data.user;

      await loadProfile();
      await loadUserLinks();
      updateAuthUI();

      authModal?.classList.add('hidden');
      loginForm.reset();

      showToast(
        `Signed in as @${profile?.username || email}`
      );
    });
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const { error } =
        await supabaseClient.auth.signOut();

      if (error) {
        console.error(error);
        showToast('Could not log out.');
        return;
      }

      currentUser = null;
      profile = null;
      links = [];

      updateAuthUI();
      renderDashboard();
      renderCharts();

      showToast('Logged out successfully.');
    });
  }

  // =========================================================
  // AUTH MODAL
  // =========================================================

  openAuthBtn?.addEventListener('click', () => {
    authModal?.classList.remove('hidden');
  });

  closeAuthModal?.addEventListener('click', () => {
    authModal?.classList.add('hidden');
  });

  tabLoginBtn?.addEventListener('click', () => {
    tabLoginBtn.classList.add('active');
    tabRegisterBtn?.classList.remove('active');

    loginForm?.classList.remove('hidden');
    registerForm?.classList.add('hidden');
  });

  tabRegisterBtn?.addEventListener('click', () => {
    tabRegisterBtn.classList.add('active');
    tabLoginBtn?.classList.remove('active');

    registerForm?.classList.remove('hidden');
    loginForm?.classList.add('hidden');
  });

  // =========================================================
  // CREATE SHORT LINK
  // =========================================================

  if (shortenForm) {
    shortenForm.addEventListener('submit', async e => {
      e.preventDefault();

      if (!currentUser) {
        showToast('Please sign in first.');
        authModal?.classList.remove('hidden');
        return;
      }

      const originalUrl =
        longUrlInput?.value.trim();

      const customAlias =
        customAliasInput?.value.trim();

      const expirationValue =
        expirationDateInput?.value;

      const password =
        passwordProtectInput?.value;

      if (!originalUrl) {
        showToast('Enter a URL.');
        return;
      }

      if (!isValidUrl(originalUrl)) {
        showToast(
          'Enter a valid HTTP or HTTPS URL.'
        );
        return;
      }

      if (customAlias) {
        if (!/^[a-zA-Z0-9_-]+$/.test(customAlias)) {
          showToast(
            'Alias can only contain letters, numbers, - and _.'
          );
          return;
        }

        const {
          data: existingAlias,
          error: aliasError
        } =
          await supabaseClient
            .from('links')
            .select('id')
            .eq('alias', customAlias)
            .maybeSingle();

        if (aliasError) {
          console.error(aliasError);
          showToast('Could not check alias.');
          return;
        }

        if (existingAlias) {
          showToast('That alias is already in use.');
          return;
        }
      }

      let alias =
        customAlias || generateAlias();

      // Avoid duplicate generated aliases
      if (!customAlias) {
        let attempts = 0;

        while (attempts < 10) {
          const {
            data: exists
          } =
            await supabaseClient
              .from('links')
              .select('id')
              .eq('alias', alias)
              .maybeSingle();

          if (!exists) break;

          alias = generateAlias();
          attempts++;
        }
      }

      let expiration = null;

      if (expirationValue) {
        const date = new Date(
          `${expirationValue}T23:59:59`
        );

        if (!Number.isNaN(date.getTime())) {
          expiration = date.toISOString();
        }
      }

      const row = {
        user_id: currentUser.id,
        alias,
        original_url: originalUrl,
        expiration,
        password: password || null,
        clicks: 0,
        is_favorite: false,
        referrers: {
          Direct: 0,
          Google: 0,
          Twitter: 0,
          LinkedIn: 0
        }
      };

      const {
        data,
        error
      } =
        await supabaseClient
          .from('links')
          .insert(row)
          .select('*')
          .single();

      if (error) {
        console.error(error);

        if (error.code === '23505') {
          showToast(
            'That alias already exists.'
          );
        } else {
          showToast(
            'Could not create the short link.'
          );
        }

        return;
      }

      const newLink = {
        id: data.id,
        userId: data.user_id,
        alias: data.alias,
        originalUrl: data.original_url,
        shortUrl: createShortUrl(data.alias),
        createdAt: data.created_at,
        expiration: data.expiration,
        password: data.password,
        clicks: data.clicks,
        isFavorite: data.is_favorite,
        referrers: data.referrers
      };

      links.unshift(newLink);

      renderResult(newLink);
      renderDashboard();
      renderCharts();

      shortenForm.reset();

      showToast(
        'URL shortened successfully!'
      );
    });
  }

  // =========================================================
  // RESULT
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

    if (resultTime) {
      resultTime.textContent =
        'Just now';
    }

    if (openResultLink) {
      openResultLink.href =
        link.shortUrl;
    }

    if (qrcodeContainer) {
      qrcodeContainer.innerHTML = '';

      if (typeof QRCode !== 'undefined') {
        new QRCode(qrcodeContainer, {
          text: link.shortUrl,
          width: 100,
          height: 100,
          colorDark: '#111827',
          colorLight: '#ffffff',
          correctLevel:
            QRCode.CorrectLevel.H
        });
      }
    }

    if (resultCard) {
      resultCard.classList.remove('hidden');

      resultCard.scrollIntoView({
        behavior: 'smooth'
      });
    }
  }

  // =========================================================
  // COPY
  // =========================================================

  copyResultBtn?.addEventListener('click', async () => {
    if (!resultShortUrl) return;

    const success =
      await copyToClipboard(
        resultShortUrl.value
      );

    if (success) {
      copyResultBtn.textContent = 'Copied!';

      setTimeout(() => {
        copyResultBtn.textContent = 'Copy';
      }, 2000);

      showToast('Copied to clipboard.');
    } else {
      showToast('Could not copy the link.');
    }
  });

  window.copyLink = async url => {
    const success =
      await copyToClipboard(url);

    showToast(
      success
        ? 'Link copied to clipboard.'
        : 'Could not copy the link.'
    );
  };

  // =========================================================
  // QR DOWNLOAD
  // =========================================================

  downloadQrBtn?.addEventListener('click', () => {
    const img =
      qrcodeContainer?.querySelector('img');

    if (!img?.src) {
      showToast('QR code is not ready.');
      return;
    }

    const a =
      document.createElement('a');

    a.href = img.src;
    a.download = 'linklite-qr.png';

    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  // =========================================================
  // PUBLIC REDIRECT LOOKUP
  // =========================================================

  async function getPublicLink(alias) {
    const {
      data,
      error
    } =
      await supabaseClient.rpc(
        'get_link_by_alias',
        {
          requested_alias: alias
        }
      );

    if (error) {
      console.error(
        'Public link lookup error:',
        error
      );

      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const row = data[0];

    return {
      id: row.id,
      alias: row.alias,
      originalUrl: row.original_url,
      expiration: row.expiration,
      password: row.password,
      clicks: Number(row.clicks || 0),
      referrers: row.referrers || {}
    };
  }

  // =========================================================
  // RECORD PUBLIC CLICK
  // =========================================================

  async function recordPublicClick(id) {
    const { error } =
      await supabaseClient.rpc(
        'record_link_click',
        {
          link_id: id
        }
      );

    if (error) {
      console.error(
        'Click tracking error:',
        error
      );
    }
  }

  // =========================================================
  // REDIRECT
  // =========================================================

  async function handleHashRouting() {
    if (redirectInProgress) {
      return;
    }

    const hash =
      window.location.hash;

    if (!hash || hash.length <= 1) {
      return;
    }

    const alias =
      normalizeAlias(
        hash.substring(1)
      );

    if (
      !alias ||
      ['hero', 'dashboard', 'analytics']
        .includes(alias)
    ) {
      return;
    }

    let link =
      await getPublicLink(alias);

    if (!link) {
      showToast('Short link not found.');
      return;
    }

    if (isExpired(link.expiration)) {
      showToast('This link has expired.');
      return;
    }

    if (
      !link.originalUrl ||
      !isValidUrl(link.originalUrl)
    ) {
      showToast('Invalid destination URL.');
      return;
    }

    if (link.password) {
      pendingRedirectLink = link;

      passwordModal?.classList.remove('hidden');
      passwordError?.classList.add('hidden');

      if (linkPasswordInput) {
        linkPasswordInput.value = '';
        linkPasswordInput.focus();
      }

      return;
    }

    await executeRedirect(link);
  }

  async function executeRedirect(link) {
    if (redirectInProgress) {
      return;
    }

    redirectInProgress = true;

    await recordPublicClick(link.id);

    setTimeout(() => {
      window.location.replace(
        link.originalUrl
      );
    }, REDIRECT_DELAY);
  }

  // =========================================================
  // PASSWORD-PROTECTED REDIRECT
  // =========================================================

  if (passwordForm) {
    passwordForm.addEventListener(
      'submit',
      async e => {
        e.preventDefault();

        if (!pendingRedirectLink) {
          return;
        }

        const enteredPassword =
          linkPasswordInput?.value || '';

        if (
          enteredPassword !==
          pendingRedirectLink.password
        ) {
          passwordError?.classList.remove(
            'hidden'
          );

          return;
        }

        passwordError?.classList.add(
          'hidden'
        );

        passwordModal?.classList.add(
          'hidden'
        );

        await executeRedirect(
          pendingRedirectLink
        );
      }
    );
  }

  // =========================================================
  // DASHBOARD
  // =========================================================

  function renderDashboard() {
    const totalLinks =
      links.length;

    const totalClicks =
      links.reduce(
        (sum, link) =>
          sum + Number(link.clicks || 0),
        0
      );

    const today =
      new Date()
        .toISOString()
        .split('T')[0];

    const todayClicks =
      links
        .filter(
          link =>
            link.createdAt?.startsWith(today)
        )
        .reduce(
          (sum, link) =>
            sum + Number(link.clicks || 0),
          0
        );

    const activeLinks =
      links.filter(
        link =>
          !isExpired(link.expiration)
      ).length;

    document.getElementById(
      'metricTotalLinks'
    )?.replaceChildren(
      document.createTextNode(
        String(totalLinks)
      )
    );

    document.getElementById(
      'metricTotalClicks'
    )?.replaceChildren(
      document.createTextNode(
        String(totalClicks)
      )
    );

    document.getElementById(
      'metricTodayClicks'
    )?.replaceChildren(
      document.createTextNode(
        String(todayClicks)
      )
    );

    document.getElementById(
      'metricActiveLinks'
    )?.replaceChildren(
      document.createTextNode(
        String(activeLinks)
      )
    );

    if (!linksTableBody) {
      return;
    }

    let filtered =
      [...links];

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
            link.alias
              .toLowerCase()
              .includes(query) ||
            link.originalUrl
              .toLowerCase()
              .includes(query)
        );
    }

    const status =
      statusFilter?.value ||
      'all';

    if (status === 'active') {
      filtered =
        filtered.filter(
          link =>
            !isExpired(link.expiration)
        );
    }

    if (status === 'expired') {
      filtered =
        filtered.filter(
          link =>
            isExpired(link.expiration)
        );
    }

    if (status === 'favorite') {
      filtered =
        filtered.filter(
          link =>
            link.isFavorite
        );
    }

    const sort =
      sortSelect?.value ||
      'newest';

    if (sort === 'newest') {
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      );
    }

    if (sort === 'oldest') {
      filtered.sort(
        (a, b) =>
          new Date(a.createdAt) -
          new Date(b.createdAt)
      );
    }

    if (sort === 'clicks') {
      filtered.sort(
        (a, b) =>
          Number(b.clicks || 0) -
          Number(a.clicks || 0)
      );
    }

    linksTableBody.innerHTML = '';

    if (filtered.length === 0) {
      emptyState?.classList.remove(
        'hidden'
      );
      return;
    }

    emptyState?.classList.add(
      'hidden'
    );

    filtered.forEach(link => {
      const tr =
        document.createElement('tr');

      const expired =
        isExpired(link.expiration);

      tr.innerHTML = `
        <td>
          <a
            href="${escapeHtml(link.shortUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            style="font-weight: 600;"
          >
            /${escapeHtml(link.alias)}
          </a>
          ${link.password ? ' 🔒' : ''}
        </td>

        <td
          style="
            max-width:250px;
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
          "
          title="${escapeHtml(link.originalUrl)}"
        >
          ${escapeHtml(link.originalUrl)}
        </td>

        <td>
          ${Number(link.clicks || 0)}
        </td>

        <td>
          <span
            class="badge ${
              expired
                ? 'badge-danger'
                : 'badge-success'
            }"
          >
            ${expired ? 'Expired' : 'Active'}
          </span>
        </td>

        <td>
          ${new Date(
            link.createdAt
          ).toLocaleDateString()}
        </td>

        <td class="text-right">

          <button
            class="btn btn-secondary btn-sm"
            onclick="toggleFavorite('${link.id}')"
          >
            ${link.isFavorite ? '★' : '☆'}
          </button>

          <button
            class="btn btn-secondary btn-sm"
            onclick="copyLink('${escapeHtml(link.shortUrl)}')"
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

      linksTableBody.appendChild(tr);
    });
  }

  // =========================================================
  // DELETE
  // =========================================================

  window.deleteLink = async id => {
    const { error } =
      await supabaseClient
        .from('links')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser.id);

    if (error) {
      console.error(error);
      showToast('Could not delete link.');
      return;
    }

    links =
      links.filter(
        link => link.id !== id
      );

    renderDashboard();
    renderCharts();

    showToast('Link deleted.');
  };

  // =========================================================
  // FAVORITE
  // =========================================================

  window.toggleFavorite = async id => {
    const link =
      links.find(
        item => item.id === id
      );

    if (!link) return;

    const nextValue =
      !link.isFavorite;

    const { error } =
      await supabaseClient
        .from('links')
        .update({
          is_favorite:
            nextValue
        })
        .eq('id', id)
        .eq('user_id', currentUser.id);

    if (error) {
      console.error(error);
      showToast('Could not update favorite.');
      return;
    }

    link.isFavorite =
      nextValue;

    renderDashboard();
  };

  // =========================================================
  // SEARCH / FILTERS
  // =========================================================

  searchInput?.addEventListener(
    'input',
    renderDashboard
  );

  statusFilter?.addEventListener(
    'change',
    renderDashboard
  );

  sortSelect?.addEventListener(
    'change',
    renderDashboard
  );

  // =========================================================
  // DRAG / DROP
  // =========================================================

  dropZone?.addEventListener(
    'dragover',
    e => {
      e.preventDefault();

      dropZone.classList.add(
        'dragover'
      );
    }
  );

  dropZone?.addEventListener(
    'dragleave',
    () => {
      dropZone.classList.remove(
        'dragover'
      );
    }
  );

  dropZone?.addEventListener(
    'drop',
    e => {
      e.preventDefault();

      dropZone.classList.remove(
        'dragover'
      );

      const value =
        e.dataTransfer.getData(
          'text'
        );

      if (
        value &&
        longUrlInput &&
        isValidUrl(value)
      ) {
        longUrlInput.value =
          value.trim();
      }
    }
  );

  // =========================================================
  // CSV
  // =========================================================

  exportCsvBtn?.addEventListener(
    'click',
    () => {
      if (links.length === 0) {
        showToast(
          'No links to export.'
        );
        return;
      }

      const header =
        'Alias,Short URL,Original URL,Clicks,Created At\n';

      const rows =
        links.map(
          link =>
            `"${escapeCsv(link.alias)}","${escapeCsv(
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
          [header + rows.join('\n')],
          {
            type:
              'text/csv;charset=utf-8'
          }
        );

      const url =
        URL.createObjectURL(blob);

      const a =
        document.createElement('a');

      a.href = url;
      a.download =
        'linklite-export.csv';

      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);

      showToast(
        'CSV exported.'
      );
    }
  );

  // =========================================================
  // CHARTS
  // =========================================================

  function renderCharts() {
    if (typeof Chart === 'undefined') {
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

    const totalClicks =
      links.reduce(
        (sum, link) =>
          sum + Number(link.clicks || 0),
        0
      );

    const referrerTotals = {
      Direct: 0,
      Google: 0,
      Twitter: 0,
      LinkedIn: 0
    };

    links.forEach(link => {
      const refs =
        link.referrers || {};

      Object.keys(
        referrerTotals
      ).forEach(key => {
        referrerTotals[key] +=
          Number(refs[key] || 0);
      });
    });

    const clicksElem =
      document.getElementById(
        'clicksChart'
      );

    if (clicksElem) {
      if (clicksChartInstance) {
        clicksChartInstance.destroy();
      }

      clicksChartInstance =
        new Chart(
          clicksElem.getContext('2d'),
          {
            type: 'line',

            data: {
              labels: [
                'Total Links',
                'Total Clicks'
              ],

              datasets: [
                {
                  label:
                    'Count',

                  data: [
                    links.length,
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
                  beginAtZero: true,

                  ticks: {
                    color:
                      textColor
                  },

                  grid: {
                    color:
                      gridColor
                  }
                }
              }
            }
          }
        );
    }

    const refElem =
      document.getElementById(
        'referrerChart'
      );

    if (refElem) {
      if (referrerChartInstance) {
        referrerChartInstance.destroy();
      }

      referrerChartInstance =
        new Chart(
          refElem.getContext('2d'),
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
                  position: 'bottom',

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
  // INITIALIZATION
  // =========================================================

  initTheme();

  const {
    data: sessionData
  } =
    await supabaseClient.auth.getSession();

  currentUser =
    sessionData.session?.user || null;

  await loadProfile();
  await loadUserLinks();

  // Important:
  // Public hash routing does not require login.
  await handleHashRouting();

});
